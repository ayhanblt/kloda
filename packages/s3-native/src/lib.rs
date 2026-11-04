//! Native-only Sans-IO S3 preparation. No network, credential discovery, FFI or retry.
mod reply;
mod request;
pub use reply::{Reply, completion, creation};
pub use request::{Operation, Prepared, prepare};
pub use rusty_s3::Credentials;
use rusty_s3::{Bucket, UrlStyle};
use url::Url;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Invalid,
}
pub type Result<T> = std::result::Result<T, Error>;
#[derive(Clone, Copy)]
pub enum Provider {
    Compatible,
    Amazon,
}
pub struct Target {
    bucket: Bucket,
    prefix: String,
}
impl Target {
    pub fn new(
        provider: Provider,
        endpoint: &str,
        region: &str,
        bucket: &str,
        prefix: &str,
        path_style: bool,
    ) -> Result<Self> {
        let url = Url::parse(endpoint).map_err(|_| Error::Invalid)?;
        if url.scheme() != "https"
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || url.path() != "/"
            || region.is_empty()
            || region.len() > 63
            || !region
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
            || !(3..=63).contains(&bucket.len())
            || bucket.parse::<std::net::Ipv4Addr>().is_ok()
            || bucket
                .split('.')
                .any(|label| label.is_empty() || label.starts_with('-') || label.ends_with('-'))
            || !bucket
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'-' | b'.'))
            || (!prefix.is_empty() && !safe_key(prefix))
        {
            return Err(Error::Invalid);
        }
        if matches!(provider, Provider::Amazon)
            && (url.port().is_some()
                || url.host_str() != Some(format!("s3.{region}.amazonaws.com").as_str()))
        {
            return Err(Error::Invalid);
        }
        let style = if path_style {
            UrlStyle::Path
        } else {
            UrlStyle::VirtualHost
        };
        let bucket = Bucket::new(url, style, bucket.to_owned(), region.to_owned())
            .map_err(|_| Error::Invalid)?;
        Ok(Self {
            bucket,
            prefix: prefix.to_owned(),
        })
    }
    fn key(&self, key: &str) -> Result<String> {
        if !safe_key(key) {
            return Err(Error::Invalid);
        }
        let key = if self.prefix.is_empty() {
            key.to_owned()
        } else {
            format!("{}/{key}", self.prefix)
        };
        if key.len() > 1024 {
            return Err(Error::Invalid);
        }
        Ok(key)
    }
    pub fn bucket(&self) -> &str {
        self.bucket.name()
    }
}
fn safe_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 1024
        && !key
            .chars()
            .any(|c| c.is_control() || matches!(c, '\\' | '%' | '?' | '#'))
        && key.split('/').all(|part| !matches!(part, "" | "." | ".."))
}
fn opaque(value: &str) -> bool {
    !value.is_empty() && value.len() <= 2048 && !value.chars().any(char::is_control)
}

mod bridge;
