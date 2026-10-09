import type { PairingApi, PairingStatus } from '../../../shared/api/pairing';
import { PairingError, pairingErrorCode } from '../../../shared/api/pairing-errors';
import { PairingController } from './pairing-controller';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture() {
  let status: PairingStatus = { phase: 'idle' };
  let scanCalls = 0;
  const scanReply = deferred<PairingStatus>();
  const decisions: string[] = [];
  const api: PairingApi = {
    status: async () => status,
    scan: () => { ++scanCalls; return scanReply.promise; },
    approve: async (operationId, generation) => {
      decisions.push(`${operationId}:${generation}:approve`);
      status = { phase: 'pending', operationId, recordId: 'saved-pending' };
      return status;
    },
    deny: async (operationId, generation) => {
      decisions.push(`${operationId}:${generation}:deny`);
      status = { phase: 'revoked', operationId };
      return status;
    },
    cancel: async (operationId) => {
      status = { phase: 'revoked', operationId };
      return status;
    },
    resume: async () => status,
    close: async () => { status = { phase: 'invalid' }; },
  };
  return {
    api, scanReply, decisions,
    setStatus(value: PairingStatus) { status = value; },
    scanCalls: () => scanCalls,
    controller: new PairingController(api),
  };
}

describe('phone pairing consumer boundaries', () => {
  it('latches a burst of QR callbacks before native responds and never treats scan acceptance as completion', async () => {
    const f = fixture();
    await f.controller.refresh();
    expect(f.controller.armScan()).toBe(true);
    const first = f.controller.scan('camera-delivered-qr');
    const duplicate = f.controller.scan('camera-delivered-qr');
    expect(f.controller.getSnapshot().scanLocked).toBe(true);
    expect(f.scanCalls()).toBe(1);
    f.scanReply.resolve({ phase: 'pending', operationId: 'attempt', recordId: 'binding' });
    await Promise.all([first, duplicate]);
    expect(f.controller.getSnapshot().status?.phase).toBe('pending');
    expect(f.controller.armScan()).toBe(false);
  });

  it('does not resurrect a cancelled attempt when an old scan response arrives', async () => {
    const f = fixture();
    await f.controller.refresh();
    f.controller.armScan();
    const scan = f.controller.scan('qr');
    f.setStatus({ phase: 'connecting', operationId: 'attempt' });
    await f.controller.refresh();
    await f.controller.cancel();
    f.scanReply.resolve({ phase: 'complete', operationId: 'attempt', recordId: 'late-pin' });
    await scan;
    expect(f.controller.getSnapshot().status?.phase).toBe('revoked');
  });

  it('ignores a pre-cancellation status response that would falsely restore completion', async () => {
    const f = fixture();
    f.setStatus({ phase: 'pending', operationId: 'attempt', recordId: 'binding' });
    await f.controller.refresh();
    const delayed = deferred<PairingStatus>();
    f.api.status = () => delayed.promise;
    const poll = f.controller.refresh();
    await f.controller.cancel();
    delayed.resolve({ phase: 'complete', operationId: 'attempt', recordId: 'binding' });
    await poll;
    expect(f.controller.getSnapshot().status?.phase).toBe('revoked');
  });

  it('keeps a durable pin visibly incomplete after a lost native reply and requires explicit recovery', async () => {
    const f = fixture();
    await f.controller.refresh();
    f.controller.armScan();
    const scan = f.controller.scan('qr');
    f.setStatus({ phase: 'consumed_pending_ack', operationId: 'attempt', recordId: 'pin' });
    f.scanReply.reject(new PairingError('outcome_unknown'));
    await scan;
    expect(f.controller.getSnapshot().status?.phase).toBe('consumed_pending_ack');
    expect(f.controller.getSnapshot().error).toBeNull();
    expect(f.controller.getSnapshot().uncertain).toBe(false);
    expect(f.controller.armScan()).toBe(false);
    f.setStatus({ phase: 'complete', operationId: 'attempt', recordId: 'pin' });
    await f.controller.resume();
    expect(f.controller.getSnapshot().status?.phase).toBe('complete');
  });

  it('cannot approve re-pairing automatically or reuse a stale displayed generation', async () => {
    const f = fixture();
    await f.controller.refresh();
    f.controller.armScan();
    const scan = f.controller.scan('qr');
    f.scanReply.resolve({ phase: 'connecting', operationId: 'attempt', candidateGeneration: 'g1', repairRequired: true, peerFingerprint: 'native-verified-fingerprint' });
    await scan;
    expect(f.decisions).toEqual([]);
    expect(f.controller.getSnapshot().status?.phase).toBe('connecting');
    f.setStatus({ phase: 'connecting', operationId: 'attempt', candidateGeneration: 'g2', repairRequired: true, peerFingerprint: 'native-verified-fingerprint' });
    await f.controller.refresh();
    await f.controller.decide('approve', 'attempt', 'g1');
    expect(f.decisions).toEqual([]);
    expect(f.controller.getSnapshot().error).toBe('candidate_stale');
    await f.controller.decide('approve', 'attempt', 'g2');
    expect(f.decisions).toEqual(['attempt:g2:approve']);
    expect(f.controller.getSnapshot().status?.phase).toBe('pending');
  });

  it('does not publish a late successful response after its native owner closes', async () => {
    const f = fixture();
    await f.controller.refresh();
    f.controller.armScan();
    const scan = f.controller.scan('qr');
    let updates = 0;
    f.controller.subscribe(() => { ++updates; });
    await f.controller.close();
    f.scanReply.resolve({ phase: 'complete', operationId: 'closed' });
    await scan;
    expect(updates).toBe(0);
    expect(f.controller.getSnapshot().status?.phase).toBe('idle');
  });

  it('keeps repeated native asynchronous failures visible without making observed state uncertain', async () => {
    const f = fixture();
    const status: PairingStatus = { phase: 'invalid', errorCode: 'tls_rejected', hardwareClass: 'hardware_tee' };
    f.setStatus(status);
    await f.controller.refresh();
    await f.controller.refresh();
    expect(f.controller.getSnapshot()).toMatchObject({ status, error: 'tls_rejected', uncertain: false });
    expect(f.controller.armScan()).toBe(true);
    expect(f.controller.getSnapshot().error).toBe('tls_rejected');
    const scan = f.controller.scan('camera-qr');
    expect(f.controller.getSnapshot().error).toBe('tls_rejected');
    f.scanReply.resolve({ phase: 'invalid', errorCode: 'storage_failure' });
    await scan;
    expect(f.controller.getSnapshot()).toMatchObject({ error: 'storage_failure', uncertain: false });
    f.setStatus({ phase: 'idle' });
    await f.controller.refresh();
    expect(f.controller.getSnapshot().error).toBeNull();
  });

  it('never displays raw native error text as a security result', () => {
    expect(pairingErrorCode({ message: 'raw-qr-secret-or-TLS-internals', code: 'unexpected' })).toBe('outcome_unknown');
    expect(new PairingError(pairingErrorCode({ code: 'tls_rejected', message: 'private-certificate' })).message).toBe('tls_rejected');
  });
});
