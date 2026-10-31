import { galleryPageFromNative, galleryHistoryFromNative } from './gallery';

const asset = { id: 'asset', name: 'photo.jpg', width: 1200, height: 800, video: false };
it('accepts selected-only data without claiming complete permission', () => {
  expect(galleryPageFromNative({ permission: 'limited', items: [asset], hasMore: false }).permission).toBe('limited');
  expect(galleryPageFromNative({ permission: 'denied', items: [], hasMore: false }).items).toEqual([]);
});
it.each([
  { permission: 'denied', items: [asset], hasMore: false },
  { permission: 'granted', items: [asset, asset], hasMore: false },
  { permission: 'granted', items: [asset], hasMore: true },
  { permission: 'granted', items: [{ ...asset, width: -1 }], hasMore: false },
  { permission: 'granted', items: [{ ...asset, created: 'NaN' }], hasMore: false },
  { permission: 'granted', items: [{ ...asset, created: '9999999999999999' }], hasMore: false },
  { permission: 'granted', items: [{ ...asset, name: 'bad\u0000name' }], hasMore: false },
  { permission: 'unknown', items: [], hasMore: false },
])('rejects contradictory or malformed native gallery data %#', (value) => {
  expect(() => galleryPageFromNative(value)).toThrow('gallery_invalid');
});
it('validates historical states and separates a media receipt from a manifest receipt', () => {
  expect(galleryHistoryFromNative([{ recordId: 'pc', state: 'owner_deleted', kind: 'media' }])[0].state).toBe('owner_deleted');
  expect(() => galleryHistoryFromNative([{ recordId: 'pc', state: 'success', kind: 'manifest' }])).toThrow();
  expect(() => galleryHistoryFromNative(Array(17).fill({ recordId: 'pc', state: 'completed', kind: 'media' }))).toThrow();
});

it('accepts real pre-1970 creation dates', () => {
  expect(galleryPageFromNative({ permission: 'granted', items: [{ ...asset, created: '-1000' }], hasMore: false }).items[0].created).toBe('-1000');
});

it('distinguishes inaccessible limited album membership from an empty source', () => {
  expect(galleryPageFromNative({ permission: 'limited', items: [], hasMore: false, scopeUnavailable: true }).scopeUnavailable).toBe(true);
  expect(() => galleryPageFromNative({ permission: 'granted', items: [], hasMore: false, scopeUnavailable: true })).toThrow();
});

it('rejects coerced native state values instead of interpreting them as success', () => {
  expect(() => galleryPageFromNative({ permission: ['granted'], items: [], hasMore: false })).toThrow();
  expect(() => galleryHistoryFromNative([{ recordId: 'pc', state: ['completed'], kind: 'media' }])).toThrow();
});
