#![cfg(test)]

#[path = "tls_test_support.rs"]
mod support;
use crate::certificate::Role;
use crate::error::PairingError;
use crate::frame::Frame;
use crate::pc::Pc;
use crate::phone::Phone;
use crate::qr;
use crate::state::test_support::{hint, Directory};
use crate::state::{Phase, ReserveOutcome};
use crate::store::Store;
use crate::store_rows::RecordState;
use crate::tls::Channel;
use rustls::sign::CertifiedKey;
use std::sync::Arc;
use support::{ClientMode, Identity, Loopback, Side};
#[path = "tls_behavior_tests.rs"]
mod behavior;
#[path = "tls_closure_tests.rs"]
mod closure;

// All identities/transport here are public synthetic software/loopback fixtures.
// This suite asserts TLS and local durability only, not production LAN or hardware custody.
struct Exchange {
    pc_store: Store,
    phone_store: Store,
    pc_dir: Directory,
    phone_dir: Directory,
    pc_id: Identity,
    phone_id: Identity,
    pc: Pc,
    phone: Phone,
    pair: Loopback,
    pc_channel: Channel,
    phone_channel: Channel,
    sid: [u8; 16],
}
fn durable(directory: &Directory, identity: &Identity, sid: &[u8; 16], state: RecordState) {
    let reopened = directory.store(identity.spki.clone());
    assert_eq!(reopened.record(sid).unwrap().unwrap().state, state);
    assert_eq!(reopened.records().unwrap().len(), 1);
}
impl Exchange {
    fn reserved() -> Self {
        let pc_id = Identity::new(Role::Pc);
        let phone_id = Identity::new(Role::Phone);
        let pc_dir = Directory::new();
        let phone_dir = Directory::new();
        let pc_store = pc_dir.store(pc_id.spki.clone());
        let mut phone_store = phone_dir.store(phone_id.spki.clone());
        let mut pc = Pc::create(&pc_store, hint(), 0).unwrap();
        let sid = *pc.sid();
        let mut pair = Loopback::new(&pc_id, &phone_id, 1);
        let (pc_channel, phone_channel) = pair.channels(&sid, &pc_id, &phone_id);
        let payload = qr::parse(pc.qr().unwrap()).unwrap();
        let (mut phone, proof) = Phone::start(&mut phone_store, payload, &phone_channel).unwrap();
        assert_eq!(phone.phase(), Phase::Pending);
        durable(&phone_dir, &phone_id, &sid, RecordState::Pending);
        pair.send(Side::Phone, &proof);
        phone.request_sent(&phone_channel).unwrap();
        let received = pair.receive(Side::Pc);
        assert!(received == proof);
        assert_eq!(
            pc.reserve(&pc_store, &pc_channel, &received, 1).unwrap(),
            ReserveOutcome::Reserved
        );
        assert_eq!(pc.phase(), Phase::Reserved);
        assert!(pc_store.record(&sid).unwrap().is_none());
        Self {
            pc_store,
            phone_store,
            pc_dir,
            phone_dir,
            pc_id,
            phone_id,
            pc,
            phone,
            pair,
            pc_channel,
            phone_channel,
            sid,
        }
    }
    fn consume(&mut self) -> Frame {
        assert!(matches!(
            self.pc
                .approve(&mut self.pc_store, &self.sid, 2, &self.pc_channel, 2),
            Err(PairingError::CandidateStale)
        ));
        assert!(self.pc_store.record(&self.sid).unwrap().is_none());
        let commit = self
            .pc
            .approve(
                &mut self.pc_store,
                &self.sid,
                self.pc_channel.generation(),
                &self.pc_channel,
                2,
            )
            .unwrap();
        assert_eq!(self.pc.phase(), Phase::ConsumedPendingAck);
        durable(&self.pc_dir, &self.pc_id, &self.sid, RecordState::Consumed);
        let record = self.pc_store.record(&self.sid).unwrap().unwrap();
        assert!(record.peer.as_ref() == Some(&self.phone_id.spki));
        commit
    }
    fn pin(&mut self, commit: &Frame) -> Frame {
        self.pair.send(Side::Pc, commit);
        self.pc.commit_sent(&self.pc_channel).unwrap();
        let received = self.pair.receive(Side::Phone);
        let ack = self
            .phone
            .commit(&mut self.phone_store, &self.phone_channel, &received)
            .unwrap();
        assert_eq!(self.phone.phase(), Phase::PinnedPendingAck);
        durable(
            &self.phone_dir,
            &self.phone_id,
            &self.sid,
            RecordState::PinnedPendingAck,
        );
        assert!(
            self.phone_store
                .record(&self.sid)
                .unwrap()
                .unwrap()
                .peer
                .as_ref()
                == Some(&self.pc_id.spki)
        );
        ack
    }
    fn acknowledge(&mut self, ack: &Frame) -> Frame {
        self.pair.send(Side::Phone, ack);
        self.phone.ack_sent(&self.phone_channel).unwrap();
        let received = self.pair.receive(Side::Pc);
        let complete = self
            .pc
            .ack(&mut self.pc_store, &self.pc_channel, &received)
            .unwrap();
        assert_eq!(self.pc.phase(), Phase::Complete);
        durable(&self.pc_dir, &self.pc_id, &self.sid, RecordState::Complete);
        complete
    }
    fn finish(&mut self, complete: &Frame) {
        self.pair.send(Side::Pc, complete);
        let received = self.pair.receive(Side::Phone);
        self.phone
            .complete(&mut self.phone_store, &self.phone_channel, &received)
            .unwrap();
        assert_eq!(self.phone.phase(), Phase::Complete);
        durable(
            &self.phone_dir,
            &self.phone_id,
            &self.sid,
            RecordState::Complete,
        );
    }
    fn reconnect(self) -> (Self, Frame) {
        let Self {
            pc_store,
            phone_store,
            pc_dir,
            phone_dir,
            pc_id,
            phone_id,
            pc,
            phone,
            pair,
            pc_channel: old_pc,
            phone_channel: old_phone,
            sid,
        } = self;
        drop(pair);
        drop(pc);
        drop(phone);
        drop(pc_store);
        drop(phone_store);
        let pc_store = pc_dir.store(pc_id.spki.clone());
        let phone_store = phone_dir.store(phone_id.spki.clone());
        let mut pair = Loopback::new(&pc_id, &phone_id, 2);
        let (pc_channel, phone_channel) = pair.channels(&sid, &pc_id, &phone_id);
        assert_ne!(
            pc_channel.binding(),
            old_pc.binding(),
            "fresh full TLS must change CB"
        );
        let (mut phone, recover) = Phone::resume(&phone_store, sid, &phone_channel).unwrap();
        assert!(matches!(
            phone.request_sent(&old_phone),
            Err(PairingError::CandidateStale)
        ));
        pair.send(Side::Phone, &recover);
        phone.request_sent(&phone_channel).unwrap();
        let received = pair.receive(Side::Pc);
        assert!(received == recover);
        let (mut pc, commit) = Pc::resume(&pc_store, *received.sid(), &pc_channel).unwrap();
        assert!(matches!(
            pc.commit_sent(&old_pc),
            Err(PairingError::CandidateStale)
        ));
        assert!(pc.recover(&pc_store, &pc_channel, &received).unwrap() == commit);
        (
            Self {
                pc_store,
                phone_store,
                pc_dir,
                phone_dir,
                pc_id,
                phone_id,
                pc,
                phone,
                pair,
                pc_channel,
                phone_channel,
                sid,
            },
            commit,
        )
    }
}
