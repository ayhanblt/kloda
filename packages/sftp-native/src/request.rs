use crate::{Error, Result};
use russh::keys::ssh_key::{Fingerprint, HashAlg};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub address: std::net::IpAddr,
    pub port: u16,
    pub fingerprint: String,
    pub username: String,
    pub password: String,
    pub root: String,
    pub operation_id: String,
    pub final_path: String,
    pub size: String,
    pub sha256: [u8; 32],
    pub response_timeout_ms: u32,
}
pub fn relative(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 4096
        && !path.contains('\\')
        && path.split('/').all(|p| {
            !p.is_empty()
                && p != "."
                && p != ".."
                && p.len() <= 255
                && !p.chars().any(char::is_control)
        })
}
pub fn uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_digit() || (b'a'..=b'f').contains(&b)
            }
        })
}
impl Request {
    pub fn validate(&self) -> Result<u64> {
        let pin: Fingerprint = self.fingerprint.parse().map_err(|_| Error::Invalid)?;
        let size = self.size.parse::<i64>().map_err(|_| Error::Invalid)?;
        if pin.algorithm() != HashAlg::Sha256
            || pin.to_string() != self.fingerprint
            || self.port == 0
            || self.username.is_empty()
            || self.username.len() > 1024
            || self.username.chars().any(char::is_control)
            || self.password.is_empty()
            || self.password.len() > 4096
            || self.password.contains('\0')
            || !(self.root == "/" || self.root.starts_with('/') && relative(&self.root[1..]))
            || !uuid(&self.operation_id)
            || !relative(&self.final_path)
            || self
                .final_path
                .rsplit('/')
                .next()
                .is_some_and(|p| p.to_lowercase().starts_with(".kloda-"))
            || size < 0
            || size.to_string() != self.size
            || !(1..=30000).contains(&self.response_timeout_ms)
        {
            return Err(Error::Invalid);
        }
        Ok(size as u64)
    }
    pub fn path(&self, relative: &str) -> String {
        format!("{}/{}", self.root.trim_end_matches('/'), relative)
    }
    pub fn stage(&self) -> String {
        let name = format!(".kloda-sftp-{}.part", self.operation_id);
        self.final_path
            .rsplit_once('/')
            .map_or(name.clone(), |(parent, _)| format!("{parent}/{name}"))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paths_are_literal_and_bounded_without_traversal() {
        for p in ["", "/root", "a//b", "a/../b", "a/./b", "a\\b", "a\0b"] {
            assert!(!relative(p));
        }
        for p in ["owned/file.bin", "Fotoğraflar/çocuk.png", "a:b"] {
            assert!(relative(p));
        }
        assert!(uuid("12345678-1234-4321-8765-123456789abc"));
        assert!(!uuid("12345678-1234-4321-8765-123456789ABC"));
    }
}
