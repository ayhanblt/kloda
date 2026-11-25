use crate::backup_root::{self, Directories};
use crate::file_protocol::{Error, Result};
use cap_std::fs::Dir;
use ring::digest::{Context, SHA256};
use rusqlite::{params, Connection, OptionalExtension};
use std::io::{ErrorKind, Read};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct PathRecord {
    pub(crate) folder: String,
    pub(crate) filename: String,
}

pub(crate) fn lookup(conn: &Connection, id: &str) -> Result<Option<PathRecord>> {
    conn.query_row(
        "SELECT folder, filename FROM backup_paths WHERE id=?1",
        params![id],
        |r| {
            Ok(PathRecord {
                folder: r.get(0)?,
                filename: r.get(1)?,
            })
        },
    )
    .optional()
    .map_err(crate::file_receiver::rows::storage)
}

pub(crate) fn staging_dir(dirs: &Directories, modern: bool, create: bool) -> Result<Dir> {
    if modern {
        Ok(dirs.staging(create)?)
    } else {
        dirs.peer.try_clone().map_err(|e| Error::from(backup_root::target_error(e)))
    }
}

pub(crate) fn objects_dir(dirs: &Directories, modern: bool, create: bool) -> Result<Dir> {
    if modern {
        Ok(dirs.objects(create)?)
    } else {
        dirs.peer.try_clone().map_err(|e| Error::from(backup_root::target_error(e)))
    }
}

fn truncate_fit(s: &str, max_bytes: usize, max_utf16: usize) -> &str {
    let mut end = 0;
    let mut utf16 = 0;
    for (idx, ch) in s.char_indices() {
        let next_bytes = idx + ch.len_utf8();
        let next_utf16 = utf16 + ch.len_utf16();
        if next_bytes > max_bytes || next_utf16 > max_utf16 {
            break;
        }
        end = next_bytes;
        utf16 = next_utf16;
    }
    &s[..end]
}

pub(crate) fn candidate_name(original: &str, attempt: usize, id: &str) -> String {
    if attempt <= 1 {
        return original.to_owned();
    }
    let (stem, ext) = match original.rfind('.') {
        Some(pos) if pos > 0 => (&original[..pos], &original[pos..]),
        _ => (original, ""),
    };
    let suffix = if attempt <= 10_000 {
        format!(" ({attempt})")
    } else {
        format!(" ({})", &id[..8])
    };
    let suf_bytes = suffix.len();
    let suf_utf16 = suffix.encode_utf16().count();
    let ext_fit = if ext.len() + suf_bytes < 255 && ext.encode_utf16().count() + suf_utf16 < 255 {
        ext
    } else {
        ""
    };
    let max_bytes = 255usize.saturating_sub(suf_bytes + ext_fit.len());
    let max_utf16 = 255usize.saturating_sub(suf_utf16 + ext_fit.encode_utf16().count());
    let stem_fit = truncate_fit(stem, max_bytes, max_utf16).trim_end_matches(['.', ' ']);
    let candidate = if !stem_fit.is_empty() {
        format!("{stem_fit}{suffix}{ext_fit}")
    } else if !ext_fit.is_empty() {
        format!("{}{}", suffix.trim_start(), ext_fit)
    } else {
        format!("file{suffix}")
    };
    if crate::file_schema::safe_name(&candidate) {
        candidate
    } else {
        format!("{}_{}", &id[..8], attempt)
    }
}

pub(crate) fn link_visible(
    src_dir: &Dir,
    src_name: &str,
    expected_identity: &[u8; 24],
    dst_dir: &Dir,
    desired_name: &str,
    id: &str,
) -> Result<String> {
    for attempt in 1..=10_001 {
        let candidate = candidate_name(desired_name, attempt, id);
        match src_dir.hard_link(src_name, dst_dir, &candidate) {
            Ok(()) => return Ok(candidate),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                if let Ok(file) = backup_root::open_visible_file(dst_dir, &candidate, false) {
                    if backup_root::file_identity(&file)
                        .is_ok_and(|identity| &identity == expected_identity)
                    {
                        return Ok(candidate);
                    }
                }
            }
            Err(error) => return Err(backup_root::target_error(error).into()),
        }
    }
    Err(Error::Conflict)
}

fn is_regular_entry(metadata: &cap_std::fs::Metadata) -> bool {
    if !metadata.is_file() || metadata.is_symlink() {
        return false;
    }
    #[cfg(windows)]
    {
        use cap_std::fs::MetadataExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return false;
        }
    }
    true
}

pub(crate) fn remove_visible_if_owned(
    dirs: &Directories,
    record: &PathRecord,
    expected_identity: &[u8; 24],
    expected_size: u64,
    expected_sha256: &str,
) -> Result<()> {
    if record.folder.is_empty() || record.filename.is_empty() {
        return Ok(());
    }
    match dirs.peer.symlink_metadata(&record.folder) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(backup_root::target_error(error).into()),
        Ok(_) => (),
    }
    let dir = dirs.visible_dir(&record.folder, false)?;
    match dir.symlink_metadata(&record.filename) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(backup_root::target_error(error).into()),
        Ok(meta) if !is_regular_entry(&meta) => return Ok(()),
        Ok(_) => (),
    }
    let mut file = backup_root::open_visible_file(&dir, &record.filename, false)?;
    if backup_root::file_identity(&file)? != *expected_identity {
        return Ok(());
    }
    let io = |e: std::io::Error| Error::from(backup_root::target_error(e));
    if file.metadata().map_err(io)?.len() != expected_size {
        return Err(Error::Conflict);
    }
    let mut digest = Context::new(&SHA256);
    let mut bytes = [0; 65536];
    loop {
        let len = file.read(&mut bytes).map_err(io)?;
        if len == 0 {
            break;
        }
        digest.update(&bytes[..len]);
    }
    if crate::qr_base64::encode(digest.finish().as_ref()) != expected_sha256 {
        return Err(Error::HashMismatch);
    }
    dir.remove_file(&record.filename).map_err(io)?;
    backup_root::sync_dir(&dir)?;
    Ok(())
}

pub(crate) fn remove_visible_after_promotion(
    dirs: &Directories,
    old_filename: &str,
    expected_identity: &[u8; 24],
) -> Result<()> {
    if old_filename.is_empty() {
        return Ok(());
    }
    match dirs.peer.symlink_metadata("Files") {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(backup_root::target_error(error).into()),
        Ok(_) => (),
    }
    let dir = dirs.visible_dir("Files", false)?;
    match dir.symlink_metadata(old_filename) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(backup_root::target_error(error).into()),
        Ok(meta) if !is_regular_entry(&meta) => return Ok(()),
        Ok(_) => (),
    }
    let file = backup_root::open_visible_file(&dir, old_filename, false)?;
    if backup_root::file_identity(&file)? != *expected_identity {
        return Ok(());
    }
    let io = |e: std::io::Error| Error::from(backup_root::target_error(e));
    dir.remove_file(old_filename).map_err(io)?;
    backup_root::sync_dir(&dir)?;
    Ok(())
}
