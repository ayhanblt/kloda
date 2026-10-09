import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import '../../../shared/i18n';
import { pairing } from '../../../shared/api/pairing';
import { usePairing } from './use-pairing';

jest.mock('sonner-native', () => ({ toast: { error: jest.fn() } }));

it('revokes queued camera callbacks synchronously on background and requires explicit rearming', async () => {
  const originalState = AppState.currentState;
  AppState.currentState = 'active';
  let change: (state: AppStateStatus) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    change = listener;
    return { remove: jest.fn() };
  });
  jest.spyOn(pairing, 'status').mockResolvedValue({ phase: 'idle' });
  jest.spyOn(pairing, 'close').mockResolvedValue(undefined);
  const scan = jest.spyOn(pairing, 'scan').mockResolvedValue({ phase: 'pending', operationId: 'native-operation' });
  try {
    const { result, unmount } = await renderHook(() => usePairing());
    await act(() => { expect(result.current.armScan()).toBe(true); });
    const queuedCallback = result.current.scan;
    await act(async () => {
      change('background');
      await queuedCallback('synthetic-queued-qr');
      expect(result.current.armScan()).toBe(false);
    });
    expect(scan).not.toHaveBeenCalled();
    await act(async () => { change('active'); });
    await act(async () => { await queuedCallback('synthetic-before-rearm'); });
    expect(scan).not.toHaveBeenCalled();
    await act(async () => {
      expect(result.current.armScan()).toBe(true);
      await result.current.scan('synthetic-explicit-rearm');
    });
    expect(result.current.snapshot.status?.phase).toBe('pending');
    await unmount();
    await queuedCallback('synthetic-after-unmount');
    expect(scan).toHaveBeenCalledTimes(1);
  } finally {
    AppState.currentState = originalState;
    jest.restoreAllMocks();
  }
});
