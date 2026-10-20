export interface NativePairingOwner {
  status(): Promise<string>;
  createInvitation(): Promise<string>;
  approve(operation: string, generation: string): Promise<string>;
  deny(operation: string, generation: string): Promise<string>;
  cancel(operation: string): Promise<string>;
  resume(record: string): Promise<string>;
  approveBackup(record: string, folder: string, revision?: string): Promise<string>;
  revokeBackup(record: string): Promise<string>;
  removeDevice(record: string): Promise<string>;
  suspendPairing(): Promise<string>;
  receiverStatus(): Promise<string>;
  receiverActivity(after?: string): Promise<string>;
  pairedDevices(after?: string): Promise<string>;
  pairedDevice(record: string): Promise<string>;
  backupVersions(after: string | undefined, trash: boolean): Promise<string>;
  trashBackups(ids: string): Promise<string>;
  restoreBackups(ids: string): Promise<string>;
  close(): Promise<string>;
}
