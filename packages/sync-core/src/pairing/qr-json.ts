import { PAIRING_VERSION, PairingProtocolError } from './protocol-constants.js';
import type { PairingQrPayload } from './qr-payload.js';

/** Parses only the two-level V1 schema, retaining numeric token spellings. */
export function parseQrJson(source: string): PairingQrPayload {
  let position = 0;
  const invalid = (): never => { throw new PairingProtocolError('invalid_qr'); };
  const whitespace = (): void => {
    while (position < source.length && ' \t\n\r'.includes(source[position]!)) position++;
  };
  const consume = (character: string): void => {
    whitespace();
    if (source[position++] !== character) invalid();
  };
  const string = (): string => {
    whitespace();
    const start = position;
    if (source[position++] !== '"') invalid();
    while (position < source.length) {
      const character = source[position++];
      if (character === '"') {
        try { return JSON.parse(source.slice(start, position)) as string; } catch { return invalid(); }
      }
      if (character === '\\') position++;
    }
    return invalid();
  };
  const numberToken = (): string => {
    whitespace();
    const token = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(source.slice(position));
    if (!token) return invalid();
    position += token[0].length;
    return token[0];
  };
  const object = (lan: boolean): Record<string, unknown> => {
    consume('{');
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const allowed = lan ? ['ip', 'port'] : ['v', 'sid', 'pc_spki_sha256', 'secret', 'lan'];
    const seen = new Set<string>();
    whitespace();
    if (source[position] === '}') return invalid();
    while (true) {
      const key = string();
      if (!allowed.includes(key) || seen.has(key)) invalid();
      seen.add(key);
      consume(':');
      let value: unknown;
      if (key === 'lan') value = object(true);
      else if (key === 'v') {
        const token = numberToken();
        if (token !== String(PAIRING_VERSION)) {
          if (/^(?:0|[1-9][0-9]*)$/.test(token)) throw new PairingProtocolError('unsupported_version');
          invalid();
        }
        value = PAIRING_VERSION;
      } else if (key === 'port') {
        const token = numberToken();
        if (!/^[1-9][0-9]{0,4}$/.test(token) || Number(token) > 65535) invalid();
        value = Number(token);
      } else value = string();
      result[key] = value;
      whitespace();
      if (source[position] === '}') { position++; break; }
      consume(',');
    }
    if (seen.size !== allowed.length) invalid();
    return result;
  };
  const result = object(false);
  whitespace();
  if (position !== source.length) invalid();
  return result as unknown as PairingQrPayload;
}
