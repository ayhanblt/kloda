use std::{error::Error, fs, io::Read, time::Duration};
use reqwest::{blocking::{Client, Response}, Method};
use rusty_s3::{Bucket, Credentials, S3Action, UrlStyle, actions::{CreateBucket,CreateMultipartUpload,UploadPart,CompleteMultipartUpload,GetObject,AbortMultipartUpload,ListParts}};
use sha2::{Digest,Sha256};
type Result<T> = std::result::Result<T,Box<dyn Error>>;
const TTL: Duration = Duration::from_secs(60);
fn client(trusted: bool) -> Result<Client> {
 let mut b=Client::builder().redirect(reqwest::redirect::Policy::none()).retry(reqwest::retry::never()).no_proxy().https_only(true).timeout(Duration::from_secs(15));
 if trusted {b=b.add_root_certificate(reqwest::Certificate::from_pem(&fs::read("/tmp/kloda-s3-step17/rusty/ca.crt")?)?);}
 Ok(b.build()?)
}
fn request<'a,A:S3Action<'a>>(c:&Client, a:&A, headers:&[(&str,&str)],body:Vec<u8>) -> Result<Response> {
 let method=match A::METHOD {rusty_s3::Method::Get=>Method::GET,rusty_s3::Method::Put=>Method::PUT,rusty_s3::Method::Post=>Method::POST,rusty_s3::Method::Delete=>Method::DELETE,rusty_s3::Method::Head=>Method::HEAD};
 let mut r=c.request(method,a.sign(TTL));
 for (k,v) in headers {r=r.header(*k,*v);}
 // Suppress reqwest URL-bearing errors: signed URLs are bearer credentials.
 r.body(body).send().map_err(|e| { eprintln!("transport diagnostic: {:?}", e.without_url()); "transport_failure".into() })
}
fn bounded(mut r:Response, max:u64)->Result<Vec<u8>> {let mut v=Vec::new();(&mut r).take(max+1).read_to_end(&mut v)?;if v.len() as u64>max{return Err("oversize".into())};Ok(v)}
fn root(data:&[u8], expected:&[u8])->Result<()> {
 use quick_xml::{Reader,events::Event};
 let mut r=Reader::from_reader(data);r.config_mut().check_end_names=true;
 let mut depth=0;let mut seen=false;let mut closed=false;
 loop {match r.read_event()? {
 Event::Start(e)=>{if depth==0 {if seen || e.name().as_ref()!=expected{return Err("unexpected_xml_root".into())};seen=true;}depth+=1;},
 Event::End(_)=>{if depth==0{return Err("bad_xml".into())};depth-=1;if depth==0 {closed=true;}},
 Event::Empty(e)=>{if depth==0 {if seen || e.name().as_ref()!=expected{return Err("unexpected_xml_root".into())};seen=true;closed=true;}},
 Event::DocType(_)|Event::PI(_)=>return Err("unsafe_xml".into()),
 Event::GeneralRef(e)=>{if e.resolve_char_ref()?.is_none() && !matches!(e.as_ref(),b"amp"|b"lt"|b"gt"|b"quot"|b"apos"){return Err("unknown_entity".into())}},
 Event::Text(t) if depth==0 && !t.as_ref().iter().all(u8::is_ascii_whitespace)=>return Err("trailing_xml".into()),
 Event::Eof=>break,_=>{}
 }}
 if !seen||!closed||depth!=0 {return Err("incomplete_xml".into())};Ok(())
}
fn create(c:&Client,b:&Bucket,k:&Credentials,key:&str)->Result<String>{
 let a=CreateMultipartUpload::new(b,Some(k),key);
 let r=request(c,&a,&[],vec![])?;if r.status()!=200{return Err("create_status".into())}
 let bytes=bounded(r,65536)?;root(&bytes,b"InitiateMultipartUploadResult")?;
 Ok(CreateMultipartUpload::parse_response(std::str::from_utf8(&bytes)?)?.upload_id().to_string())
}
fn main()->Result<()> {
 if std::env::args().any(|a|a=="create-binding") {return create_binding();}
 if std::env::args().any(|a|a=="fault") {return fault();}
 let ports=fs::read_to_string("/tmp/kloda-s3-step17/rusty/ports.json")?;
 let port=ports.trim().trim_matches(['[',']']).split(',').next().ok_or("ports")?.trim();
 let b=Bucket::new(format!("https://127.0.0.1:{port}").parse()?,UrlStyle::Path,"kloda17-owned","us-east-1")?;
 let k=Credentials::new("kloda17fixture","synthetic-only-kloda17-fixture");let c=client(true)?;
 let a=CreateBucket::new(&b,&k);let r=request(&c,&a,&[],vec![])?;assert!(r.status().is_success() || r.status()==409);
 let reject=client(false)?;assert!(request(&reject,&GetObject::new(&b,Some(&k),"none"),&[],vec![]).is_err());println!("PASS untrusted TLS certificate rejected");
 let key="owned/multipart-final.bin";let id=create(&c,&b,&k,key)?;let data=vec![73u8;5*1024*1024+4097];let mut etags=Vec::new();
 for (i,part) in data.chunks(5*1024*1024).enumerate(){
  let a=UploadPart::new(&b,Some(&k),key,(i+1) as u16,&id);let r=request(&c,&a,&[],part.to_vec())?;assert_eq!(r.status(),200);etags.push(r.headers().get("ETag").ok_or("etag")?.to_str()?.to_string());
 }
 let mut a=CompleteMultipartUpload::new(&b,Some(&k),key,&id,etags.iter().map(String::as_str));a.headers_mut().insert("if-none-match","*");let body=a.clone().body().into_bytes();
 let r=request(&c,&a,&[("if-none-match","*")],body)?;assert_eq!(r.status(),200);root(&bounded(r,65536)?,b"CompleteMultipartUploadResult")?;
 let r=request(&c,&GetObject::new(&b,Some(&k),key),&[],vec![])?;assert_eq!(r.status(),200);let actual=bounded(r,data.len() as u64)?;assert_eq!(actual.len(),data.len());assert_eq!(Sha256::digest(&actual),Sha256::digest(&data));println!("PASS TLS multipart 2parts/5246977bytes conditional completion + whole SHA256 readback");
 // A second owned attempt must not replace the first object.
 let collision=create(&c,&b,&k,key)?;let a=UploadPart::new(&b,Some(&k),key,1,&collision);let r=request(&c,&a,&[],vec![99u8;4097])?;assert_eq!(r.status(),200);let etag=r.headers().get("ETag").ok_or("etag")?.to_str()?.to_string();
 let mut a=CompleteMultipartUpload::new(&b,Some(&k),key,&collision,std::iter::once(etag.as_str()));a.headers_mut().insert("if-none-match","*");let body=a.clone().body().into_bytes();let r=request(&c,&a,&[("if-none-match","*")],body)?;assert_eq!(r.status(),412);
 let a=AbortMultipartUpload::new(&b,Some(&k),key,&collision);assert_eq!(request(&c,&a,&[],vec![])?.status(),204);
 let a=ListParts::new(&b,Some(&k),key,&collision);let r=request(&c,&a,&[],vec![])?;assert_eq!(r.status(),404);root(&bounded(r,65536)?,b"Error")?;
 let r=request(&c,&GetObject::new(&b,Some(&k),key),&[],vec![])?;assert_eq!(Sha256::digest(bounded(r,data.len() as u64)?),Sha256::digest(&data));println!("PASS collision412, exact owned upload abort204/ListParts404, original bytes retained");
 for bad in ["<Error><Code>InternalError</Code></Error>","<CompleteMultipartUploadResult>","<CompleteMultipartUploadResult/><Error/>","<!DOCTYPE x><CompleteMultipartUploadResult/>"]{assert!(root(bad.as_bytes(),b"CompleteMultipartUploadResult").is_err());}println!("PASS completion XML error/truncation/multiple roots/DOCTYPE rejected");
 Ok(())
}

