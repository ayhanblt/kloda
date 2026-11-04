use kloda_s3_native::{
    Credentials, Operation, Provider, Reply, Target, completion, creation, prepare,
};
fn target() -> Target {
    Target::new(
        Provider::Compatible,
        "https://127.0.0.1:9443",
        "us-east-1",
        "owned-bucket",
        "owned",
        true,
    )
    .unwrap()
}
fn credentials() -> Credentials {
    Credentials::new_with_token("synthetic", "synthetic-secret", "synthetic-token")
}
#[test]
fn signed_complete_is_conditional_and_xml_escaped() {
    let t = target();
    let c = credentials();
    let tags = vec!["\"part&1\"".into()];
    let p = prepare(
        &t,
        &c,
        "a b/资源",
        Operation::Complete {
            upload: "a+/=id",
            etags: &tags,
        },
    )
    .unwrap();
    assert_eq!(p.method, "POST");
    assert_eq!(p.headers, vec![("if-none-match".into(), "*".into())]);
    let q = p
        .url()
        .query_pairs()
        .collect::<std::collections::HashMap<_, _>>();
    assert_eq!(q.get("X-Amz-SignedHeaders").unwrap(), "host;if-none-match");
    assert_eq!(q.get("X-Amz-Security-Token").unwrap(), "synthetic-token");
    assert_eq!(q.get("uploadId").unwrap(), "a+/=id");
    assert_eq!(q.get("X-Amz-Expires").unwrap(), "60");
    assert!(String::from_utf8(p.body).unwrap().contains("&amp;"));
}
#[test]
fn rejects_endpoint_and_scope_escape() {
    for endpoint in [
        "http://example.com",
        "https://u:p@example.com",
        "https://example.com/root",
        "https://example.com/?x=y",
        "https://example.com/#x",
    ] {
        assert!(
            Target::new(
                Provider::Compatible,
                endpoint,
                "us-east-1",
                "owned-bucket",
                "",
                true
            )
            .is_err()
        );
    }
    let t = target();
    let c = credentials();
    for key in [
        "../escape",
        "a/../b",
        "/a",
        "a//b",
        "a/",
        "a\\b",
        "%2e%2e/b",
        "a\n",
    ] {
        assert!(prepare(&t, &c, key, Operation::Head).is_err());
    }
    assert!(
        Target::new(
            Provider::Amazon,
            "https://attacker.test",
            "us-east-1",
            "owned-bucket",
            "",
            false
        )
        .is_err()
    );
    assert!(
        Target::new(
            Provider::Amazon,
            "https://s3.us-east-1.amazonaws.com",
            "us-east-1",
            "owned-bucket",
            "",
            false
        )
        .is_ok()
    );
}
#[test]
fn mutation_parameters_are_bounded() {
    let t = target();
    let c = credentials();
    let tags = vec![];
    assert!(
        prepare(
            &t,
            &c,
            "x",
            Operation::Complete {
                upload: "id",
                etags: &tags
            }
        )
        .is_err()
    );
    for n in [0, 10001] {
        assert!(
            prepare(
                &t,
                &c,
                "x",
                Operation::Part {
                    upload: "id",
                    number: n
                }
            )
            .is_err()
        );
    }
    assert!(prepare(&t, &c, "x", Operation::Abort { upload: "id\n" }).is_err());
    assert!(
        prepare(
            &t,
            &c,
            "x",
            Operation::Create {
                job: "not-native-job-id"
            }
        )
        .is_err()
    );
    let p = prepare(
        &t,
        &c,
        "x",
        Operation::Create {
            job: "0123456789abcdef0123456789abcdef",
        },
    )
    .unwrap();
    assert!(
        p.url()
            .query_pairs()
            .any(|(k, v)| k == "X-Amz-SignedHeaders" && v == "host;x-amz-meta-kloda-job")
    );
}
const ACK: &str = "<CompleteMultipartUploadResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Bucket>owned-bucket</Bucket><Key>owned/x</Key><ETag>&quot;abc&quot;</ETag></CompleteMultipartUploadResult>";
#[test]
fn ack_requires_bound_bucket_key_and_complete_body() {
    assert_eq!(
        completion(200, ACK.as_bytes(), "owned-bucket", "owned/x"),
        Reply::CompletionAck {
            etag: "\"abc\"".into()
        }
    );
    assert_eq!(
        completion(200, ACK.as_bytes(), "other", "owned/x"),
        Reply::Review
    );
    assert_eq!(
        completion(200, ACK.as_bytes(), "owned-bucket", "other"),
        Reply::Review
    );
    for bad in [
        "<Error><Code>InternalError</Code></Error>".to_string(),
        ACK[..ACK.len() - 1].into(),
        format!("{ACK}<Error/>"),
        format!("<!DOCTYPE x>{ACK}"),
        ACK.replace("&quot;", "&unknown;"),
        ACK.replace("doc/2006-03-01/", "wrong/"),
    ] {
        assert_eq!(
            completion(200, bad.as_bytes(), "owned-bucket", "owned/x"),
            Reply::Review
        );
    }
    let duplicate = ACK.replace("</Bucket>", "</Bucket><Bucket>owned-bucket</Bucket>");
    assert_eq!(
        completion(200, duplicate.as_bytes(), "owned-bucket", "owned/x"),
        Reply::Review
    );
    assert_eq!(
        completion(200, &vec![b' '; 65537], "owned-bucket", "owned/x"),
        Reply::Review
    );
}
#[test]
fn failed_or_missing_ack_cannot_complete() {
    for (status, want) in [
        (0, Reply::Review),
        (200, Reply::Review),
        (307, Reply::Review),
        (409, Reply::Reinitialize),
        (412, Reply::Conflict),
        (500, Reply::Review),
        (403, Reply::Rejected),
    ] {
        assert_eq!(completion(status, b"", "owned-bucket", "owned/x"), want);
    }
}
#[test]
fn create_ack_is_not_authority_to_adopt_content() {
    let xml=b"<InitiateMultipartUploadResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Bucket>owned-bucket</Bucket><Key>owned/x</Key><UploadId>owned+id</UploadId></InitiateMultipartUploadResult>";
    assert_eq!(
        creation(200, xml, "owned-bucket", "owned/x"),
        Reply::Created {
            upload: "owned+id".into()
        }
    );
    assert_eq!(creation(0, xml, "owned-bucket", "owned/x"), Reply::Review);
    assert_eq!(
        creation(200, b"<Error/>", "owned-bucket", "owned/x"),
        Reply::Review
    );
}

