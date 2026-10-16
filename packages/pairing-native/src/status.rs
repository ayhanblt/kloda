use crate::error::{PairingError, Result};
use serde::{Serialize, Serializer};
use zeroize::Zeroizing;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackupScopeStatus {
    pub(crate) state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) folder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) revision: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error_code: Option<&'static str>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnpairResult {
    pub(crate) state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error_code: Option<&'static str>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PairingStatus {
    pub(crate) phase: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) operation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) candidate_generation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) peer_fingerprint: Option<String>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_qr"
    )]
    pub(crate) qr: Option<Zeroizing<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) remaining_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) record_id: Option<String>,
    pub(crate) repair_required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error_code: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) hardware_class: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) backup_scope: Option<BackupScopeStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) unpair_result: Option<UnpairResult>,
}
impl Default for PairingStatus {
    fn default() -> Self {
        Self {
            phase: "idle",
            operation_id: None,
            candidate_generation: None,
            peer_fingerprint: None,
            qr: None,
            remaining_ms: None,
            record_id: None,
            repair_required: false,
            error_code: None,
            hardware_class: None,
            backup_scope: None,
            unpair_result: None,
        }
    }
}
impl PairingStatus {
    pub(crate) fn json(&self) -> Result<Zeroizing<String>> {
        serde_json::to_string(self)
            .map(Zeroizing::new)
            .map_err(|_| PairingError::OutcomeUnknown)
    }
}
fn serialize_qr<S: Serializer>(
    value: &Option<Zeroizing<String>>,
    serializer: S,
) -> std::result::Result<S::Ok, S::Error> {
    match value {
        Some(qr) => serializer.serialize_some(qr.as_str()),
        None => serializer.serialize_none(),
    }
}