fn prepared(c:&Client,p:kloda_s3_native::Prepared,body:Vec<u8>,mode:&str)->Option<Response>{
 let mut r=c.request(Method::from_bytes(p.method.as_bytes()).unwrap(),p.url().clone());
 for(k,v) in &p.headers {r=r.header(k,v);}
 r.header("x-kloda-fixture-mode",mode).body(if p.body.is_empty(){body}else{p.body}).send().ok()
}
fn fault()->Result<()> {
 use kloda_s3_native::{Target,Provider,Operation,Reply,prepare,creation,completion};
 let port=fs::read_to_string("/tmp/kloda-s3-step17/rusty/proxy-port.txt")?;
 let t=Target::new(Provider::Compatible,&format!("https://127.0.0.1:{port}"),"us-east-1","kloda17-owned","fault",true).unwrap();
 let k=Credentials::new("kloda17fixture","synthetic-only-kloda17-fixture");let c=client(true)?;
 let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_nanos();let key=format!("{stamp}");let fullkey=format!("fault/{key}");
 let p=prepare(&t,&k,&key,Operation::Create{job:"0123456789abcdef0123456789abcdef"}).unwrap();let r=prepared(&c,p,vec![],"").ok_or("create_transport")?;let code=r.status().as_u16();
 let Reply::Created{upload}=creation(code,&bounded(r,65536)?,"kloda17-owned",&fullkey)else{return Err("create_ack".into())};
 let bytes=vec![42u8;4097];let p=prepare(&t,&k,&key,Operation::Part{upload:&upload,number:1}).unwrap();let r=prepared(&c,p,bytes.clone(),"").ok_or("part_transport")?;assert_eq!(r.status(),200);let etags=vec![r.headers().get("etag").ok_or("etag")?.to_str()?.to_string()];
 // Exercise only the new core: successful previous host matrix is not repeated.
 for(mode,expected) in [("error",Reply::Review),("conflict",Reply::Reinitialize),("redirect",Reply::Review)]{
  let p=prepare(&t,&k,&key,Operation::Complete{upload:&upload,etags:&etags}).unwrap();let r=prepared(&c,p,vec![],mode).ok_or("fault_transport")?;let code=r.status().as_u16();assert_eq!(completion(code,&bounded(r,65536)?,"kloda17-owned",&fullkey),expected);println!("PASS new core {mode} classification; no redirect/retry");
 }
 let p=prepare(&t,&k,&key,Operation::Complete{upload:&upload,etags:&etags}).unwrap();assert!(prepared(&c,p,vec![],"drop").is_none());assert_eq!(completion(0,b"","kloda17-owned",&fullkey),Reply::Review);
 let p=prepare(&t,&k,&key,Operation::Get{version:None}).unwrap();let r=prepared(&c,p,vec![],"").ok_or("readback")?;assert_eq!(r.status(),200);assert_eq!(Sha256::digest(bounded(r,4097)?),Sha256::digest(&bytes));
 // Readback equality is evidence of server state, never a substitute for the lost ACK.
 assert_eq!(completion(0,b"","kloda17-owned",&fullkey),Reply::Review);
 std::thread::sleep(Duration::from_millis(1500));let counts=fs::read_to_string("/tmp/kloda-s3-step17/rusty/fault-counts.json")?;println!("PASS real committed object with lost completion ACK remains Review despite equal readback; counters={counts}");
 assert!(counts.contains("\"drop\": 1"));assert!(counts.contains("\"sink\": 0"));
 Ok(())
}

