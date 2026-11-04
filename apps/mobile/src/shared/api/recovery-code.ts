import { requireOptionalNativeModule } from 'expo';
import { AppState, Platform } from 'react-native';

// ADR0029 29/1: the recovery code lives only in native custody. `reveal` asks for the phone's screen lock first and is
// the only call that returns the code; enabling a cloud destination fails with `recovery_required` until `confirm`.
export const recoveryStates = ['none', 'pending', 'confirmed'] as const;
export type RecoveryState = typeof recoveryStates[number];
export const recoveryGroupCount = 14;
const groupPattern = /^[0-9A-HJKMNP-TV-Z]{4}$/;
const codePattern = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){13}$/;
interface NativeRecovery {
  recoveryStatus(): Promise<unknown>;
  revealRecovery(title: string, reason: string): Promise<unknown>;
  renewRecovery(title: string, reason: string): Promise<unknown>;
  hideRecovery(): Promise<void>;
  confirmRecovery(first: number, firstGroup: string, second: number, secondGroup: string): Promise<unknown>;
  copyRecovery(code: string): Promise<unknown>;
  expireRecoveryClip?(): Promise<void>;
  importRecovery(targetId: string, code: string): Promise<unknown>;
}
function invalid(): never { throw new Error('outcome_unknown'); }
function native(): NativeRecovery {
  const value = requireOptionalNativeModule<NativeRecovery>('KlodaCloud');
  if (!value) throw new Error('native_unsupported');
  return value;
}
function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !(key in value)) return invalid();
  return (value as Record<string, unknown>)[key];
}
function state(value: unknown): RecoveryState {
  const result = field(value, 'state');
  return recoveryStates.includes(result as RecoveryState) ? result as RecoveryState : invalid();
}
function groups(value: unknown): string[] {
  const code = field(value, 'code');
  return typeof code === 'string' && codePattern.test(code) ? code.split('-') : invalid();
}
// ADR0029 29/3: what the old phone's code verified in one destination's catalog. `unverified` deltas (gap, altered,
// unauthentic) were not imported; `imported` is every restore-only receipt this destination now holds.
export interface RecoveryImport { chains: number; deltas: number; entries: number; unverified: number; imported: number }
const importKeys = ['chains', 'deltas', 'entries', 'unverified', 'imported'] as const;
function imported(value: unknown): RecoveryImport {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== importKeys.length) return invalid();
  const row = value as Record<string, unknown>;
  return importKeys.every((key) => Number.isSafeInteger(row[key]) && (row[key] as number) >= 0) ? row as unknown as RecoveryImport : invalid();
}
export const normalizeGroup = (value: string) => value.trim().toUpperCase();
export const isRecoveryGroup = (value: string) => groupPattern.test(normalizeGroup(value));

// Android clears an expired clip only while it can read the clipboard, so every return to the foreground checks again.
let clipWatch = false;
function watchClip(): void {
  if (Platform.OS !== 'android' || clipWatch) return;
  clipWatch = true;
  AppState.addEventListener('change', (value) => { if (value === 'active') void native().expireRecoveryClip?.().catch(() => undefined); });
}

export const recoveryCode = {
  async status(): Promise<RecoveryState> { return state(await native().recoveryStatus()); },
  async reveal(title: string, reason: string): Promise<string[]> { return groups(await native().revealRecovery(title, reason)); },
  // ADR0029 decision 3 (29/2): a new code behind the same lock; `confirm` then replaces the old one and the next runs
  // catalogue every receipt again under it. Until confirmed the old code stays in force.
  async renew(title: string, reason: string): Promise<string[]> { return groups(await native().renewRecovery(title, reason)); },
  async hide(): Promise<void> { await native().hideRecovery(); },
  async confirm(answers: [number, string][]): Promise<RecoveryState> {
    const [[first, firstGroup] = [-1, ''], [second, secondGroup] = [-1, '']] = answers;
    const indexes = [first, second];
    if (answers.length !== 2 || first === second || indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= recoveryGroupCount) ||
      ![firstGroup, secondGroup].every(isRecoveryGroup)) throw new Error('invalid_request');
    return state(await native().confirmRecovery(first, normalizeGroup(firstGroup), second, normalizeGroup(secondGroup)));
  },
  // ADR0029 decision 6: only the shown code; native refuses anything else and sets the platform's clipboard limits.
  async copy(groups: string[]): Promise<void> {
    const code = groups.join('-');
    if (!codePattern.test(code)) throw new Error('invalid_request');
    await native().copyRecovery(code);
    watchClip();
  },
  // Native parses the typed code (case, spaces, hyphens and Crockford aliases are free) and refuses a wrong check
  // character with `recovery_code_invalid`; the code is neither stored nor adopted as this phone's code.
  async importCatalog(targetId: string, typed: string): Promise<RecoveryImport> {
    if (!targetId || typed.length > 256) throw new Error('invalid_request');
    return imported(await native().importRecovery(targetId, typed));
  },
};
