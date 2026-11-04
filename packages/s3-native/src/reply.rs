use quick_xml::{Reader, events::Event};
use serde::Deserialize;
#[derive(Debug, PartialEq, Eq)]
pub enum Reply {
    Created { upload: String },
    CompletionAck { etag: String },
    Conflict,
    Reinitialize,
    Rejected,
    Review,
}
// A response ACK is not Completed. Native journal ACK + current-context full readback are required.
fn status(status: u16) -> Option<Reply> {
    match status {
        200 => None,
        412 => Some(Reply::Conflict),
        409 => Some(Reply::Reinitialize),
        400 | 401 | 403 => Some(Reply::Rejected),
        _ => Some(Reply::Review),
    }
}
fn valid_xml(data: &[u8], expected: &[u8]) -> bool {
    if data.len() > 65536 {
        return false;
    }
    let mut reader = Reader::from_reader(data);
    reader.config_mut().check_end_names = true;
    reader.config_mut().check_comments = true;
    let (mut depth, mut seen, mut closed) = (0, false, false);
    let mut declaration = false;
    loop {
        match reader.read_event() {
            Ok(event @ (Event::Start(_) | Event::Empty(_))) => {
                let empty = matches!(&event, Event::Empty(_));
                let e = match event {
                    Event::Start(e) | Event::Empty(e) => e,
                    _ => unreachable!(),
                };
                if depth == 0 {
                    if seen || e.name().as_ref() != expected {
                        return false;
                    }
                    seen = true;
                }
                for a in e.attributes() {
                    let Ok(a) = a else {
                        return false;
                    };
                    if a.decoded_and_normalized_value(
                        quick_xml::XmlVersion::Implicit1_0,
                        reader.decoder(),
                    )
                    .is_err()
                    {
                        return false;
                    }
                    if a.key.as_ref() == b"xmlns"
                        && a.value.as_ref() != b"http://s3.amazonaws.com/doc/2006-03-01/"
                    {
                        return false;
                    }
                }
                if empty {
                    if depth == 0 {
                        closed = true;
                    }
                } else {
                    depth += 1;
                }
                if depth > 32 {
                    return false;
                }
            }
            Ok(Event::End(_)) => {
                if depth == 0 {
                    return false;
                }
                depth -= 1;
                if depth == 0 {
                    closed = true;
                }
            }
            Ok(Event::GeneralRef(e)) => {
                if depth == 0
                    || (e.resolve_char_ref().ok().flatten().is_none()
                        && !matches!(e.as_ref(), b"amp" | b"lt" | b"gt" | b"quot" | b"apos"))
                {
                    return false;
                }
            }
            Ok(Event::DocType(_) | Event::PI(_) | Event::CData(_)) | Err(_) => return false,
            Ok(Event::Text(e)) if depth == 0 && !e.as_ref().iter().all(u8::is_ascii_whitespace) => {
                return false;
            }
            Ok(Event::Decl(_)) => {
                if declaration || seen || depth != 0 {
                    return false;
                }
                declaration = true;
            }
            Ok(Event::Eof) => break,
            _ => {}
        }
    }
    seen && closed && depth == 0
}
#[derive(Deserialize)]
struct Created {
    #[serde(rename = "Bucket")]
    bucket: String,
    #[serde(rename = "Key")]
    key: String,
    #[serde(rename = "UploadId")]
    upload: String,
}
pub fn creation(status_code: u16, body: &[u8], bucket: &str, key: &str) -> Reply {
    if let Some(reply) = status(status_code) {
        return reply;
    }
    if !valid_xml(body, b"InitiateMultipartUploadResult") {
        return Reply::Review;
    }
    match quick_xml::de::from_reader::<_, Created>(body) {
        Ok(value) if value.bucket == bucket && value.key == key && crate::opaque(&value.upload) => {
            Reply::Created {
                upload: value.upload,
            }
        }
        _ => Reply::Review,
    }
}
#[derive(Deserialize)]
struct Complete {
    #[serde(rename = "Bucket")]
    bucket: String,
    #[serde(rename = "Key")]
    key: String,
    #[serde(rename = "ETag")]
    etag: String,
}
pub fn completion(status_code: u16, body: &[u8], bucket: &str, key: &str) -> Reply {
    if let Some(reply) = status(status_code) {
        return reply;
    }
    if !valid_xml(body, b"CompleteMultipartUploadResult") {
        return Reply::Review;
    }
    match quick_xml::de::from_reader::<_, Complete>(body) {
        Ok(value) if value.bucket == bucket && value.key == key && crate::opaque(&value.etag) => {
            Reply::CompletionAck { etag: value.etag }
        }
        _ => Reply::Review,
    }
}
