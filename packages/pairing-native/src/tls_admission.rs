use super::*;

impl Session {
    pub(crate) fn is_file(&self) -> bool {
        self.established
            && self.pc
            && self
                .connection
                .as_ref()
                .is_some_and(|c| c.alpn_protocol() == Some(tls_config::FILE_ALPN))
    }
    pub(crate) fn into_file(mut self) -> Result<crate::file_transport_io::TlsIo> {
        self.authorize_live()?;
        if !self.is_file() {
            return Err(PairingError::TlsRejected);
        }
        let peer = self.peer.take().ok_or(PairingError::TlsRejected)?;
        let connection = self.connection.take().ok_or(PairingError::TlsRejected)?;
        let socket = self.socket.take().ok_or(PairingError::ConnectionClosed)?;
        crate::file_transport_io::TlsIo::new(socket, connection, peer)
    }
    /// Authorization requires a live winning channel, unlike draining final frames.
    pub(crate) fn authorize_live(&self) -> Result<()> {
        if self.eof || self.peer_closed {
            return Err(PairingError::ConnectionClosed);
        }
        if !self.established {
            return Err(PairingError::TlsRejected);
        }
        Ok(())
    }
}
