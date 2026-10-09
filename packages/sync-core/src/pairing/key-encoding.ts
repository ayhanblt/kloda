import { PairingProtocolError } from './protocol-constants.js';

const SPKI_PREFIX = Uint8Array.from([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d,
  0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01,
  0x07, 0x03, 0x42, 0x00, 0x04,
]);
const FIELD = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const CURVE_B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;

function coordinate(bytes: Uint8Array): bigint {
  if (bytes.length !== 32) throw new PairingProtocolError('tls_rejected');
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  if (value >= FIELD) throw new PairingProtocolError('tls_rejected');
  return value;
}

/** Public encoding only; does not validate a certificate, possession or trust. */
export function canonicalP256Spki(xBytes: Uint8Array, yBytes: Uint8Array): Uint8Array {
  validatePoint(xBytes, yBytes);
  const spki = new Uint8Array(91);
  spki.set(SPKI_PREFIX);
  spki.set(xBytes, 27);
  spki.set(yBytes, 59);
  return spki;
}

function validatePoint(xBytes: Uint8Array, yBytes: Uint8Array): void {
  const x = coordinate(xBytes);
  const y = coordinate(yBytes);
  if ((y * y - (x * x * x - 3n * x + CURVE_B)) % FIELD !== 0n) {
    throw new PairingProtocolError('tls_rejected');
  }
}

/** Strict V1 SPKI only; a caller-supplied blob is never live TLS evidence. */
export function validateP256Spki(spki: Uint8Array): void {
  if (spki.length !== 91 || SPKI_PREFIX.some((byte, i) => byte !== spki[i])) {
    throw new PairingProtocolError('tls_rejected');
  }
  validatePoint(spki.subarray(27, 59), spki.subarray(59, 91));
}
