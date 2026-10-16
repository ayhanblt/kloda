use super::*;
use crate::file_sender_command::{Reply, Task};
use crate::store_rows::{RecordRole, RecordState};

impl Actor {
    pub(super) fn transfer(&mut self, text: &str, task: Task) -> Result<Reply> {
        let result = self.transfer_checked(text, task);
        if result.is_err() {
            self.file_sender = None;
        }
        result
    }
    fn transfer_checked(&mut self, text: &str, task: Task) -> Result<Reply> {
        self.guard()?;
        if !matches!(self.context.role, OwnerRole::Phone) {
            return Err(PairingError::NativeUnsupported);
        }
        let sid = super::actions::reference(text)?;
        let record = self
            .installation
            .store
            .record(&sid)?
            .ok_or(PairingError::CandidateStale)?;
        if record.role != RecordRole::Phone
            || record.state != RecordState::Complete
            || record.peer.is_none()
        {
            return Err(PairingError::CandidateStale);
        }
        let hint = record.hint.as_ref().ok_or(PairingError::ContinuityLost)?;
        if self
            .file_sender
            .as_ref()
            .is_some_and(|(_, channel)| !channel.matches(&record))
        {
            self.file_sender = None;
        }
        let (route, mut channel) = match self.file_sender.take() {
            Some(sender) => sender,
            None => {
                #[cfg(target_os = "android")]
                let route = crate::route::for_peer(hint, &self.context.platform)?;
                #[cfg(not(target_os = "android"))]
                let route = crate::route::for_peer(hint)?;
                route.check(hint.ip)?;
                let socket = route.connect(hint, Duration::from_millis(250))?;
                let channel = self.file_transport.runtime().block_on(async {
                    tokio::time::timeout(
                        Duration::from_secs(10),
                        crate::file_sender::Channel::connect(
                            socket,
                            self.installation.certified_key.clone(),
                            &record,
                            || route.check(hint.ip),
                        ),
                    )
                    .await
                    .map_err(|_| PairingError::ConnectionClosed)?
                })?;
                (route, channel)
            }
        };
        route.check(hint.ip)?;
        self.guard()?;
        let reply = self.file_transport.runtime().block_on(async {
            tokio::time::timeout(
                Duration::from_secs(30),
                channel.transfer(task, || route.check(hint.ip)),
            )
            .await
            .map_err(|_| PairingError::OutcomeUnknown)?
        })?;
        self.guard()?;
        let current = self
            .installation
            .store
            .record(&sid)?
            .ok_or(PairingError::ContinuityLost)?;
        if current.role != RecordRole::Phone
            || current.state != RecordState::Complete
            || !channel.matches(&current)
        {
            return Err(PairingError::ContinuityLost);
        }
        route.check(hint.ip)?;
        self.file_sender = Some((route, channel));
        Ok(reply)
    }
}
