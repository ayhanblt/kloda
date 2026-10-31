//! Syntax only: native same-target Completed receipt validation is mandatory before publication/restore.
use crate::paths::{metadata_name, opaque, relative_path, source_uuid};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const LIMIT: usize = 65536;
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Favorite {
    Known(bool),
    Unknown(()),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Resource {
    pub relative_path: String,
    pub role: String,
    pub name: String,
    pub mime_type: String,
    pub sha256: String,
    pub size: String,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Album {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct SmbPhotoManifest {
    pub format: String,
    pub version: u8,
    pub source_device_id: String,
    pub asset_id: String,
    pub revision: String,
    pub resources: Vec<Resource>,
    pub albums: Vec<Album>,
    pub favorite: Favorite,
}
impl SmbPhotoManifest {
    pub fn decode(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.is_empty() || bytes.len() > LIMIT {
            return Err("manifest_invalid");
        }
        let value: Self = serde_json::from_slice(bytes).map_err(|_| "manifest_invalid")?;
        value.validate()?;
        Ok(value)
    }
    pub fn encode(&self) -> Result<Vec<u8>, &'static str> {
        self.validate()?;
        let bytes = serde_json::to_vec(self).map_err(|_| "manifest_invalid")?;
        if bytes.len() > LIMIT {
            return Err("manifest_invalid");
        }
        Ok(bytes)
    }
    fn validate(&self) -> Result<(), &'static str> {
        if self.format != "kloda-smb-photo"
            || self.version != 1
            || !opaque(&self.source_device_id)
            || !opaque(&self.asset_id)
            || !number(&self.revision).is_some_and(|n| n > 0)
            || !(1..=8).contains(&self.resources.len())
            || self.albums.len() > 32
        {
            return Err("manifest_invalid");
        }
        let mut paths = HashSet::new();
        let mut roles = HashSet::new();
        let mut albums = HashSet::new();
        for r in &self.resources {
            let parts: Vec<_> = r.relative_path.split('/').collect();
            if !r.relative_path.is_ascii()
                || !relative_path(&r.relative_path)
                || parts.len() < 2
                || !source_uuid(parts[0])
                || !paths.insert(r.relative_path.to_ascii_lowercase())
                || !role(&r.role)
                || !roles.insert(&r.role)
                || !metadata_name(&r.name)
                || !mime(&r.mime_type)
                || !hash(&r.sha256)
                || number(&r.size).is_none()
            {
                return Err("manifest_invalid");
            }
        }
        for album in &self.albums {
            if !opaque(&album.id) || !metadata_name(&album.name) || !albums.insert(&album.id) {
                return Err("manifest_invalid");
            }
        }
        Ok(())
    }
}
fn number(value: &str) -> Option<i64> {
    if value.is_empty()
        || value.len() > 19
        || !value.bytes().all(|b| b.is_ascii_digit())
        || value.len() > 1 && value.starts_with('0')
    {
        return None;
    }
    value.parse().ok()
}
fn role(value: &str) -> bool {
    (1..=32).contains(&value.len())
        && value.as_bytes()[0].is_ascii_lowercase()
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-')
}
fn mime(value: &str) -> bool {
    let Some((a, b)) = value.split_once('/') else {
        return false;
    };
    let token = |s: &str| {
        !s.is_empty()
            && s.bytes()
                .all(|x| x.is_ascii_alphanumeric() || b"!#$&^_.+-".contains(&x))
    };
    value.len() <= 127 && token(a) && token(b)
}
fn hash(value: &str) -> bool {
    value.len() == 43
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        && b"AEIMQUYcgkosw048".contains(&value.as_bytes()[42])
}
