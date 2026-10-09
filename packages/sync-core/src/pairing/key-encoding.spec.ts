import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { canonicalP256Spki, validateP256Spki } from './key-encoding.js';
import { PairingProtocolError } from './protocol-constants.js';

const vectors = JSON.parse(readFileSync(
  new URL('../../../../docs/security/qr-pairing-v1-protocol-vectors.json', import.meta.url), 'utf8',
)) as { pc_spki_hex: string; phone_spki_hex: string; pc_sha256_hex: string; phone_sha256_hex: string };

function rejects(run: () => void): void {
  try {
    run();
    expect.fail('Invalid public key was accepted');
  } catch (error) {
    expect(error).toBeInstanceOf(PairingProtocolError);
    expect((error as PairingProtocolError).code).toBe('tls_rejected');
  }
}

describe('V1 public P-256 SPKI profile', () => {
  it.each(['pc', 'phone'] as const)('normalizes %s coordinates to the frozen fingerprint input', (role) => {
    const expected = Buffer.from(vectors[`${role}_spki_hex`], 'hex');
    const encoded = canonicalP256Spki(expected.subarray(27, 59), expected.subarray(59));
    expect(Buffer.from(encoded)).toEqual(expected);
    expect(createHash('sha256').update(encoded).digest('hex')).toBe(vectors[`${role}_sha256_hex`]);
    validateP256Spki(encoded);
  });

  it('rejects field overflow, infinity-like zero coordinates, off-curve points and unpadded coordinates', () => {
    const key = Buffer.from(vectors.pc_spki_hex, 'hex');
    const x = key.subarray(27, 59);
    const y = key.subarray(59);
    const overflow = Buffer.from('ffffffff00000001000000000000000000000000ffffffffffffffffffffffff', 'hex');
    rejects(() => canonicalP256Spki(overflow, y));
    rejects(() => canonicalP256Spki(x, overflow));
    rejects(() => canonicalP256Spki(new Uint8Array(32), new Uint8Array(32)));
    const changed = Uint8Array.from(y);
    changed[31] ^= 1;
    rejects(() => canonicalP256Spki(x, changed));
    rejects(() => canonicalP256Spki(x.subarray(1), y));
  });

  it('rejects alternate DER/OIDs/point encodings and trailing data', () => {
    const key = Buffer.from(vectors.pc_spki_hex, 'hex');
    for (const offset of [0, 1, 12, 22, 25, 26]) {
      const changed = Uint8Array.from(key);
      changed[offset] ^= 1;
      rejects(() => validateP256Spki(changed));
    }
    rejects(() => validateP256Spki(key.subarray(0, 90)));
    rejects(() => validateP256Spki(Buffer.concat([key, Buffer.from([0])])));
  });
});
