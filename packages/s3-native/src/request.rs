use crate::{Credentials, Error, Result, Target, opaque};
use rusty_s3::{S3Action, actions::*};
use std::time::Duration;
pub enum Operation<'a> {
    Create {
        job: &'a str,
    },
    Part {
        upload: &'a str,
        number: u16,
    },
    Complete {
        upload: &'a str,
        etags: &'a [String],
    },
    Abort {
        upload: &'a str,
    },
    Parts {
        upload: &'a str,
        marker: u16,
    },
    Get {
        version: Option<&'a str>,
    },
    Head,
}
// Deliberately no Debug/Serialize: signed URLs are bearer credentials, not UI data.
pub struct Prepared {
    pub method: &'static str,
    url: url::Url,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}
impl Prepared {
    pub fn url(&self) -> &url::Url {
        &self.url
    }
}
fn signed<'a, A: S3Action<'a>>(action: &mut A, headers: &[(&'a str, &'a str)]) -> Prepared {
    for (key, value) in headers {
        action.headers_mut().insert(*key, *value);
    }
    let method = match A::METHOD {
        rusty_s3::Method::Get => "GET",
        rusty_s3::Method::Head => "HEAD",
        rusty_s3::Method::Post => "POST",
        rusty_s3::Method::Put => "PUT",
        rusty_s3::Method::Delete => "DELETE",
    };
    Prepared {
        method,
        url: action.sign(Duration::from_secs(60)),
        headers: headers
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect(),
        body: vec![],
    }
}
/// Call only inside current native context; never persist or log the returned URL.
/// The transport must prohibit redirects/replay, validate TLS, bound bodies and recheck context.
pub fn prepare(
    target: &Target,
    credentials: &Credentials,
    key: &str,
    op: Operation<'_>,
) -> Result<Prepared> {
    if credentials.key().is_empty()
        || credentials.key().len() > 256
        || credentials.secret().is_empty()
        || credentials.secret().len() > 4096
        || credentials
            .token()
            .is_some_and(|t| !opaque(t) || t.len() > 2048)
    {
        return Err(Error::Invalid);
    }
    let key = target.key(key)?;
    let b = &target.bucket;
    let c = Some(credentials);
    let request = match op {
        Operation::Create { job } => {
            if job.len() != 32 || !job.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Err(Error::Invalid);
            }
            signed(
                &mut CreateMultipartUpload::new(b, c, &key),
                &[("x-amz-meta-kloda-job", job)],
            )
        }
        Operation::Part { upload, number } => {
            if !opaque(upload) || !(1..=10000).contains(&number) {
                return Err(Error::Invalid);
            }
            signed(&mut UploadPart::new(b, c, &key, number, upload), &[])
        }
        Operation::Complete { upload, etags } => {
            if !opaque(upload)
                || etags.is_empty()
                || etags.len() > 10000
                || etags.iter().any(|v| !opaque(v) || v.len() > 1024)
            {
                return Err(Error::Invalid);
            }
            let mut action =
                CompleteMultipartUpload::new(b, c, &key, upload, etags.iter().map(String::as_str));
            let mut request = signed(&mut action, &[("if-none-match", "*")]);
            request.body = action.body().into_bytes();
            request
        }
        Operation::Abort { upload } => {
            if !opaque(upload) {
                return Err(Error::Invalid);
            }
            signed(&mut AbortMultipartUpload::new(b, c, &key, upload), &[])
        }
        Operation::Parts { upload, marker } => {
            if !opaque(upload) || marker > 10000 {
                return Err(Error::Invalid);
            }
            let mut action = ListParts::new(b, c, &key, upload);
            action.set_max_parts(32);
            action.set_part_number_marker(marker);
            signed(&mut action, &[])
        }
        Operation::Get { version } => {
            let mut action = GetObject::new(b, c, &key);
            if let Some(v) = version {
                if !opaque(v) {
                    return Err(Error::Invalid);
                }
                action.query_mut().insert("versionId", v);
            }
            signed(&mut action, &[])
        }
        Operation::Head => signed(&mut HeadObject::new(b, c, &key), &[]),
    };
    Ok(request)
}
