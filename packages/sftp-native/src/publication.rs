use crate::{Ack, Error, NativeReceipt, Result, request::Request, session::Session};
use russh_sftp::{
    client::error::Error as SftpError,
    protocol::{FileAttributes, OpenFlags, Status, StatusCode},
};
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom, Write},
    os::unix::fs::MetadataExt,
};
fn ack(value: Status) -> Result<()> {
    if value.status_code == StatusCode::Ok {
        Ok(())
    } else {
        Err(Error::Transport)
    }
}
fn regular(attrs: &FileAttributes, size: u64) -> Result<()> {
    if attrs.permissions.map(|mode| mode & 0o170000) != Some(0o100000) || attrs.size != Some(size) {
        return Err(Error::Verification);
    }
    Ok(())
}
async fn parents(
    session: &Session,
    request: &Request,
    owner: &mut dyn NativeReceipt,
    create: bool,
) -> Result<()> {
    owner.admit()?;
    session.root(request).await?;
    let mut path = request.root.trim_end_matches('/').to_string();
    let parts: Vec<_> = request.final_path.split('/').collect();
    for part in &parts[..parts.len() - 1] {
        owner.admit()?;
        path.push('/');
        path.push_str(part);
        match session.sftp.lstat(&path).await {
            Ok(value) if value.attrs.permissions.map(|mode| mode & 0o170000) == Some(0o40000) => {}
            Err(SftpError::Status(status))
                if create && status.status_code == StatusCode::NoSuchFile =>
            {
                owner.admit()?;
                let mut attrs = FileAttributes::empty();
                attrs.permissions = Some(0o40700);
                ack(session
                    .sftp
                    .mkdir(&path, attrs)
                    .await
                    .map_err(|_| Error::Transport)?)?;
            }
            _ => return Err(Error::Root),
        }
        let actual = session
            .sftp
            .realpath(&path)
            .await
            .map_err(|_| Error::Root)?;
        if actual.files.len() != 1 || actual.files[0].filename != path {
            return Err(Error::Root);
        }
    }
    Ok(())
}
async fn read_file(
    session: &Session,
    request: &Request,
    owner: &mut dyn NativeReceipt,
    mut output: Option<&mut File>,
) -> Result<()> {
    let size = request.validate()?;
    owner.admit()?;
    parents(session, request, owner, false).await?;
    let path = request.path(&request.final_path);
    regular(
        &session
            .sftp
            .lstat(&path)
            .await
            .map_err(|_| Error::Transport)?
            .attrs,
        size,
    )?;
    owner.admit()?;
    let handle = session
        .sftp
        .open(&path, OpenFlags::READ, FileAttributes::empty())
        .await
        .map_err(|_| Error::Transport)?
        .handle;
    regular(
        &session
            .sftp
            .fstat(&handle)
            .await
            .map_err(|_| Error::Transport)?
            .attrs,
        size,
    )?;
    let mut hash = Sha256::new();
    let mut offset = 0;
    while offset < size {
        owner.admit()?;
        let wanted = (size - offset).min(32768) as u32;
        let data = session
            .sftp
            .read(&handle, offset, wanted)
            .await
            .map_err(|_| Error::Transport)?
            .data;
        if data.is_empty() || data.len() > wanted as usize {
            return Err(Error::Verification);
        }
        if let Some(file) = output.as_deref_mut() {
            file.write_all(&data).map_err(|_| Error::Local)?;
        }
        hash.update(&data);
        offset += data.len() as u64;
    }
    match session.sftp.read(&handle, size, 1).await {
        Err(SftpError::Status(status)) if status.status_code == StatusCode::Eof => {}
        _ => return Err(Error::Verification),
    }
    regular(
        &session
            .sftp
            .fstat(&handle)
            .await
            .map_err(|_| Error::Transport)?
            .attrs,
        size,
    )?;
    ack(session
        .sftp
        .close(handle)
        .await
        .map_err(|_| Error::Transport)?)?;
    if <[u8; 32]>::from(hash.finalize()) != request.sha256 {
        return Err(Error::Verification);
    }
    parents(session, request, owner, false).await?;
    owner.admit()?;
    Ok(())
}
pub async fn download(
    session: &Session,
    request: &Request,
    owner: &mut dyn NativeReceipt,
    output: &mut File,
) -> Result<()> {
    let info = output.metadata().map_err(|_| Error::Local)?;
    if !info.is_file()
        || info.len() != 0
        || info.nlink() != 1
        || info.mode() & 0o077 != 0
        || info.mode() & 0o200 == 0
    {
        return Err(Error::Local);
    }
    output.seek(SeekFrom::Start(0)).map_err(|_| Error::Local)?;
    read_file(session, request, owner, Some(output)).await?;
    output.sync_all().map_err(|_| Error::Local)?;
    Ok(())
}
pub async fn publish(
    session: &Session,
    request: &Request,
    owner: &mut dyn NativeReceipt,
    snapshot: &mut File,
) -> Result<()> {
    let size = request.validate()?;
    if !snapshot.metadata().map_err(|_| Error::Local)?.is_file()
        || snapshot.metadata().map_err(|_| Error::Local)?.len() != size
    {
        return Err(Error::Source);
    }
    snapshot
        .seek(SeekFrom::Start(0))
        .map_err(|_| Error::Local)?;
    owner.admit()?;
    parents(session, request, owner, true).await?;
    owner.admit()?;
    let stage = request.path(&request.stage());
    let final_path = request.path(&request.final_path);
    let mut attrs = FileAttributes::empty();
    attrs.permissions = Some(0o100600);
    let handle = session
        .sftp
        .open(
            &stage,
            OpenFlags::CREATE | OpenFlags::EXCLUDE | OpenFlags::WRITE,
            attrs,
        )
        .await
        .map_err(|_| Error::Transport)?
        .handle;
    owner.record(Ack::Created)?;
    regular(
        &session
            .sftp
            .fstat(&handle)
            .await
            .map_err(|_| Error::Transport)?
            .attrs,
        0,
    )?;
    let canonical = session
        .sftp
        .realpath(&stage)
        .await
        .map_err(|_| Error::Root)?;
    if canonical.files.len() != 1 || canonical.files[0].filename != stage {
        return Err(Error::Root);
    }
    let mut offset = 0;
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 32768];
    while offset < size {
        owner.admit()?;
        let count = (size - offset).min(buffer.len() as u64) as usize;
        snapshot
            .read_exact(&mut buffer[..count])
            .map_err(|_| Error::Source)?;
        hash.update(&buffer[..count]);
        ack(session
            .sftp
            .write(&handle, offset, buffer[..count].to_vec())
            .await
            .map_err(|_| Error::Transport)?)?;
        offset += count as u64;
    }
    if snapshot.read(&mut buffer[..1]).map_err(|_| Error::Source)? != 0
        || <[u8; 32]>::from(hash.finalize()) != request.sha256
    {
        return Err(Error::Source);
    }
    owner.admit()?;
    ack(session
        .sftp
        .fsync(&handle)
        .await
        .map_err(|_| Error::Transport)?)?;
    owner.record(Ack::DataFlushed(size))?;
    ack(session
        .sftp
        .close(handle)
        .await
        .map_err(|_| Error::Transport)?)?;
    owner.record(Ack::Closed)?;
    owner.admit()?;
    parents(session, request, owner, false).await?;
    owner.admit()?;
    // SFTPv3 RENAME refuses an existing destination; never use the overwrite-capable POSIX extension.
    ack(session
        .sftp
        .rename(&stage, &final_path)
        .await
        .map_err(|_| Error::Transport)?)?;
    owner.record(Ack::Renamed)?;
    // Verify through a fresh remote handle without materializing the whole file in memory.
    read_file(session, request, owner, None).await?;
    owner.record(Ack::BytesVerified)?;
    Ok(())
}
