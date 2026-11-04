use crate::{Error, Result};
use serde::Deserialize;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub address: std::net::IpAddr,
    pub port: u16,
    pub hostname: String,
    pub username: String,
    pub password: String,
    pub root: String,
    pub operation_id: String,
    pub final_path: String,
    pub size: String,
    pub sha256: [u8; 32],
    pub response_timeout_ms: u32,
}
pub fn relative(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 4096
        && !s.contains('\\')
        && s.split('/').all(|p| {
            !p.is_empty()
                && p != "."
                && p != ".."
                && p.len() <= 255
                && !p.chars().any(char::is_control)
        })
}
impl Request {
    pub fn validate(&self) -> Result<u64> {
        let size = self.size.parse::<i64>().map_err(|_| Error::Invalid)?;
        let uuid = self.operation_id.len() == 36
            && self.operation_id.bytes().enumerate().all(|(i, b)| {
                if [8, 13, 18, 23].contains(&i) {
                    b == b'-'
                } else {
                    b.is_ascii_digit() || (b'a'..=b'f').contains(&b)
                }
            });
        let hostname = !self.hostname.is_empty()
            && self.hostname.len() <= 253
            && self.hostname.is_ascii()
            && self.hostname.split('.').all(|s| {
                !s.is_empty()
                    && s.len() <= 63
                    && !s.starts_with('-')
                    && !s.ends_with('-')
                    && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
            });
        if !uuid
            || !hostname
            || self.port == 0
            || size < 0
            || size.to_string() != self.size
            || self.username.is_empty()
            || self.username.len() > 1024
            || self.username.chars().any(char::is_control)
            || self.password.is_empty()
            || self.password.len() > 4096
            || self.password.chars().any(char::is_control)
            || !(self.root == "/" || self.root.starts_with('/') && relative(&self.root[1..]))
            || !relative(&self.final_path)
            || !(1..=30000).contains(&self.response_timeout_ms)
        {
            return Err(Error::Invalid);
        }
        Ok(size as u64)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn literal_paths() {
        for p in ["", "/a", "a//b", "a/../b", "a\\b", "a\r\nDELE b"] {
            assert!(!relative(p));
        }
        assert!(relative("Fotoğraflar/file.bin"));
    }
}
