import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
  it('formats zero and sub-kilobyte counts cleanly', () => {
    expect(formatBytes('0', 'en')).toBe('0 B');
    expect(formatBytes(512, 'tr')).toBe('512 B');
    expect(formatBytes('1023', 'de')).toBe('1023 B');
  });

  it('formats KB, MB, GB, TB, and PB with locale decimal separators', () => {
    expect(formatBytes(1024, 'en')).toBe('1 KB');
    expect(formatBytes(1536, 'en')).toBe('1.5 KB');
    expect(formatBytes(1536, 'tr')).toBe('1,5 KB');
    expect(formatBytes('3710355', 'tr')).toBe('3,5 MB');
    expect(formatBytes('2132131123', 'tr')).toBe('2 GB');
    expect(formatBytes('157286400', 'en')).toBe('150 MB');
    expect(formatBytes('2147483648', 'en')).toBe('2 GB');
    expect(formatBytes('9007199254740991', 'en')).toBe('8 PB');
  });

  it('returns non-numeric or negative inputs unchanged', () => {
    expect(formatBytes('Bilinmiyor', 'tr')).toBe('Bilinmiyor');
    expect(formatBytes('-5', 'en')).toBe('-5');
  });
});
