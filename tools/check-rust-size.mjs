import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkDirectory(path);
    else if (entry.name.endsWith('.rs')) {
      const lines = (await readFile(path, 'utf8')).split('\n').filter((line) => line.trim() !== '').length;
      if (lines > 300) throw new Error(`${path}: ${lines} nonblank lines exceeds max-lines 300`);
    }
  }
}

await checkDirectory('packages/pairing-native/src');
console.log('Native Rust max-lines: pass (300 nonblank lines/file)');
