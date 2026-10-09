import {
  MAX_QR_JSON_BYTES, MAX_QR_WIRE_BYTES, PAIRING_VERSION, PairingProtocolError, QR_PREFIX,
} from './protocol-constants.js';
import { decodeQrBase64, encodeQrBase64 } from './qr-base64.js';
import { normalizeQrIp } from './qr-ip.js';
import { parseQrJson } from './qr-json.js';

export interface PairingQrPayload {
  v: 1;
  sid: string;
  pc_spki_sha256: string;
  secret: string;
  lan: { ip: string; port: number };
}

function validatePayload(payload: PairingQrPayload): void {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).length !== 5
    || !['v', 'sid', 'pc_spki_sha256', 'secret', 'lan'].every((key) => Object.hasOwn(payload, key))) {
    throw new PairingProtocolError('invalid_qr');
  }
  if (payload.v !== PAIRING_VERSION) {
    throw new PairingProtocolError(typeof payload.v === 'number' && Number.isInteger(payload.v)
      ? 'unsupported_version' : 'invalid_qr');
  }
  for (const [key, size] of [['sid', 16], ['pc_spki_sha256', 32], ['secret', 32]] as const) {
    const value = payload[key];
    if (typeof value !== 'string' || value.length !== Math.ceil(size * 8 / 6)) {
      throw new PairingProtocolError('invalid_qr');
    }
    decodeQrBase64(value, size, size);
  }
  const lan = payload.lan;
  if (lan === null || typeof lan !== 'object' || Array.isArray(lan)
    || Object.keys(lan).length !== 2 || !Object.hasOwn(lan, 'ip') || !Object.hasOwn(lan, 'port')
    || !Number.isInteger(lan.port) || lan.port < 1 || lan.port > 65535) {
    throw new PairingProtocolError('invalid_qr');
  }
  normalizeQrIp(lan.ip);
}

export function decodePairingQr(wire: string): PairingQrPayload {
  if (typeof wire !== 'string' || wire.length > MAX_QR_WIRE_BYTES || !wire.startsWith(QR_PREFIX)) {
    throw new PairingProtocolError('invalid_qr');
  }
  for (let i = 0; i < wire.length; i++) {
    if (wire.charCodeAt(i) > 127) throw new PairingProtocolError('invalid_qr');
  }
  const bytes = decodeQrBase64(wire.slice(QR_PREFIX.length), MAX_QR_JSON_BYTES);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new PairingProtocolError('invalid_qr');
  }
  let json: string;
  try { json = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new PairingProtocolError('invalid_qr'); }
  const payload = parseQrJson(json);
  validatePayload(payload);
  return payload;
}

export function encodePairingQr(payload: PairingQrPayload): string {
  validatePayload(payload);
  const json = JSON.stringify({
    v: PAIRING_VERSION,
    sid: payload.sid,
    pc_spki_sha256: payload.pc_spki_sha256,
    secret: payload.secret,
    lan: { ip: normalizeQrIp(payload.lan.ip), port: payload.lan.port },
  });
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_QR_JSON_BYTES) throw new PairingProtocolError('invalid_qr');
  const wire = QR_PREFIX + encodeQrBase64(bytes);
  if (wire.length > MAX_QR_WIRE_BYTES) throw new PairingProtocolError('invalid_qr');
  return wire;
}
