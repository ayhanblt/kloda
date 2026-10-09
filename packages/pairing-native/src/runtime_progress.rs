use super::*;
use crate::frame::Frame;
use crate::key::Spki;

impl Io {
    pub(super) fn new(tls: Session, start: u64) -> Result<Self> {
        Ok(Self {
            tls,
            channel: None,
            sid: None,
            pump_next: true,
            outgoing: None,
            inflight: None,
            handshake_deadline: start
                .checked_add(10_000)
                .ok_or(PairingError::NativeUnsupported)?,
            handshake_observed: false,
            ack_seen: false,
        })
    }

    pub(super) fn check_handshake(&mut self, now: u64) -> Result<()> {
        if self.handshake_observed {
            return Ok(());
        }
        if now >= self.handshake_deadline {
            return Err(PairingError::ConnectionClosed);
        }
        if self.tls.established() {
            self.handshake_observed = true;
            self.tls.progress(now)?;
        }
        Ok(())
    }

    pub(super) fn bind(&mut self, sid: [u8; 16], local: &Spki) -> Result<()> {
        if let Some(saved) = self.sid {
            if saved != sid {
                return Err(PairingError::TlsRejected);
            }
            return Ok(());
        }
        self.channel = Some(self.tls.channel(&sid, local)?);
        self.sid = Some(sid);
        Ok(())
    }

    pub(super) fn queue(&mut self, frame: Frame, kind: SentKind, advances: bool) -> Result<()> {
        if self.outgoing.is_some() || self.inflight.is_some() {
            return Err(PairingError::TlsRejected);
        }
        self.outgoing = Some(Outbound {
            frame,
            sent: Sent { kind, advances },
        });
        Ok(())
    }

    pub(super) fn has_output(&self) -> bool {
        self.outgoing.is_some() || self.inflight.is_some()
    }

    /// A callback is returned exactly once, only after the actual native TLS writer has
    /// flushed the whole application frame. Enqueuing or accepting a promise is not send.
    /// Callers validate the currently bound route before invoking this I/O method.
    pub(super) fn flush(&mut self) -> Result<Option<Sent>> {
        if let Some(outbound) = self.outgoing.take() {
            self.tls.send(&outbound.frame)?;
            self.inflight = Some(outbound.sent);
            // Dropping a proof here zeroes its tag after rustls owns the encoded bytes.
        }
        if self.inflight.is_some() && self.tls.sent()? {
            return Ok(self.inflight.take());
        }
        Ok(None)
    }
}
