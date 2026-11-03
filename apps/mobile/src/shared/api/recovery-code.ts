import { requireOptionalNativeModule } from 'expo';

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
  hideRecovery(): Promise<void>;
  confirmRecovery(first: number, firstGroup: string, second: number, secondGroup: string): Promise<unknown>;
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
export const normalizeGroup = (value: string) => value.trim().toUpperCase();
export const isRecoveryGroup = (value: string) => groupPattern.test(normalizeGroup(value));

export const recoveryCode = {
  async status(): Promise<RecoveryState> { return state(await native().recoveryStatus()); },
  async reveal(title: string, reason: string): Promise<string[]> {
    const code = field(await native().revealRecovery(title, reason), 'code');
    return typeof code === 'string' && codePattern.test(code) ? code.split('-') : invalid();
  },
  async hide(): Promise<void> { await native().hideRecovery(); },
  async confirm(answers: [number, string][]): Promise<RecoveryState> {
    const [[first, firstGroup] = [-1, ''], [second, secondGroup] = [-1, '']] = answers;
    const indexes = [first, second];
    if (answers.length !== 2 || first === second || indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= recoveryGroupCount) ||
      ![firstGroup, secondGroup].every(isRecoveryGroup)) throw new Error('invalid_request');
    return state(await native().confirmRecovery(first, normalizeGroup(firstGroup), second, normalizeGroup(secondGroup)));
  },
};
