// @vitest-environment node
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { openSourceSnapshot } from './source-snapshot.js';

const fixtures: string[] = [];
const snapshotDisposers: (() => Promise<void>)[] = [];

async function sourceFile(bytes: Uint8Array): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'source-snapshot-'));
  fixtures.push(directory);
  const path = join(directory, 'source.bin');
  await writeFile(path, bytes);
  return path;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function prepareSnapshot(path: string) {
  const snapshot = await openSourceSnapshot(path);
  snapshotDisposers.push(snapshot.dispose);
  return snapshot;
}

afterEach(async () => {
  try {
    await Promise.all(snapshotDisposers.splice(0).map(dispose => dispose()));
  } finally {
    await Promise.all(fixtures.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  }
});

describe('openSourceSnapshot', () => {
  it('returns the exact bytes and standard SHA-256 revision for a known vector', async () => {
    const bytes = new TextEncoder().encode('abc');
    const snapshot = await prepareSnapshot(await sourceFile(bytes));

    expect(snapshot.revision).toBe('sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(new Uint8Array(await snapshot.body.arrayBuffer())).toEqual(bytes);
  });

  it('detects changed bytes even when size and modification time are preserved', async () => {
    const path = await sourceFile(new TextEncoder().encode('first bytes'));
    const originalTime = new Date('2020-01-02T03:04:05.000Z');
    await utimes(path, originalTime, originalTime);
    const first = await prepareSnapshot(path);

    const changed = new TextEncoder().encode('other bytes');
    await writeFile(path, changed);
    await utimes(path, originalTime, originalTime);
    const second = await prepareSnapshot(path);

    expect(second.revision).toBe(sha256(changed));
    expect(first.revision).toBe(sha256(new TextEncoder().encode('first bytes')));
    expect(second.revision).not.toBe(first.revision);
  });

  it('keeps the revision when only modification time changes', async () => {
    const path = await sourceFile(new TextEncoder().encode('same source'));
    const original = await prepareSnapshot(path);

    const changedTime = new Date('2022-06-07T08:09:10.000Z');
    await utimes(path, changedTime, changedTime);
    const updated = await prepareSnapshot(path);

    expect(updated.revision).toBe(original.revision);
    expect(updated.revision).toBe(sha256(new TextEncoder().encode('same source')));
  });

  it('uses the standard empty-input SHA-256 digest', async () => {
    const snapshot = await prepareSnapshot(await sourceFile(new Uint8Array()));

    expect(snapshot.revision).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(snapshot.body.size).toBe(0);
  });

  it('preserves hashed snapshot bytes when the source changes before upload', async () => {
    const path = await sourceFile(new TextEncoder().encode('snapshot data'));
    const originalTime = new Date('2021-03-04T05:06:07.000Z');
    await utimes(path, originalTime, originalTime);
    const snapshot = await prepareSnapshot(path);

    await writeFile(path, new TextEncoder().encode('changed bytes'));
    await utimes(path, originalTime, originalTime);

    expect(new Uint8Array(await snapshot.body.arrayBuffer())).toEqual(new TextEncoder().encode('snapshot data'));
    expect(snapshot.revision).toBe(sha256(new TextEncoder().encode('snapshot data')));
  });
});
