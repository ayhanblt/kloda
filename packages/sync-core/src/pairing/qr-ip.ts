import { PairingProtocolError } from './protocol-constants.js';

/** Syntax/range validation only: native code must establish on-link route locality. */
export function normalizeQrIp(ip: string): string {
  if (typeof ip !== 'string' || ip.length > 39) throw new PairingProtocolError('invalid_qr');
  if (ip.includes('.')) {
    if (!/^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$/.test(ip)) {
      throw new PairingProtocolError('invalid_qr');
    }
    const octets = ip.split('.').map(Number);
    if (octets.some((octet) => octet > 255)) throw new PairingProtocolError('invalid_qr');
    const [first, second] = octets;
    if (!(first === 10 || (first === 172 && second! >= 16 && second! <= 31)
      || (first === 192 && second === 168) || (first === 169 && second === 254))) {
      throw new PairingProtocolError('invalid_qr');
    }
    return ip;
  }
  if (!/^[0-9a-fA-F:]+$/.test(ip)) throw new PairingProtocolError('invalid_qr');
  const halves = ip.split('::');
  if (halves.length > 2) throw new PairingProtocolError('invalid_qr');
  const left = halves[0] === '' ? [] : halves[0]!.split(':');
  const right = halves.length === 1 || halves[1] === '' ? [] : halves[1]!.split(':');
  if ([...left, ...right].some((group) => !/^[0-9a-fA-F]{1,4}$/.test(group))) {
    throw new PairingProtocolError('invalid_qr');
  }
  const supplied = left.length + right.length;
  if ((halves.length === 1 && supplied !== 8) || (halves.length === 2 && supplied >= 8)) {
    throw new PairingProtocolError('invalid_qr');
  }
  const groups = [...left.map((group) => Number.parseInt(group, 16)),
    ...Array<number>(8 - supplied).fill(0), ...right.map((group) => Number.parseInt(group, 16))];
  const first = groups[0]!;
  if ((first & 0xfe00) !== 0xfc00 && (first & 0xe000) !== 0x2000) {
    throw new PairingProtocolError('invalid_qr');
  }
  let bestStart = -1;
  let bestLength = 1;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== 0) { index++; continue; }
    const start = index;
    while (index < groups.length && groups[index] === 0) index++;
    if (index - start > bestLength) { bestStart = start; bestLength = index - start; }
  }
  const text = groups.map((group) => group.toString(16));
  if (bestStart < 0) return text.join(':');
  return `${text.slice(0, bestStart).join(':')}::${text.slice(bestStart + bestLength).join(':')}`;
}
