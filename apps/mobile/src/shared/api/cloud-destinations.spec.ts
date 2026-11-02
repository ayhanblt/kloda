import { requireOptionalNativeModule } from 'expo';
import { blockedProviders, cloudDestinationFromNative, cloudDestinations, validateCredentials, validateFolder, validateNextcloudServer } from './cloud-destinations';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
const target = 'A'.repeat(42) + 'E';
const row = { targetId: target, provider: 'nextcloud', endpoint: 'https://cloud.example/remote.php/dav/files/kloda', targetPath: 'Kloda', username: 'kloda' };
const native = { destinations: jest.fn(), signInNextcloud: jest.fn(), signInOAuth: jest.fn(), cancelSignIn: jest.fn(), addKolabNow: jest.fn(), removeDestination: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(requireOptionalNativeModule).mockReturnValue(native); });

it('accepts display metadata only and rejects a password or unknown field', () => {
  expect(cloudDestinationFromNative(row)).toEqual(row);
  expect(() => cloudDestinationFromNative({ ...row, password: 'x' })).toThrow('outcome_unknown');
  expect(() => cloudDestinationFromNative({ ...row, provider: 'box' })).toThrow('outcome_unknown');
  expect(() => cloudDestinationFromNative({ ...row, provider: 'dropbox', refreshToken: 'x' })).toThrow('outcome_unknown');
  expect(() => cloudDestinationFromNative({ ...row, endpoint: 'http://cloud.example/dav' })).toThrow('outcome_unknown');
  expect(() => cloudDestinationFromNative({ ...row, targetId: 'short' })).toThrow('outcome_unknown');
});

it('rejects duplicate or more than eight destinations from native', async () => {
  native.destinations.mockResolvedValueOnce({ destinations: [row, row] });
  await expect(cloudDestinations.list()).rejects.toThrow('outcome_unknown');
  native.destinations.mockResolvedValueOnce({ destinations: Array.from({ length: 9 }, () => row) });
  await expect(cloudDestinations.list()).rejects.toThrow('outcome_unknown');
  native.destinations.mockResolvedValueOnce({ destinations: [row] });
  await expect(cloudDestinations.list()).resolves.toEqual([row]);
});

it('validates server and folder before native sign-in', async () => {
  expect(validateNextcloudServer(' https://cloud.example/nc ')).toBe('https://cloud.example/nc');
  for (const bad of ['http://cloud.example', 'https://user@cloud.example', 'https://cloud.example/?a=1', 'https://cloud.example/../x']) {
    expect(() => validateNextcloudServer(bad)).toThrow('webdav_fields');
  }
  expect(validateFolder('/Kloda/Phone/')).toBe('Kloda/Phone');
  expect(() => validateFolder('../x')).toThrow('webdav_fields');
  native.signInNextcloud.mockResolvedValueOnce(row);
  await expect(cloudDestinations.signInNextcloud('https://cloud.example', 'Kloda')).resolves.toEqual(row);
  expect(native.signInNextcloud).toHaveBeenCalledWith('https://cloud.example', 'Kloda');
  await expect(cloudDestinations.signInNextcloud('http://cloud.example', 'Kloda')).rejects.toThrow('webdav_fields');
  expect(native.signInNextcloud).toHaveBeenCalledTimes(1);
});

it('removes by a valid targetId only and reports a missing native module', async () => {
  await expect(cloudDestinations.remove('bad')).rejects.toThrow('invalid_request');
  native.removeDestination.mockResolvedValueOnce({ destinations: [] });
  await expect(cloudDestinations.remove(target)).resolves.toEqual([]);
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  await expect(cloudDestinations.list()).rejects.toThrow('native_unsupported');
});

it('validates Kolab Now credentials and folder before native custody; CloudMe stays blocked', async () => {
  const kolab = { ...row, provider: 'kolab-now', endpoint: 'https://apps.kolabnow.com/files', username: 'me@kolabnow.com' };
  expect(validateCredentials(' me@kolabnow.com ', ' secret ')).toEqual(['me@kolabnow.com', ' secret ']);
  for (const [name, secret] of [['', 'x'], ['a:b', 'x'], ['me', ''], ['me', 'a\u0000b']]) {
    expect(() => validateCredentials(name, secret)).toThrow('webdav_fields');
  }
  native.addKolabNow.mockResolvedValueOnce(kolab);
  await expect(cloudDestinations.addKolabNow('me@kolabnow.com', 'secret', '/Kloda/')).resolves.toEqual(kolab);
  expect(native.addKolabNow).toHaveBeenCalledWith('me@kolabnow.com', 'secret', 'Kloda');
  await expect(cloudDestinations.addKolabNow('me', 'secret', '../x')).rejects.toThrow('webdav_fields');
  native.addKolabNow.mockResolvedValueOnce({ ...kolab, password: 'secret' });
  await expect(cloudDestinations.addKolabNow('me', 'secret', 'Kloda')).rejects.toThrow('outcome_unknown');
  expect(native.addKolabNow).toHaveBeenCalledTimes(2);
  expect(blockedProviders).toEqual(['cloudme']);
});

it('signs in to an OAuth provider with a normalized folder and accepts the account ID as display name only', async () => {
  const dropbox = { ...row, provider: 'dropbox', endpoint: 'https://api.dropboxapi.com', username: 'dbid:AAH4f99T0taONIb' };
  native.signInOAuth.mockResolvedValueOnce(dropbox);
  await expect(cloudDestinations.signInOAuth('dropbox', '/Kloda/')).resolves.toEqual(dropbox);
  expect(native.signInOAuth).toHaveBeenCalledWith('dropbox', 'Kloda');
  await expect(cloudDestinations.signInOAuth('dropbox', '../x')).rejects.toThrow('webdav_fields');
  await expect(cloudDestinations.signInOAuth('box' as never, 'Kloda')).rejects.toThrow('invalid_request');
  native.signInOAuth.mockResolvedValueOnce({ ...dropbox, refreshToken: 'secret' });
  await expect(cloudDestinations.signInOAuth('dropbox', 'Kloda')).rejects.toThrow('outcome_unknown');
  const onedrive = { ...row, provider: 'onedrive', endpoint: 'https://graph.microsoft.com', username: '9f8e7d6c5b4a3210' };
  native.signInOAuth.mockResolvedValueOnce(onedrive);
  await expect(cloudDestinations.signInOAuth('onedrive', 'Kloda')).resolves.toEqual(onedrive);
  native.signInOAuth.mockResolvedValueOnce(dropbox);
  await expect(cloudDestinations.signInOAuth('onedrive', 'Kloda')).rejects.toThrow('outcome_unknown');
  const yandex = { ...row, provider: 'yandex', endpoint: 'https://cloud-api.yandex.net', username: '1130000012345678' };
  native.signInOAuth.mockResolvedValueOnce(yandex);
  await expect(cloudDestinations.signInOAuth('yandex', 'Kloda')).resolves.toEqual(yandex);
  const drive = { ...row, provider: 'google-drive', endpoint: 'https://www.googleapis.com', username: '01234567890123456789' };
  native.signInOAuth.mockResolvedValueOnce(drive);
  await expect(cloudDestinations.signInOAuth('google-drive', 'Kloda')).resolves.toEqual(drive);
  expect(native.signInOAuth).toHaveBeenCalledTimes(6);
});
