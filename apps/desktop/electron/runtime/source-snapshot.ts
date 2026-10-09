import { createHash } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { mkdtemp, open, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function openSourceSnapshot(path: string): Promise<{
  body: Blob;
  revision: string;
  dispose(): Promise<void>;
}> {
  const directory = await mkdtemp(join(tmpdir(), 'kloda-source-snapshot-'));
  const stagedPath = join(directory, 'snapshot');
  try {
    const source = await open(path, 'r');
    const hash = createHash('sha256');
    try {
      const before = await source.stat({ bigint: true });
      if (!before.isFile()) throw new Error('Backup source is not a regular file.');
      const staged = await open(stagedPath, 'wx', 0o600);
      try {
        const buffer = Buffer.allocUnsafe(Number(before.size < 65536n ? before.size : 65536n));
        let remaining = before.size;
        const chunkLimit = BigInt(buffer.length);
        while (remaining > 0n) {
          const { bytesRead } = await source.read(buffer, 0, Number(remaining < chunkLimit ? remaining : chunkLimit), null);
          if (bytesRead === 0) break;
          remaining -= BigInt(bytesRead);
          hash.update(buffer.subarray(0, bytesRead));
          let offset = 0;
          while (offset < bytesRead) {
            const { bytesWritten } = await staged.write(buffer, offset, bytesRead - offset, null);
            if (bytesWritten === 0) throw new Error('Backup snapshot write made no progress.');
            offset += bytesWritten;
          }
        }
        const after = await source.stat({ bigint: true });
        const current = await stat(path, { bigint: true });
        const stagedSize = (await staged.stat({ bigint: true })).size;
        if (before.size !== stagedSize || [after, current].some(value =>
          value.dev !== before.dev || value.ino !== before.ino || value.size !== before.size ||
          value.mtimeNs !== before.mtimeNs || value.ctimeNs !== before.ctimeNs
        )) throw new Error('Source changed while preparing backup snapshot.');
      } finally {
        await staged.close();
      }
    } finally {
      await source.close();
    }
    return {
      body: await openAsBlob(stagedPath),
      revision: `sha256:${hash.digest('hex')}`,
      dispose: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