fn create_binding()->Result<()> {
 use kloda_s3_native::{Target,Provider,Operation,Reply,prepare,creation};
 let port=fs::read_to_string("/tmp/kloda-s3-step17/rusty/proxy-port.txt")?;
 let t=Target::new(Provider::Compatible,&format!("https://127.0.0.1:{port}"),"us-east-1","kloda17-owned","binding",true).unwrap();
 let k=Credentials::new("kloda17fixture","synthetic-only-kloda17-fixture");let c=client(true)?;
 let key=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_nanos().to_string();
 let p=prepare(&t,&k,&key,Operation::Create{job:"1123456789abcdef0123456789abcdef"}).unwrap();let r=prepared(&c,p,vec![],"").ok_or("transport")?;let status=r.status().as_u16();let body=bounded(r,65536)?;
 let Reply::Created{upload}=creation(status,&body,"kloda17-owned",&format!("binding/{key}"))else{return Err("bound_create_ack".into())};
 assert_eq!(creation(status,&body,"other-bucket",&format!("binding/{key}")),Reply::Review);
 let p=prepare(&t,&k,&key,Operation::Abort{upload:&upload}).unwrap();assert_eq!(prepared(&c,p,vec![],"").ok_or("abort")?.status(),204);
 println!("PASS final create ACK bucket/key binding against actual MinIO reply; exact acknowledged upload cleaned");Ok(())
}
