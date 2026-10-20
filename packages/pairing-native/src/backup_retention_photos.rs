use super::*;
use serde::Deserialize;

pub(super) const PREFIX: &str = "kloda-photo-v1-";
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    version: u8,
    source_device_id: String,
    asset_id: String,
    revision: String,
    resources: Vec<Resource>,
    albums: Vec<Album>,
    favorite: serde_json::Value,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Resource {
    operation_id: String,
    role: String,
    name: String,
    mime_type: String,
    sha256: String,
    size: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Album {
    id: String,
    name: String,
}
pub(super) struct Graph {
    pub(super) dependencies: BTreeMap<String, Vec<String>>,
    pub(super) resources: BTreeSet<String>,
    pub(super) signatures: BTreeMap<String, String>,
}
fn opaque(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_".contains(&b))
}
fn decimal(s: &str) -> Option<u64> {
    if s.is_empty()
        || s.len() > 19
        || (s.len() > 1 && s.starts_with('0'))
        || !s.bytes().all(|b| b.is_ascii_digit())
    {
        None
    } else {
        s.parse::<u64>().ok().filter(|v| *v <= i64::MAX as u64)
    }
}
fn text(s: &str) -> bool {
    !s.trim().is_empty()
        && s.encode_utf16().count() <= 255
        && !matches!(s, "." | "..")
        && !s.chars().any(|c| c.is_control() || c == '/' || c == '\\')
}
fn parse(bytes: &[u8], name: &str) -> Result<Manifest> {
    if bytes.is_empty() || bytes.len() > 65536 {
        return Err(Error::InvalidRequest);
    }
    let value: Manifest = serde_json::from_slice(bytes).map_err(|_| Error::InvalidRequest)?;
    if value.version != 1
        || !opaque(&value.source_device_id)
        || !opaque(&value.asset_id)
        || decimal(&value.revision).is_none_or(|v| v == 0)
        || value.resources.is_empty()
        || value.resources.len() > 8
        || value.albums.len() > 32
        || name
            != format!(
                "{PREFIX}{}-{}-{}.json",
                value.source_device_id, value.asset_id, value.revision
            )
    {
        return Err(Error::InvalidRequest);
    }
    let mut ids = BTreeSet::new();
    let mut roles = BTreeSet::new();
    let mut albums = BTreeSet::new();
    for r in &value.resources {
        crate::qr_base64::fixed::<16>(&r.operation_id).map_err(|_| Error::InvalidRequest)?;
        crate::qr_base64::fixed::<32>(&r.sha256).map_err(|_| Error::InvalidRequest)?;
        if !ids.insert(&r.operation_id)
            || !roles.insert(&r.role)
            || r.role.is_empty()
            || r.role.len() > 32
            || !r.role.as_bytes()[0].is_ascii_lowercase()
            || !r
                .role
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"-_".contains(&b))
            || !crate::file_schema::safe_name(&r.name)
            || r.mime_type.len() > 127
            || r.mime_type.bytes().filter(|b| *b == b'/').count() != 1
            || r.mime_type.starts_with('/')
            || r.mime_type.ends_with('/')
            || !r
                .mime_type
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"/!#$&^_.+-".contains(&b))
            || decimal(&r.size).is_none()
        {
            return Err(Error::InvalidRequest);
        }
    }
    for a in &value.albums {
        if !opaque(&a.id) || !text(&a.name) || !albums.insert(&a.id) {
            return Err(Error::InvalidRequest);
        }
    }
    if !value.favorite.is_null() && !value.favorite.is_boolean() {
        return Err(Error::InvalidRequest);
    }
    Ok(value)
}
fn signature(value: &Manifest) -> Result<String> {
    let resources:Vec<_>=value.resources.iter().map(|r|serde_json::json!({"role":r.role,"name":r.name,"mimeType":r.mime_type,"sha256":r.sha256,"size":r.size})).collect();
    let albums: Vec<_> = value
        .albums
        .iter()
        .map(|a| serde_json::json!({"id":a.id,"name":a.name}))
        .collect();
    let canonical=serde_json::to_vec(&serde_json::json!({"version":value.version,"sourceDeviceId":value.source_device_id,"assetId":value.asset_id,"revision":value.revision,"resources":resources,"albums":albums,"favorite":value.favorite})).map_err(|_|Error::OutcomeUnknown)?;
    Ok(crate::qr_base64::encode(
        ring::digest::digest(&ring::digest::SHA256, &canonical).as_ref(),
    ))
}
pub(super) fn graph(store: &Store, items: &BTreeMap<String, Item>) -> Result<Graph> {
    let mut result = Graph {
        dependencies: BTreeMap::new(),
        resources: BTreeSet::new(),
        signatures: BTreeMap::new(),
    };
    for (id, item) in items {
        if !item.entry.operation.name.starts_with(PREFIX) {
            continue;
        }
        if item.deleted.as_ref().is_some_and(|d| d.phase >= 5) {
            let dependencies = item
                .deleted
                .as_ref()
                .ok_or(Error::OutcomeUnknown)?
                .dependencies
                .clone();
            for target in &dependencies {
                crate::qr_base64::fixed::<16>(target).map_err(|_| Error::OutcomeUnknown)?;
                result.resources.insert(target.clone());
            }
            result.dependencies.insert(id.clone(), dependencies);
            continue;
        }
        let manifest = parse(&files::content(store, item)?, &item.entry.operation.name)?;
        result.signatures.insert(id.clone(), signature(&manifest)?);
        let mut dependencies = Vec::new();
        for resource in manifest.resources {
            let target = items
                .get(&resource.operation_id)
                .ok_or(Error::OutcomeUnknown)?;
            if target.entry.operation.name.starts_with(PREFIX)
                || target.entry.binding != item.entry.binding
                || target.fingerprint != item.fingerprint
                || target.entry.operation.sha256 != resource.sha256
                || target.entry.operation.name != resource.name
                || target.entry.operation.size
                    != decimal(&resource.size).ok_or(Error::InvalidRequest)?
                || target.entry.operation.state != OperationState::Completed
                || !retained(target)
            {
                return Err(Error::Conflict);
            }
            files::verify_reference(store, target)?;
            result.resources.insert(resource.operation_id.clone());
            dependencies.push(resource.operation_id);
        }
        result.dependencies.insert(id.clone(), dependencies);
    }
    Ok(result)
}

