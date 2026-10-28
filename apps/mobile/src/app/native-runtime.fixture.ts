import { jest } from '@jest/globals';

const mockRuntime = {
  loadSchedule: jest.fn<() => Promise<{ intervalHours: 12 | 24; localTime: string; backupMode?: 'live' | 'scheduled' }>>().mockResolvedValue({ intervalHours: 12, localTime: '12:00' }),
  loadDirectorySources: jest.fn<() => Promise<{ id: string; kind: string; displayName: string }[]>>().mockResolvedValue([]),
  loadPhotoSources: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  selectPhotoLibrary: jest.fn<() => Promise<{ id: string; kind: string; displayName: string; reference: string } | null>>().mockResolvedValue(null),
  loadPhotoAlbums: jest.fn<() => Promise<{ id: string; displayName: string }[]>>().mockResolvedValue([]),
  selectPhotoAlbum: jest.fn<() => Promise<{ id: string; kind: string; displayName: string; reference: string } | null>>().mockResolvedValue(null),
  removePhotoSource: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  loadStorageConfig: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  validateDirectorySources: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  saveSchedule: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  saveLiveSchedule: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  saveStorageConfig: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};
export const nativeRuntime = mockRuntime;
jest.mock('expo', () => ({
  ...jest.requireActual<object>('expo'),
  requireOptionalNativeModule: (name: string) => name === 'KlodaSyncRuntime' ? mockRuntime : null,
}));

export function restoreNativeRuntime(): void {
  jest.unmock('expo');
}
