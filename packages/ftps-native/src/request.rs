use crate::{Error, Result};
use serde::Deserialize;
use zeroize::Zeroizing;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub address: std::net::IpAddr,
    pub port: u16,
    pub hostname: String,
    pub username: String,
    // Owned credential copy is wiped on Drop; JVM/Swift, Serde scratch and suppaftp/TLS copies are not covered.
    pub password: Zeroizing<String>,
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
    fn json(password: &str, tail: &str) -> String {
        format!(
            r#"{{"address":"127.0.0.1","port":990,"hostname":"nas.local","username":"probe","password":{password},"root":"/","operationId":"12345678-1234-4321-8765-123456789abc","finalPath":"a/b.bin","size":"3","sha256":[{zeros}],"responseTimeoutMs":5000{tail}}}"#,
            zeros = ["0"; 32].join(",")
        )
    }
    fn parse(text: &str) -> Option<Request> {
        serde_json::from_str(text).ok()
    }
    fn wipes_on_drop<T: zeroize::ZeroizeOnDrop>(_: &T) {}
    #[test]
    fn password_is_owned_zeroizing_and_valid_request_decodes() {
        let mut r = parse(&json(r#""s3cr\u00e7t""#, "")).unwrap();
        assert_eq!(r.validate(), Ok(3));
        assert_eq!(r.password.as_str(), "s3cr\u{e7}t");
        wipes_on_drop(&r.password);
        // Primitive behaviour only; Drop runs the same Zeroize::zeroize (zeroize 1.9.1 lib.rs:695-704).
        zeroize::Zeroize::zeroize(&mut *r.password);
        assert!(r.password.is_empty());
    }
    #[test]
    fn password_byte_bounds_and_control_rejected() {
        let ok = |p: String| {
            parse(&json(&serde_json::to_string(&p).unwrap(), ""))
                .unwrap()
                .validate()
        };
        assert_eq!(ok(String::new()), Err(Error::Invalid));
        assert_eq!(ok("a".repeat(4096)), Ok(3));
        assert_eq!(ok("a".repeat(4097)), Err(Error::Invalid));
        assert_eq!(ok("\u{11f}".repeat(2048)), Ok(3));
        assert_eq!(ok("\u{11f}".repeat(2049)), Err(Error::Invalid));
        for c in ["a\nb", "a\u{0}b", "a\u{7f}b", "a\rPASS b"] {
            assert_eq!(ok(c.into()), Err(Error::Invalid));
        }
        assert!(parse(&json("\"a\nb\"", "")).is_none());
    }
    #[test]
    fn parse_failures_after_password_are_rejected() {
        let p = r#""secret""#;
        assert!(parse(&json(p, "")).is_some());
        assert!(parse(&json(p, r#","extra":1"#)).is_none());
        assert!(parse(&json(p, r#","password":"again""#)).is_none());
        assert!(parse(&json(p, r#","port":"#)).is_none());
        assert!(parse(&json(p, "").replace(r#","responseTimeoutMs":5000"#, "")).is_none());
        assert!(parse(&json(p, "").replace(r#""size":"3""#, r#""size":3"#)).is_none());
        assert!(parse(&json("1", "")).is_none());
    }
    #[test]
    fn literal_paths() {
        for p in ["", "/a", "a//b", "a/../b", "a\\b", "a\r\nDELE b"] {
            assert!(!relative(p));
        }
        assert!(relative("Fotoğraflar/file.bin"));
    }
}
