use std::{io::{Read, Write}, net::TcpListener, thread, time::Duration};
use s3::{Bucket, Region, creds::Credentials, serde_types::Part};
fn receive(stream: &mut std::net::TcpStream) -> String {
    stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
    let mut data = Vec::new();
    loop {
        let mut buf = [0; 4096];
        let n = stream.read(&mut buf).unwrap();
        assert!(n > 0);
        data.extend_from_slice(&buf[..n]);
        if let Some(end) = data.windows(4).position(|x| x == b"\r\n\r\n") {
            let headers = String::from_utf8_lossy(&data[..end]).to_lowercase();
            let length: usize = headers.lines().find_map(|x| x.strip_prefix("content-length: ")).unwrap_or("0").parse().unwrap();
            if data.len() >= end + 4 + length { break; }
        }
    }
    String::from_utf8(data).unwrap()
}
fn bucket(port: u16) -> Box<Bucket> {
    Bucket::new("owned-test", Region::Custom {region: "us-east-1".into(), endpoint: format!("http://127.0.0.1:{port}")}, Credentials::new(Some("synthetic-key"),Some("synthetic-secret"),None,None,None).unwrap()).unwrap().with_path_style()
}
fn complete(bucket: &Bucket) -> Result<s3::request::ResponseData, s3::error::S3Error> {
    bucket.complete_multipart_upload("own-key", "own-upload", vec![Part {part_number:1, etag:"own-part".into()}])
}
fn main() {
    // Synthetic loopback only: no TLS, vendor, custody or publication acceptance.
    for status in [200, 412, 409, 0] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let request = receive(&mut stream);
            assert!(request.to_lowercase().contains("if-none-match: *"));
            assert!(request.contains("uploadId=own-upload"));
            if status != 0 {
                let body = "<Error><Code>InternalError</Code><Message>synthetic</Message></Error>";
                write!(stream,"HTTP/1.1 {status} Synthetic\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
            }
            drop(stream);
            listener.set_nonblocking(true).unwrap();
            thread::sleep(Duration::from_millis(1500));
            assert!(matches!(listener.accept(), Err(e) if e.kind() == std::io::ErrorKind::WouldBlock), "unexpected mutation replay");
        });
        let mut b = bucket(port);
        b.add_header("If-None-Match", "*");
        assert!(complete(&b).is_err(), "failure must not become success");
        server.join().unwrap();
        println!("PASS completion status={status}: conditional header, error, no replay");
    }
    let sink = TcpListener::bind("127.0.0.1:0").unwrap();
    let target = sink.local_addr().unwrap().port();
    let origin = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = origin.local_addr().unwrap().port();
    let server = thread::spawn(move || {
        let (mut stream, _) = origin.accept().unwrap(); receive(&mut stream);
        write!(stream,"HTTP/1.1 307 Temporary Redirect\r\nLocation: http://127.0.0.1:{target}/other\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap(); drop(stream);
        let (mut redirected, _) = sink.accept().unwrap();
        let req = receive(&mut redirected).to_lowercase();
        assert!(req.contains("authorization: aws4-hmac-sha256"));
        assert!(req.contains("x-amz-security-token: synthetic-session"));
        write!(redirected,"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
    });
    let mut b = bucket(port); b.add_header("x-amz-security-token", "synthetic-session");
    assert!(complete(&b).is_err()); server.join().unwrap();
    println!("BLOCKER reproduced: sync backend follows cross-port 307 with signed Authorization and session token");
}
