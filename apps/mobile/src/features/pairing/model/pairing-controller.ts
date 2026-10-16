import type { PairingApi, PairingStatus } from '../../../shared/api/pairing';
import { pairingErrorCode, type PairingErrorCode } from '../../../shared/api/pairing-errors';

export interface PairingSnapshot {
  status: PairingStatus | null;
  error: PairingErrorCode | null;
  action: 'scan' | 'cancel' | 'resume' | 'approve' | 'deny' | 'remove' | null;
  scanLocked: boolean;
  uncertain: boolean;
}

export class PairingController {
  private snapshot: PairingSnapshot = { status: null, error: null, action: null, scanLocked: true, uncertain: false };
  private revision = 0;
  private polling = false;
  private closed = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly api: PairingApi) {}

  getSnapshot = (): PairingSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(change: Partial<PairingSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach((listener) => listener());
  }

  async refresh(): Promise<void> {
    if (this.closed || this.polling) return;
    this.polling = true;
    const revision = this.revision;
    try {
      const status = await this.api.status();
      if (!this.closed && revision === this.revision) {
        this.publish({ status, uncertain: false, error: status.errorCode ?? null });
      }
    } catch (error) {
      if (!this.closed && revision === this.revision) this.publish({ error: pairingErrorCode(error), uncertain: true });
    } finally {
      this.polling = false;
    }
  }

  armScan(): boolean {
    const { status, action, uncertain } = this.snapshot;
    if (this.closed || action || uncertain || !status || status.repairRequired) return false;
    if (!['idle', 'invalid', 'revoked'].includes(status.phase)) return false;
    this.publish({ scanLocked: false });
    return true;
  }

  async scan(qr: string): Promise<void> {
    if (this.closed || this.snapshot.scanLocked || this.snapshot.action) return;
    // Latch synchronously, before calling native or awaiting: camera callbacks can burst.
    this.publish({ scanLocked: true, action: 'scan' });
    const revision = ++this.revision;
    await this.perform(() => this.api.scan(qr), revision);
  }

  stopScanning(): void {
    this.publish({ scanLocked: true });
  }

  async cancel(): Promise<void> {
    const { status, action } = this.snapshot;
    if (this.closed || !status?.operationId || action === 'cancel' || action === 'remove') return;
    const operationId = status.operationId;
    const revision = ++this.revision;
    this.publish({ scanLocked: true, action: 'cancel' });
    await this.perform(() => this.api.cancel(operationId), revision);
  }

  async resume(): Promise<void> {
    const { status, action } = this.snapshot;
    if (this.closed || action || !status?.recordId || status.repairRequired) return;
    if (!['pending', 'consumed_pending_ack'].includes(status.phase)) return;
    const recordId = status.recordId;
    const revision = ++this.revision;
    this.publish({ scanLocked: true, action: 'resume' });
    await this.perform(() => this.api.resume(recordId), revision);
  }
  async decide(decision: 'approve' | 'deny', operationId: string, candidateGeneration: string): Promise<void> {
    const { status, action } = this.snapshot;
    if (this.closed || action) return;
    if (status?.phase !== 'connecting' || !status.repairRequired ||
      status.operationId !== operationId || status.candidateGeneration !== candidateGeneration) {
      this.publish({ error: 'candidate_stale' });
      return;
    }
    const revision = ++this.revision;
    this.publish({ action: decision, scanLocked: true });
    await this.perform(() => this.api[decision](operationId, candidateGeneration), revision);
  }
  async removePairing(recordId: string, online: boolean): Promise<void> {
    const { status, action, uncertain } = this.snapshot;
    if (this.closed || action || uncertain || status?.phase !== 'complete' || status.recordId !== recordId) return;
    const revision = ++this.revision;
    this.publish({ scanLocked: true, action: 'remove' });
    await this.perform(() => this.api.removePairing(recordId, online), revision);
  }


  private async perform(action: () => Promise<PairingStatus>, revision: number): Promise<void> {
    try {
      const status = await action();
      if (!this.closed && revision === this.revision) {
        ++this.revision;
        this.publish({ status, action: null, uncertain: false, error: status.errorCode ?? null });
      }
    } catch (error) {
      if (!this.closed && revision === this.revision) {
        ++this.revision;
        const code = pairingErrorCode(error);
        this.publish({ action: null, error: code, uncertain: true });
        // A rejected operation is not evidence that the peer or durable pin rolled back.
        await this.refresh();
      }
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    ++this.revision;
    this.listeners.clear();
    await this.api.close();
  }
}
