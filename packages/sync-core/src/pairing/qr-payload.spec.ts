import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PairingProtocolError } from './protocol-constants.js';
import { decodePairingQr, encodePairingQr } from './qr-payload.js';

type ParserFixture = {
  id: string;
  wire: string;
  expected: string;
};

type PairingPayload = {
  v: 1;
  sid: string;
  pc_spki_sha256: string;
  secret: string;
  lan: { ip: string; port: number };
};

type Vectors = {
  qr_wire: string;
  qr_json: string;
  parser_fixtures: ParserFixture[];
};

const vectors = JSON.parse(
  readFileSync(
    new URL('../../../../docs/security/qr-pairing-v1-protocol-vectors.json', import.meta.url),
    'utf8',
  ),
) as Vectors;
const accepts: Record<string, true> = { accept_syntax_only: true };

function expectProtocolError(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(PairingProtocolError);
    expect((error as PairingProtocolError).code).toBe(code);
    return;
  }
  throw new Error(`Expected PairingProtocolError(${code})`);
}

function validPayload(overrides: Partial<PairingPayload> = {}): PairingPayload {
  return {
    v: 1,
    sid: 'AAECAwQFBgcICQoLDA0ODw',
    pc_spki_sha256: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
    secret: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
    lan: { ip: '192.168.50.2', port: 45678 },
    ...overrides,
  };
}

describe('pairing QR payload codec', () => {
  it.each(vectors.parser_fixtures)('$id follows the documented syntax outcome', ({ id, wire, expected }) => {
    if (accepts[expected]) {
      expect(decodePairingQr(wire), id).toEqual(
        JSON.parse(Buffer.from(wire.slice('KLODA-PAIR:'.length), 'base64url').toString('utf8')),
      );
      return;
    }
    const code = id === 'version_0' || id === 'version_2' ? 'unsupported_version' : 'invalid_qr';
    expectProtocolError(() => decodePairingQr(wire), code);
  });

  it('decodes reordered fields and legal whitespace to the same values as the compact vector', () => {
    const reordered = vectors.parser_fixtures.find(({ id }) => id === 'reorder_whitespace');
    expect(decodePairingQr(reordered!.wire)).toEqual(validPayload());
  });

  it('emits the frozen compact JSON field order and unpadded wire form', () => {
    const payload = decodePairingQr(vectors.qr_wire);
    expect(encodePairingQr(payload)).toBe(vectors.qr_wire);
  });

  it('normalizes accepted expanded uppercase IPv6 to RFC5952 in producer output', () => {
    const payload = validPayload({ lan: { ip: 'FC00:0:0:0:0:0:0:1', port: 45678 } });
    const wire = encodePairingQr(payload);
    const json = Buffer.from(wire.slice('KLODA-PAIR:'.length), 'base64url').toString('utf8');
    expect(JSON.parse(json)).toEqual({ ...payload, lan: { ip: 'fc00::1', port: 45678 } });
    expect(decodePairingQr(wire)).toEqual({ ...payload, lan: { ip: 'fc00::1', port: 45678 } });
  });

  it.each([
    ['unsupported version', { v: 2 }],
    ['string version', { v: '1' }],
    ['missing field', { sid: undefined }],
    ['extra field', { unexpected: true }],
    ['invalid sid type', { sid: 7 }],
    ['invalid fingerprint length', { pc_spki_sha256: 'AA' }],
    ['invalid secret type', { secret: null }],
    ['invalid LAN type', { lan: null }],
    ['invalid port type', { lan: { ip: '192.168.50.2', port: '45678' } }],
  ] as Array<[string, Record<string, unknown>]>)('rejects producer input with %s', (label, changes) => {
    expectProtocolError(
      () => encodePairingQr({ ...validPayload(), ...changes } as never),
      label === 'unsupported version' ? 'unsupported_version' : 'invalid_qr',
    );
  });

  it('reports only the documented typed error for a non-string scan', () => {
    expectProtocolError(() => decodePairingQr(42 as never), 'invalid_qr');
  });
});
