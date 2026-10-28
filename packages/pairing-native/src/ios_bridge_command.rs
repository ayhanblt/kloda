use crate::{
    error::{PairingError, Result},
    file_sender_command::validate_id,
    handle::Action,
};
use serde::Deserialize;
use zeroize::Zeroizing;

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub(super) enum PhoneCommand {
    Status {},
    Scan {
        #[serde(deserialize_with = "secret")]
        wire: Zeroizing<String>,
    },
    Approve {
        operation: String,
        generation: String,
    },
    Deny {
        operation: String,
        generation: String,
    },
    Cancel {
        operation: String,
    },
    Resume {
        record: String,
    },
    RemovePairing {
        record: String,
        online: bool,
    },
    Close {},
}
impl PhoneCommand {
    pub(super) fn action(self) -> Result<Action> {
        Ok(match self {
            Self::Status {} => Action::Status,
            Self::Scan { wire } => {
                if wire.is_empty() || wire.len() > 512 || !wire.is_ascii() {
                    return Err(PairingError::InvalidQr);
                }
                Action::Scan(wire)
            }
            Self::Approve {
                operation,
                generation,
            } => {
                validate(&operation, &generation)?;
                Action::Approve {
                    operation,
                    generation,
                }
            }
            Self::Deny {
                operation,
                generation,
            } => {
                validate(&operation, &generation)?;
                Action::Deny {
                    operation,
                    generation,
                }
            }
            Self::Cancel { operation } => {
                validate_id(&operation)?;
                Action::Cancel { operation }
            }
            Self::Resume { record } => {
                validate_id(&record)?;
                Action::Resume { record }
            }
            Self::RemovePairing { record, online } => {
                validate_id(&record)?;
                Action::RemovePairing { record, online }
            }
            Self::Close {} => Action::Close,
        })
    }
}
fn validate(id: &str, generation: &str) -> Result<()> {
    validate_id(id)?;
    let value = generation
        .parse::<u64>()
        .map_err(|_| PairingError::InvalidRequest)?;
    if value.to_string() != generation {
        return Err(PairingError::InvalidRequest);
    }
    Ok(())
}

fn secret<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Zeroizing<String>, D::Error> {
    String::deserialize(deserializer).map(Zeroizing::new)
}
