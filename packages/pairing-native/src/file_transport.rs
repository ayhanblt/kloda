use crate::error::{PairingError, Result};
use crate::file_protocol::{Request, Response};
use crate::file_transport_io::{Evidence, TlsIo};
use axum::extract::connect_info::Connected;
use std::io;
use tokio::sync::{mpsc, oneshot};

pub(crate) struct Command {
    pub(crate) evidence: Evidence,
    pub(crate) sid: [u8; 16],
    pub(crate) request: Request,
    pub(crate) reply: oneshot::Sender<crate::file_protocol::Result<Response>>,
}
struct Listener {
    incoming: mpsc::Receiver<TlsIo>,
}
impl axum::serve::Listener for Listener {
    type Io = TlsIo;
    type Addr = Evidence;
    async fn accept(&mut self) -> (TlsIo, Evidence) {
        match self.incoming.recv().await {
            Some(io) => {
                let evidence = io.evidence();
                (io, evidence)
            }
            None => std::future::pending().await,
        }
    }
    fn local_addr(&self) -> io::Result<Evidence> {
        Err(io::ErrorKind::Unsupported.into())
    }
}
impl Connected<axum::serve::IncomingStream<'_, Listener>> for Evidence {
    fn connect_info(stream: axum::serve::IncomingStream<'_, Listener>) -> Self {
        stream.remote_addr().clone()
    }
}

/// This runtime is driven and destroyed exclusively on the serialized native owner.
pub(crate) struct Managed {
    runtime: Option<tokio::runtime::Runtime>,
    incoming: Option<mpsc::Sender<TlsIo>>,
    requests: Option<mpsc::Receiver<Command>>,
    peers: Vec<Evidence>,
}
impl Managed {
    pub(crate) fn new(server: bool) -> Result<Self> {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|_| PairingError::NativeUnsupported)?;
        let (incoming, requests, peers) = if server {
            let (incoming, receiver) = mpsc::channel(16);
            let (commands, requests) = mpsc::channel(32);
            let router = crate::file_transport_http::router(commands);
            runtime.spawn(async move {
                let _ = axum::serve(
                    Listener { incoming: receiver },
                    router.into_make_service_with_connect_info::<Evidence>(),
                )
                .await;
            });
            (Some(incoming), Some(requests), Vec::with_capacity(16))
        } else {
            (None, None, Vec::new())
        };
        Ok(Self {
            runtime: Some(runtime),
            incoming,
            requests,
            peers,
        })
    }
    pub(crate) fn enter(&self) -> tokio::runtime::EnterGuard<'_> {
        self.runtime.as_ref().expect("owned runtime").enter()
    }
    pub(crate) fn accept(&mut self, stream: TlsIo) -> Result<()> {
        let evidence = stream.evidence();
        self.incoming
            .as_ref()
            .ok_or(PairingError::NativeUnsupported)?
            .try_send(stream)
            .map_err(|_| PairingError::ConnectionClosed)?;
        self.peers.push(evidence);
        Ok(())
    }
    pub(crate) fn close_peer(&mut self, peer: &crate::key::Spki, keep: Option<&Evidence>) {
        self.peers.retain(|evidence| {
            let close =
                &evidence.peer == peer && !keep.is_some_and(|keep| evidence.same_channel(keep));
            if close {
                evidence.close();
            }
            !close
        });
    }
    pub(crate) fn check_routes(&mut self, route: &crate::route::Route) -> Result<()> {
        route.check_local()?;
        for peer in &self.peers {
            if route.check(peer.ip).is_err() {
                peer.close();
            }
        }
        Ok(())
    }
    pub(crate) fn poll(&mut self) {
        if let Some(runtime) = &self.runtime {
            runtime.block_on(tokio::task::yield_now());
        }
        self.peers.retain(|peer| {
            if peer.check_live().is_ok() {
                true
            } else {
                peer.close();
                false
            }
        });
    }
    pub(crate) fn next(&mut self) -> Option<Command> {
        self.requests.as_mut()?.try_recv().ok()
    }
    pub(crate) fn live_count(&self) -> usize {
        self.peers.len()
    }
    pub(crate) fn cancel(&mut self) {
        for peer in self.peers.drain(..) {
            peer.close();
        }
        while let Some(command) = self.next() {
            let _ = command
                .reply
                .send(Err(crate::file_protocol::Error::ConnectionClosed));
        }
    }
    pub(crate) fn runtime(&self) -> &tokio::runtime::Runtime {
        self.runtime.as_ref().expect("owned runtime")
    }
    pub(crate) fn close(&mut self) {
        self.cancel();
        // No spawn_blocking: runtime destruction synchronously drops all socket/key tasks.
        drop(self.runtime.take());
    }
}
impl Drop for Managed {
    fn drop(&mut self) {
        self.close();
    }
}

#[cfg(test)]
#[path = "file_transport_tests.rs"]
pub(crate) mod tests;
