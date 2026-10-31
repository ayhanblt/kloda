import { webDavIssuesFromNative, webDavReview } from './webdav-review';
const mockNative = { webDavIssues: jest.fn(), reviewWebDav: jest.fn(), cancelWebDavReview: jest.fn() };
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
const id = '11111111-1111-4111-8111-111111111111';
const issue = { id, sourceId: id, targetId: 'A'.repeat(43), name: 'photo.png', relativePath: `${id}/photo.png`, kind: 'photo_resource', phase: 'uploaded',
  skipped: false, errorCode: 'conflict', canRecheck: true, canKeepBoth: true };
it('rejects path escape, forged action readiness, duplicate IDs and false pagination', () => {
  expect(webDavIssuesFromNative({ items: [issue], hasMore: false }).items[0].canKeepBoth).toBe(true);
  for (const value of [
    { items: [{ ...issue, relativePath: `${id}/../escape` }], hasMore: false },
    { items: [{ ...issue, publishedPath: `${id}/other/photo.png` }], hasMore: false },
    { items: [{ ...issue, skipped: true }], hasMore: false },
    { items: [{ ...issue, phase: 'completed' }], hasMore: false },
    { items: [{ ...issue, errorCode: 'review_required' }], hasMore: false },
    { items: [issue, issue], hasMore: false },
    { items: [issue], hasMore: true, nextCursor: id },
  ]) expect(() => webDavIssuesFromNative(value)).toThrow('outcome_unknown');
});
it('keeps skip distinct from completion and binds cancellation to its own request', async () => {
  mockNative.reviewWebDav.mockResolvedValueOnce({ state: 'completed' });
  await expect(webDavReview.act(id, 'skip', id)).rejects.toThrow('outcome_unknown');
  mockNative.reviewWebDav.mockResolvedValueOnce({ state: 'skipped' });
  expect(await webDavReview.act(id, 'skip', id)).toBe('skipped');
  await webDavReview.cancel(id);
  expect(mockNative.cancelWebDavReview).toHaveBeenCalledWith(id);
});
