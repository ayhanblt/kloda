use crate::error::{PairingError, Result};
use zeroize::Zeroize;

#[derive(Clone, PartialEq, Eq)]
pub(crate) enum Frame {
    Proof { sid: [u8; 16], tag: [u8; 32] },
    Recover { sid: [u8; 16] },
    Commit { sid: [u8; 16] },
    Ack { sid: [u8; 16] },
    Complete { sid: [u8; 16] },
}
impl Drop for Frame {
    fn drop(&mut self) {
        if let Self::Proof { tag, .. } = self {
            tag.zeroize();
        }
    }
}
impl Frame {
    pub(crate) fn sid(&self) -> &[u8; 16] {
        match self {
            Self::Proof { sid, .. }
            | Self::Recover { sid }
            | Self::Commit { sid }
            | Self::Ack { sid }
            | Self::Complete { sid } => sid,
        }
    }
    /// Returns encoded length; unused bytes of the caller's stack buffer are untouched.
    pub(crate) fn encode(&self, out: &mut [u8; 52]) -> usize {
        let (kind, length) = match self {
            Self::Proof { .. } => (1, 50),
            Self::Recover { .. } => (2, 18),
            Self::Commit { .. } => (3, 18),
            Self::Ack { .. } => (4, 18),
            Self::Complete { .. } => (5, 18),
        };
        out[..2].copy_from_slice(&(length as u16).to_be_bytes());
        out[2] = 1;
        out[3] = kind;
        out[4..20].copy_from_slice(self.sid());
        if let Self::Proof { tag, .. } = self {
            out[20..52].copy_from_slice(tag);
        }
        length + 2
    }
    pub(crate) fn parse_body(body: &[u8]) -> Result<Self> {
        if !matches!(body.len(), 18 | 50) || body[0] != 1 {
            return Err(PairingError::ProofRejected);
        }
        let mut sid = [0; 16];
        sid.copy_from_slice(&body[2..18]);
        match (body[1], body.len()) {
            (1, 50) => {
                let mut tag = [0; 32];
                tag.copy_from_slice(&body[18..]);
                Ok(Self::Proof { sid, tag })
            }
            (2, 18) => Ok(Self::Recover { sid }),
            (3, 18) => Ok(Self::Commit { sid }),
            (4, 18) => Ok(Self::Ack { sid }),
            (5, 18) => Ok(Self::Complete { sid }),
            _ => Err(PairingError::ProofRejected),
        }
    }
}

/// One frame of bounded storage, no allocation, and no queue growth under coalesced reads.
/// The caller repeats `feed` over unconsumed bytes and applies direction/state checks.
pub(crate) struct FrameDecoder {
    buffer: [u8; 52],
    used: usize,
    target: usize,
    failed: bool,
}
impl Default for FrameDecoder {
    fn default() -> Self {
        Self {
            buffer: [0; 52],
            used: 0,
            target: 2,
            failed: false,
        }
    }
}
impl Drop for FrameDecoder {
    fn drop(&mut self) {
        self.buffer.zeroize();
    }
}
impl FrameDecoder {
    pub(crate) fn new() -> Self {
        Self::default()
    }
    #[cfg(test)]
    pub(crate) fn is_partial(&self) -> bool {
        self.used != 0
    }
    pub(crate) fn read_bound(&self) -> usize {
        self.target - self.used
    }
    pub(crate) fn feed(&mut self, bytes: &[u8]) -> Result<(usize, Option<Frame>)> {
        if self.failed {
            return Err(PairingError::ProofRejected);
        }
        let mut consumed = 0;
        while consumed < bytes.len() {
            let count = (self.target - self.used).min(bytes.len() - consumed);
            self.buffer[self.used..self.used + count]
                .copy_from_slice(&bytes[consumed..consumed + count]);
            consumed += count;
            self.used += count;
            if self.used != self.target {
                break;
            }
            if self.target == 2 {
                let length = u16::from_be_bytes([self.buffer[0], self.buffer[1]]) as usize;
                if !matches!(length, 18 | 50) {
                    self.failed = true;
                    self.buffer.zeroize();
                    return Err(PairingError::ProofRejected);
                }
                self.target = length + 2;
            } else {
                let parsed = Frame::parse_body(&self.buffer[2..self.target]);
                self.buffer.zeroize();
                if parsed.is_err() {
                    self.failed = true;
                }
                self.used = 0;
                self.target = 2;
                return parsed.map(|frame| (consumed, Some(frame)));
            }
        }
        Ok((consumed, None))
    }
    pub(crate) fn finish(&self) -> Result<()> {
        if self.failed || self.used != 0 {
            Err(PairingError::ConnectionClosed)
        } else {
            Ok(())
        }
    }
}
#[cfg(test)]
#[path = "frame_tests.rs"]
mod tests;