#[test]
fn create_binding_and_xml_declaration_are_checked() {
    let body=b"<InitiateMultipartUploadResult><Bucket>owned-bucket</Bucket><Key>owned/x</Key><UploadId>id</UploadId></InitiateMultipartUploadResult>";
    assert_eq!(creation(200, body, "other", "owned/x"), Reply::Review);
    assert_eq!(creation(200, body, "owned-bucket", "other"), Reply::Review);
    assert_eq!(creation(200,b"<InitiateMultipartUploadResult><UploadId>id</UploadId></InitiateMultipartUploadResult>","owned-bucket","owned/x"),Reply::Review);
    let trailing = format!("{ACK}<?xml version=\"1.0\"?>");
    assert_eq!(
        completion(200, trailing.as_bytes(), "owned-bucket", "owned/x"),
        Reply::Review
    );
    let leading = format!("<?xml version=\"1.0\"?>{ACK}");
    assert!(matches!(
        completion(200, leading.as_bytes(), "owned-bucket", "owned/x"),
        Reply::CompletionAck { .. }
    ));
}

#[test]
fn bucket_dns_labels_and_prefix_boundaries() {
    for bucket in ["a..b", "-abc", "abc-", "a.-b", "127.0.0.1", "UPPER"] {
        assert!(
            Target::new(
                Provider::Compatible,
                "https://example.test",
                "us-east-1",
                bucket,
                "",
                true
            )
            .is_err()
        );
    }
    let t = Target::new(
        Provider::Amazon,
        "https://s3.us-east-1.amazonaws.com",
        "us-east-1",
        "owned.bucket",
        "",
        true,
    )
    .unwrap();
    assert!(prepare(&t, &credentials(), "x", Operation::Head).is_ok());
    let t = Target::new(
        Provider::Compatible,
        "https://example.test",
        "us-east-1",
        "owned-bucket",
        &"a".repeat(1024),
        true,
    )
    .unwrap();
    assert!(prepare(&t, &credentials(), "x", Operation::Head).is_err());
}
