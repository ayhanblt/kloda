import { act, renderHook, waitFor } from '@testing-library/react-native';
import { cloudDestinations } from '../../../shared/api/cloud-destinations';
import { useCloudDestinations } from './use-cloud-destinations';

jest.mock('../../../shared/api/cloud-destinations', () => ({
  destinationLimit: 8,
  cloudDestinations: { list: jest.fn(), signInNextcloud: jest.fn(), signInOAuth: jest.fn(), addKolabNow: jest.fn(), cancelSignIn: jest.fn(), remove: jest.fn() },
}));
const api = jest.mocked(cloudDestinations);
const row = (n: number) => ({ targetId: String(n).padStart(42, 'A') + 'E', provider: 'nextcloud' as const, endpoint: 'https://c.example/remote.php/dav/files/k', targetPath: 'Kloda', username: 'k' });
beforeEach(() => { jest.clearAllMocks(); api.list.mockResolvedValue([row(1)]); api.cancelSignIn.mockResolvedValue(); });

it('lists, adds a signed-in destination and reports the limit', async () => {
  const hook = await renderHook(() => useCloudDestinations());
  await waitFor(() => expect(hook.result.current.destinations).toEqual([row(1)]));
  api.signInNextcloud.mockResolvedValueOnce(row(2));
  await act(async () => { await hook.result.current.signIn('https://c.example', 'Kloda'); });
  expect(hook.result.current.destinations).toEqual([row(1), row(2)]);
  expect(hook.result.current.full).toBe(false);
  api.list.mockResolvedValueOnce(Array.from({ length: 8 }, (_, i) => row(i)));
  await act(async () => { await hook.result.current.refresh(); });
  expect(hook.result.current.full).toBe(true);
});

it('shows the native code and allows one action at a time', async () => {
  const hook = await renderHook(() => useCloudDestinations());
  await waitFor(() => expect(hook.result.current.destinations).not.toBeNull());
  let finish: (value: never) => void = () => undefined;
  api.signInNextcloud.mockImplementationOnce(() => new Promise((_, reject) => { finish = () => reject(new Error('nextcloud_server_mismatch')); }));
  let first: Promise<void> = Promise.resolve();
  await act(async () => { first = hook.result.current.signIn('https://c.example', 'Kloda'); });
  expect(hook.result.current.action).toBe('signing-in');
  await act(async () => { await hook.result.current.remove(row(1).targetId); });
  expect(api.remove).not.toHaveBeenCalled();
  await act(async () => { finish(undefined as never); await first; });
  expect(hook.result.current.error).toBe('nextcloud_server_mismatch');
  expect(hook.result.current.action).toBe('idle');
});

it('cancels a pending sign-in on unmount', async () => {
  const hook = await renderHook(() => useCloudDestinations());
  await waitFor(() => expect(hook.result.current.destinations).not.toBeNull());
  await hook.unmount();
  expect(api.cancelSignIn).toHaveBeenCalled();
});

it('adds a Kolab Now destination and shows a native refusal', async () => {
  const hook = await renderHook(() => useCloudDestinations());
  await waitFor(() => expect(hook.result.current.destinations).toEqual([row(1)]));
  const kolab = { ...row(3), provider: 'kolab-now' as const, endpoint: 'https://apps.kolabnow.com/files' };
  api.addKolabNow.mockResolvedValueOnce(kolab);
  await act(async () => { await hook.result.current.addKolabNow('me@kolabnow.com', 'secret', 'Kloda'); });
  expect(api.addKolabNow).toHaveBeenCalledWith('me@kolabnow.com', 'secret', 'Kloda');
  expect(hook.result.current.destinations).toEqual([row(1), kolab]);
  api.addKolabNow.mockRejectedValueOnce(new Error('destination_exists'));
  await act(async () => { await hook.result.current.addKolabNow('me@kolabnow.com', 'secret', 'Kloda'); });
  expect(hook.result.current.error).toBe('destination_exists');
  expect(hook.result.current.action).toBe('idle');
});

it('adds a signed-in Dropbox destination and shows a cancelled sign-in', async () => {
  const hook = await renderHook(() => useCloudDestinations());
  await waitFor(() => expect(hook.result.current.destinations).toEqual([row(1)]));
  const dropbox = { ...row(4), provider: 'dropbox' as const, endpoint: 'https://api.dropboxapi.com', username: 'dbid:A' };
  api.signInOAuth.mockResolvedValueOnce(dropbox);
  await act(async () => { await hook.result.current.signInOAuth('dropbox', 'Kloda'); });
  expect(api.signInOAuth).toHaveBeenCalledWith('dropbox', 'Kloda');
  expect(hook.result.current.destinations).toEqual([row(1), dropbox]);
  api.signInOAuth.mockRejectedValueOnce(new Error('cancelled'));
  await act(async () => { await hook.result.current.signInOAuth('onedrive', 'Kloda'); });
  expect(hook.result.current.error).toBe('cancelled');
  expect(hook.result.current.action).toBe('idle');
});
