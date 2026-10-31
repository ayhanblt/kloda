import { webDavBackups, webDavBackupsFromNative } from './webdav-backups';
const mockNative = { webDavBackups: jest.fn(), restoreWebDavFile: jest.fn(), restoreWebDavPhotos: jest.fn(), cancelWebDavRestore: jest.fn() };
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
const id = '11111111-1111-4111-8111-111111111111';
const item = { id, sourceId: id, name: 'own.bin', kind: 'file', sha256: 'A'.repeat(43), size: '1' };
const page = { targetId: 'A'.repeat(43), items: [item], hasMore: false, canRestoreFiles: true, canRestorePhotos: false };
it('accepts local catalog pagination without treating skipped or arbitrary remote entries as completed', () => {
  expect(webDavBackupsFromNative(page).items[0].id).toBe(id);
  expect(webDavBackupsFromNative({ ...page, items: [], hasMore: true, nextCursor: id }).nextCursor).toBe(id);
  for (const value of [
    { ...page, items: [{ ...item, name: '../escape' }] }, { ...page, items: [{ ...item, size: '9223372036854775808' }] },
    { ...page, items: [item, item] }, { ...page, items: [{ ...item, kind: 'photo_resource' }] },
    { ...page, items: [{ ...item, state: 'skipped' }] }, { ...page, hasMore: true },
  ]) expect(() => webDavBackupsFromNative(value)).toThrow('outcome_unknown');
});
it('requires exact native completion identity and cancels only its own request', async () => {
  mockNative.restoreWebDavFile.mockResolvedValueOnce({ id, name: 'own.bin', state: 'review_required' });
  await expect(webDavBackups.restoreFile(id, id)).rejects.toThrow('outcome_unknown');
  mockNative.restoreWebDavFile.mockResolvedValueOnce({ id, name: 'own.bin', state: 'completed' });
  expect(await webDavBackups.restoreFile(id, id)).toEqual({ name: 'own.bin' });
  await webDavBackups.cancel(id); expect(mockNative.cancelWebDavRestore).toHaveBeenCalledWith(id);
});

it('requires an exact Photos completion and never treats organization review as restored', async () => {
  mockNative.restoreWebDavPhotos.mockResolvedValueOnce({ id, state: 'organization_review', name: 'own.png' });
  await expect(webDavBackups.restorePhotos(id, id)).rejects.toThrow('outcome_unknown');
  mockNative.restoreWebDavPhotos.mockResolvedValueOnce({ id, state: 'completed', name: 'own.png' });
  expect(await webDavBackups.restorePhotos(id, id)).toEqual({ name: 'own.png' });
});
