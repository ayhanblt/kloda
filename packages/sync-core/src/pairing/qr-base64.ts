import { PairingProtocolError } from './protocol-constants.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function encodeQrBase64(bytes: Uint8Array): string {
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    result += ALPHABET[first >>> 2];
    result += ALPHABET[((first & 3) << 4) | ((second ?? 0) >>> 4)];
    if (second !== undefined) result += ALPHABET[((second & 15) << 2) | ((third ?? 0) >>> 6)];
    if (third !== undefined) result += ALPHABET[third & 63];
  }
  return result;
}

export function decodeQrBase64(value: string, maxBytes: number, exactBytes?: number): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new PairingProtocolError('invalid_qr');
  }
  const size = Math.floor(value.length * 3 / 4);
  if (size > maxBytes || (exactBytes !== undefined && size !== exactBytes)) {
    throw new PairingProtocolError('invalid_qr');
  }
  const bytes = new Uint8Array(size);
  let bits = 0;
  let accumulator = 0;
  let offset = 0;
  for (const character of value) {
    accumulator = (accumulator << 6) | ALPHABET.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset++] = (accumulator >>> bits) & 255;
    }
  }
  if (encodeQrBase64(bytes) !== value) throw new PairingProtocolError('invalid_qr');
  return bytes;
}
