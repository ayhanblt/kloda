use crate::error::{PairingError, Result};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Target {
    Epoch,
    Initialized,
    ListenerPort,
    Certificate,
}
impl Target {
    pub(crate) fn from_name(name: &str) -> Result<Self> {
        match name {
            "epoch" => Ok(Self::Epoch),
            "initialized" => Ok(Self::Initialized),
            "listener-port" => Ok(Self::ListenerPort),
            "certificate.der" => Ok(Self::Certificate),
            _ => Err(PairingError::StorageFailure),
        }
    }
    pub(crate) fn name(self) -> &'static str {
        match self {
            Self::Epoch => "epoch",
            Self::Initialized => "initialized",
            Self::ListenerPort => "listener-port",
            Self::Certificate => "certificate.der",
        }
    }
    pub(crate) fn pending_name(self) -> &'static str {
        match self {
            Self::Epoch => "epoch.pending",
            Self::Initialized => "initialized.pending",
            Self::ListenerPort => "listener-port.pending",
            Self::Certificate => "certificate.pending",
        }
    }
}

// Windows callers supply size/offset/alignment from the actual SDK type, not a host model.
pub(crate) fn buffer_size(
    header: usize,
    offset: usize,
    alignment: usize,
    utf16_units: usize,
) -> Result<usize> {
    let failure = PairingError::StorageFailure;
    if header == 0
        || utf16_units == 0
        || offset > header
        || !offset.is_multiple_of(2)
        || alignment < 2
        || !alignment.is_power_of_two()
        || !header.is_multiple_of(alignment)
    {
        return Err(failure);
    }
    let bytes = utf16_units.checked_mul(2).ok_or(failure)?;
    let size = header.checked_add(bytes).ok_or(failure)?;
    let aligned = size.checked_add(alignment - 1).ok_or(failure)? & !(alignment - 1);
    if aligned > u32::MAX as usize || aligned > isize::MAX as usize {
        return Err(failure);
    }
    Ok(aligned)
}
