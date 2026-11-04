import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { recoveryCode, recoveryGroupCount, type RecoveryState } from '../../../shared/api/recovery-code';

// Expo rejects with the native code in `code` (iOS wraps the message); a plain Error carries it as the message.
function code(cause: unknown): string {
  const value = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined;
  if (typeof value === 'string' && /^[a-z][a-z0-9_]{0,127}$/.test(value)) return value;
  return cause instanceof Error && /^[a-z][a-z0-9_]{0,127}$/.test(cause.message) ? cause.message : 'outcome_unknown';
}
// Two distinct group positions the user types back to confirm they wrote the code down.
function pick(random: () => number): [number, number] {
  const first = Math.floor(random() * recoveryGroupCount);
  const second = (first + 1 + Math.floor(random() * (recoveryGroupCount - 1))) % recoveryGroupCount;
  return first < second ? [first, second] : [second, first];
}

// The code stays hidden until the device lock check; it is hidden again when the app leaves the foreground or the
// panel closes, and never kept outside this hook's state. With `renew` (ADR0029 decision 3) the lock check returns the
// pending new code instead; the confirmed state does not change until it is confirmed, so the groups are asked only
// after it was shown once.
export function useRecoveryCode(onConfirmed: () => void, random: () => number = Math.random, renew = false) {
  const { t } = useTranslation();
  const [state, setState] = useState<RecoveryState | null>(null);
  const [groups, setGroups] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<[string, string]>(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [positions] = useState(() => pick(random));
  const mounted = useRef(true);
  const shown = useRef(false);
  // The system lock prompt itself makes the app `inactive` (iOS); only a trip to the background voids a pending reveal.
  const backgrounded = useRef(0);
  const hide = () => {
    setGroups(null); setCopied(false);
    if (shown.current) { shown.current = false; void recoveryCode.hide().catch(() => undefined); }
  };
  useEffect(() => {
    mounted.current = true;
    void recoveryCode.status().then((value) => { if (mounted.current) setState(value); }, (cause) => { if (mounted.current) setError(code(cause)); });
    const listener = AppState.addEventListener('change', (value) => {
      if (value === 'background') backgrounded.current += 1;
      if (value !== 'active') hide();
    });
    return () => { mounted.current = false; listener.remove(); hide(); };
  }, []);
  // A ref, not `working`: a second tap in the same render must not start a second lock prompt.
  const running = useRef(false);
  const busy = async (operation: () => Promise<void>) => {
    if (running.current) return;
    running.current = true; setWorking(true); setError(null);
    try { await operation(); } catch (cause) { if (mounted.current) setError(code(cause)); }
    finally { running.current = false; if (mounted.current) setWorking(false); }
  };
  const reveal = () => busy(async () => {
    const mark = backgrounded.current;
    const value = renew ? await recoveryCode.renew(t('recovery.promptTitle'), t('recovery.renewPromptReason'))
      : await recoveryCode.reveal(t('recovery.promptTitle'), t('recovery.promptReason'));
    shown.current = true;
    if (!mounted.current || backgrounded.current !== mark || AppState.currentState === 'background') { hide(); return; }
    setGroups(value); setRevealed(true); setState((current) => current === 'confirmed' ? current : 'pending');
  });
  const confirm = () => busy(async () => {
    const value = await recoveryCode.confirm([[positions[0], answers[0]], [positions[1], answers[1]]]);
    if (!mounted.current) return;
    setState(value); hide();
    if (value === 'confirmed') onConfirmed();
  });
  const copy = () => busy(async () => {
    if (!groups) return;
    await recoveryCode.copy(groups);
    if (mounted.current) setCopied(true);
  });
  const answer = (index: 0 | 1, value: string) => setAnswers((current) => index === 0 ? [value, current[1]] : [current[0], value]);
  const confirmable = renew ? revealed : state !== 'none' && state !== null;
  return { state, groups, positions, answers, error, working, copied, confirmable, reveal, hide, confirm, copy, answer };
}