pub(crate) fn validate_publication(
    store: &Store,
    sid: &[u8; 16],
    entry: &Entry,
    dirs: &Directories,
) -> Result<()> {
    if !entry.operation.name.starts_with(PREFIX) {
        return Ok(());
    }
    if entry.operation.size > 65536 {
        return Err(Error::InvalidRequest);
    }
    let name = format!(".kloda-{}.part", entry.operation.id);
    let file = backup_root::open_file(&dirs.peer, &name, false, false)?;
    if backup_root::file_identity(&file)? != entry.identity {
        return Err(Error::Conflict);
    }
    use std::io::Read;
    let mut bytes = Vec::new();
    file.take(65537)
        .read_to_end(&mut bytes)
        .map_err(|e| Error::from(backup_root::target_error(e)))?;
    let manifest = parse(&bytes, &entry.operation.name)?;
    let previous: Option<String> = store
        .conn
        .query_row(
            "SELECT previous_id FROM backup_rebackup_requests WHERE id=?1",
            [&entry.operation.id],
            |r| r.get(0),
        )
        .optional()
        .map_err(rows::storage)?;
    if let Some(previous) = previous {
        let retained = deleted(store, &previous)?
            .and_then(|d| d.signature)
            .ok_or(Error::OutcomeUnknown)?;
        if signature(&manifest)? != retained {
            return Err(Error::Conflict);
        }
    }
    let record = store.record(sid)?.ok_or(Error::Denied)?;
    let items = load(store)?;
    for resource in manifest.resources {
        let target = items.get(&resource.operation_id).ok_or(Error::Conflict)?;
        if !active(target)
            || target.entry.binding != entry.binding
            || target.fingerprint != record.expected
            || target.entry.operation.name.starts_with(PREFIX)
            || target.entry.operation.name != resource.name
            || target.entry.operation.sha256 != resource.sha256
            || Some(target.entry.operation.size) != decimal(&resource.size)
        {
            return Err(Error::Conflict);
        }
        files::verify_reference(store, target)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_manifest_validation_keeps_android_required_fields_and_unicode_names() {
        let mut value = serde_json::json!({"version":1,"sourceDeviceId":"source","assetId":"asset","revision":"1","resources":[{"operationId":crate::qr_base64::encode(&[1;16]),"role":"original","name":"one.jpg","mimeType":"image/jpeg","sha256":crate::qr_base64::encode(&[1;32]),"size":"1"}],"albums":[{"id":"album","name":"ğ".repeat(255)}],"favorite":null});
        let name = "kloda-photo-v1-source-asset-1.json";
        assert!(parse(&serde_json::to_vec(&value).unwrap(), name).is_ok());
        value.as_object_mut().unwrap().remove("favorite");
        assert!(parse(&serde_json::to_vec(&value).unwrap(), name).is_err());
        value["favorite"] = serde_json::Value::Null;
        value["albums"][0]["name"] = serde_json::json!("bad/path");
        assert!(parse(&serde_json::to_vec(&value).unwrap(), name).is_err());
        value["albums"] = serde_json::json!([]);
        value["resources"][0]["mimeType"] = serde_json::json!("image/a/b");
        assert!(parse(&serde_json::to_vec(&value).unwrap(), name).is_err());
    }
}
