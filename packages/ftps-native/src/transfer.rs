use crate::{Error, Event, Request, Result, Session};
use sha2::{Digest, Sha256};
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom, Write},
};
fn source(file: &mut File, r: &Request, s: &Session) -> Result<()> {
    let expected = r.validate()?;
    let meta = file.metadata().map_err(|_| Error::Local)?;
    if !meta.is_file() || meta.len() != expected {
        return Err(Error::Source);
    }
    file.rewind().map_err(|_| Error::Local)?;
    let mut hash = Sha256::new();
    let mut n = 0u64;
    let mut buf = [0u8; 32768];
    loop {
        s.owner.current()?;
        let len = file.read(&mut buf).map_err(|_| Error::Source)?;
        if len == 0 {
            break;
        }
        n = n.checked_add(len as u64).ok_or(Error::Source)?;
        if n > expected {
            return Err(Error::Source);
        }
        hash.update(&buf[..len]);
    }
    if n != expected || <[u8; 32]>::from(hash.finalize()) != r.sha256 {
        return Err(Error::Source);
    }
    file.rewind().map_err(|_| Error::Local)?;
    Ok(())
}
impl Session {
    fn parent(&mut self, r: &Request, writing: bool) -> Result<String> {
        self.owner.current()?;
        let (parent, name) = r.final_path.rsplit_once('/').unwrap_or(("", &r.final_path));
        let path = if parent.is_empty() {
            r.root.clone()
        } else {
            format!("{}/{}", r.root.trim_end_matches('/'), parent)
        };
        self.ftp.cwd(&r.root).map_err(|_| Error::Root)?;
        if self.ftp.pwd().map_err(|_| Error::Root)? != r.root {
            return Err(Error::Root);
        }
        if !parent.is_empty() {
            for part in parent.split('/') {
                self.owner.current()?;
                let entries = self.ftp.nlst(None).map_err(|_| Error::Transport)?;
                if !entries.iter().any(|p| p.rsplit('/').next() == Some(part)) {
                    if !writing {
                        return Err(Error::Root);
                    }
                    self.owner.current()?;
                    self.ftp.mkdir(part).map_err(|_| Error::Root)?;
                }
                self.owner.current()?;
                self.ftp.cwd(part).map_err(|_| Error::Root)?;
            }
        }
        if self.ftp.pwd().map_err(|_| Error::Root)? != path {
            return Err(Error::Root);
        }
        self.owner.current()?;
        Ok(name.to_owned())
    }
    fn verify(&mut self, r: &Request, name: &str, mut output: Option<&mut File>) -> Result<()> {
        let expected = r.validate()?;
        self.owner.current()?;
        let mut stream = self
            .ftp
            .retr_as_stream(name)
            .map_err(|_| Error::Transport)?;
        let mut hash = Sha256::new();
        let mut offset = 0u64;
        let mut buffer = [0u8; 32768];
        loop {
            self.owner.current()?;
            let bound = (expected.saturating_sub(offset)).min(buffer.len() as u64 - 1) as usize + 1;
            let len = stream
                .read(&mut buffer[..bound])
                .map_err(|_| Error::Transport)?;
            if len == 0 {
                break;
            }
            offset = offset.checked_add(len as u64).ok_or(Error::Verification)?;
            if offset > expected {
                return Err(Error::Verification);
            }
            hash.update(&buffer[..len]);
            if let Some(file) = output.as_deref_mut() {
                file.write_all(&buffer[..len]).map_err(|_| Error::Local)?;
            }
        }
        stream.finish().map_err(|_| Error::Transport)?;
        if offset != expected || <[u8; 32]>::from(hash.finalize()) != r.sha256 {
            return Err(Error::Verification);
        }
        self.owner.current()?;
        Ok(())
    }
    pub fn publish(&mut self, r: &Request, snapshot: &mut File) -> Result<()> {
        source(snapshot, r, self)?;
        let name = self.parent(r, true)?;
        let entries = self.ftp.nlst(None).map_err(|_| Error::Transport)?;
        if entries.iter().any(|p| p.rsplit('/').next() == Some(&name)) {
            return Err(Error::Exists);
        }
        self.owner.current()?;
        // Intent is durable before STOR; unknown outcomes cannot become a retry or owned receipt.
        self.owner.record(Event::Intent, 0)?;
        self.owner.current()?;
        let mut stream = self
            .ftp
            .put_with_stream(&name)
            .map_err(|_| Error::Transport)?;
        let mut buffer = [0u8; 32768];
        let mut hash = Sha256::new();
        let mut n = 0u64;
        loop {
            self.owner.current()?;
            let len = snapshot.read(&mut buffer).map_err(|_| Error::Source)?;
            if len == 0 {
                break;
            }
            n = n.checked_add(len as u64).ok_or(Error::Source)?;
            if n > r.validate()? {
                return Err(Error::Source);
            }
            hash.update(&buffer[..len]);
            stream
                .write_all(&buffer[..len])
                .map_err(|_| Error::Transport)?;
        }
        if n != r.validate()? || <[u8; 32]>::from(hash.finalize()) != r.sha256 {
            return Err(Error::Source);
        }
        self.owner.current()?;
        stream.finish().map_err(|_| Error::Transport)?;
        self.owner.record(Event::Uploaded, n)?;
        self.verify(r, &name, None)?;
        self.owner.record(Event::Verified, 0)?;
        Ok(())
    }
    pub fn download(&mut self, r: &Request, output: &mut File) -> Result<()> {
        r.validate()?;
        let m = output.metadata().map_err(|_| Error::Local)?;
        #[cfg(unix)]
        if m.nlink() != 1 || m.mode() & 0o077 != 0 {
            return Err(Error::Local);
        }
        if !m.is_file() || m.len() != 0 {
            return Err(Error::Local);
        }
        output.seek(SeekFrom::Start(0)).map_err(|_| Error::Local)?;
        let name = self.parent(r, false)?;
        self.verify(r, &name, Some(output))?;
        output.sync_all().map_err(|_| Error::Local)?;
        Ok(())
    }
}
