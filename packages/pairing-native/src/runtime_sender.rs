use super::*;
use crate::file_protocol::OperationState;
use crate::file_sender_command::{Command, Reply, Task};
use crate::store_rows::{Record, RecordRole, RecordState};

impl Actor {
    pub(super) fn transfer(
        &mut self,
        text: &str,
        task: Task,
        epoch: Option<u64>,
        background_active: Option<std::sync::Arc<std::sync::atomic::AtomicBool>>,
    ) -> Result<Reply> {
        let result = self.transfer_checked(text, task, epoch, background_active);
        if result.is_err() {
            self.file_sender = None;
        }
        result
    }
    fn connect_file_channel(
        &self,
        record: &Record,
        hint: &crate::qr::LanHint,
        check_foreground: &impl Fn() -> Result<()>,
    ) -> Result<(crate::route::Route, crate::file_sender::Channel)> {
        #[cfg(target_os = "android")]
        let route = crate::route::for_peer(hint, &self.context.platform)?;
        #[cfg(not(target_os = "android"))]
        let route = crate::route::for_peer(hint)?;
        route.check(hint.ip)?;
        check_foreground()?;
        let socket = route.connect(hint, Duration::from_millis(250))?;
        let channel = self.file_transport.runtime().block_on(async {
            tokio::time::timeout(
                Duration::from_secs(10),
                crate::file_sender::Channel::connect(
                    socket,
                    self.installation.certified_key.clone(),
                    record,
                    || {
                        check_foreground()?;
                        route.check(hint.ip)
                    },
                ),
            )
            .await
            .map_err(|_| PairingError::ConnectionClosed)?
        })?;
        Ok((route, channel))
    }
    fn transfer_once(
        &mut self,
        channel: &mut crate::file_sender::Channel,
        route: &crate::route::Route,
        hint: &crate::qr::LanHint,
        task: Task,
        check_foreground: &impl Fn() -> Result<()>,
    ) -> Result<Reply> {
        route.check(hint.ip)?;
        self.guard()?;
        self.file_transport.runtime().block_on(async {
            tokio::time::timeout(
                Duration::from_secs(30),
                channel.transfer(task, || {
                    check_foreground()?;
                    route.check(hint.ip)
                }),
            )
            .await
            .map_err(|_| PairingError::OutcomeUnknown)?
        })
    }
    fn transfer_checked(
        &mut self,
        text: &str,
        task: Task,
        epoch: Option<u64>,
        background_active: Option<std::sync::Arc<std::sync::atomic::AtomicBool>>,
    ) -> Result<Reply> {
        let foreground = self.foreground.clone();
        let check_foreground =
            || foreground.check_transfer_cancel(epoch, background_active.as_deref());
        check_foreground()?;
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
        let reused = self.file_sender.is_some();
        let (mut route, mut channel) = match self.file_sender.take() {
            Some(sender) => sender,
            None => self.connect_file_channel(&record, hint, &check_foreground)?,
        };
        let retry_task = if reused {
            Some(Task {
                command: task.command.clone(),
                file: match task.file.as_ref() {
                    Some(file) => Some(
                        file.try_clone()
                            .map_err(|_| PairingError::BackupUnavailable)?,
                    ),
                    None => None,
                },
            })
        } else {
            None
        };
        let reply = match self.transfer_once(&mut channel, &route, hint, task, &check_foreground) {
            Ok(reply) => reply,
            Err(PairingError::ConnectionClosed | PairingError::OutcomeUnknown)
                if retry_task.is_some() =>
            {
                drop(channel);
                check_foreground()?;
                self.guard()?;
                let (fresh_route, fresh_channel) =
                    self.connect_file_channel(&record, hint, &check_foreground)?;
                route = fresh_route;
                channel = fresh_channel;
                let retry_task = retry_task.unwrap();
                if let Command::Chunk { id, offset, length } = &retry_task.command {
                    let status_reply = self.transfer_once(
                        &mut channel,
                        &route,
                        hint,
                        Task {
                            command: Command::Status { id: id.clone() },
                            file: None,
                        },
                        &check_foreground,
                    )?;
                    let already_committed = status_reply.operation.as_ref().is_some_and(|op| {
                        op.state == OperationState::Completed
                            || op.offset >= *offset + *length as u64
                    });
                    if already_committed {
                        status_reply
                    } else {
                        self.transfer_once(
                            &mut channel,
                            &route,
                            hint,
                            retry_task,
                            &check_foreground,
                        )?
                    }
                } else {
                    self.transfer_once(
                        &mut channel,
                        &route,
                        hint,
                        retry_task,
                        &check_foreground,
                    )?
                }
            }
            Err(error) => return Err(error),
        };
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
        check_foreground()?;
        route.check(hint.ip)?;
        self.file_sender = Some((route, channel));
        Ok(reply)
    }
}
