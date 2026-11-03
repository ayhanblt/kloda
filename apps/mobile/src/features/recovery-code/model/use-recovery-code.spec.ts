import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { recoveryCode } from '../../../shared/api/recovery-code';
import { useRecoveryCode } from './use-recovery-code';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../shared/api/recovery-code', () => ({
  recoveryGroupCount: 14,
  recoveryCode: { status: jest.fn(), reveal: jest.fn(), hide: jest.fn(), confirm: jest.fn() },
}));
const api = jest.mocked(recoveryCode);
const groups = ['000G', '40R4', '0M30', 'E209', '185G', 'R38E', '1W81', '24GK', '2GAH', 'C5RR', '34D1', 'P70X', '3RFG', 'F3V8'];
const originalState = AppState.currentState;
let change: (state: AppStateStatus) => void = () => undefined;
beforeEach(() => {
  jest.clearAllMocks();
  api.status.mockResolvedValue('none'); api.hide.mockResolvedValue();
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { change = listener; return { remove: jest.fn() }; });
});
afterEach(() => { AppState.currentState = originalState; jest.restoreAllMocks(); });

it('keeps the code hidden until the native lock check returns it, and hides it in the background', async () => {
  const hook = await renderHook(() => useRecoveryCode(jest.fn(), () => 0));
  await waitFor(() => expect(hook.result.current.state).toBe('none'));
  expect(hook.result.current.groups).toBeNull();
  api.reveal.mockResolvedValueOnce(groups);
  await act(async () => { await hook.result.current.reveal(); });
  expect(api.reveal).toHaveBeenCalledWith('recovery.promptTitle', 'recovery.promptReason');
  expect(hook.result.current.groups).toEqual(groups);
  expect(hook.result.current.state).toBe('pending');
  await act(async () => { change('background'); });
  expect(hook.result.current.groups).toBeNull();
  expect(api.hide).toHaveBeenCalledTimes(1);
});

it('shows the code after the prompt made the app inactive, but not after a trip to the background', async () => {
  const hook = await renderHook(() => useRecoveryCode(jest.fn(), () => 0));
  await waitFor(() => expect(hook.result.current.state).toBe('none'));
  api.reveal.mockImplementationOnce(async () => { change('inactive'); AppState.currentState = 'active'; return groups; });
  await act(async () => { await hook.result.current.reveal(); });
  expect(hook.result.current.groups).toEqual(groups);
  await act(async () => { hook.result.current.hide(); });
  api.reveal.mockImplementationOnce(async () => { change('background'); change('active'); return groups; });
  await act(async () => { await hook.result.current.reveal(); });
  expect(hook.result.current.groups).toBeNull();
  expect(api.hide).toHaveBeenCalledTimes(2);
});

it('reports a refused lock check without showing anything', async () => {
  const hook = await renderHook(() => useRecoveryCode(jest.fn(), () => 0));
  await waitFor(() => expect(hook.result.current.state).toBe('none'));
  api.reveal.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'recovery_lock_required' }));
  await act(async () => { await hook.result.current.reveal(); });
  expect(hook.result.current.groups).toBeNull();
  expect(hook.result.current.error).toBe('recovery_lock_required');
});

it('confirms two distinct groups and then retries the enable', async () => {
  api.status.mockResolvedValue('pending');
  const confirmed = jest.fn();
  const hook = await renderHook(() => useRecoveryCode(confirmed, () => 0.5));
  await waitFor(() => expect(hook.result.current.state).toBe('pending'));
  const [first, second] = hook.result.current.positions;
  expect(first).not.toBe(second);
  await act(async () => { hook.result.current.answer(0, 'wrong'); hook.result.current.answer(1, 'f3v8'); });
  api.confirm.mockRejectedValueOnce(new Error('recovery_mismatch'));
  await act(async () => { await hook.result.current.confirm(); });
  expect(hook.result.current.error).toBe('recovery_mismatch');
  expect(confirmed).not.toHaveBeenCalled();
  api.confirm.mockResolvedValueOnce('confirmed');
  await act(async () => { await hook.result.current.confirm(); });
  expect(api.confirm).toHaveBeenLastCalledWith([[first, 'wrong'], [second, 'f3v8']]);
  expect(hook.result.current.state).toBe('confirmed');
  expect(confirmed).toHaveBeenCalledTimes(1);
});
