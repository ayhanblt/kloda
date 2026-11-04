import { requireOptionalNativeModule } from 'expo';
import { recoveryCode } from './recovery-code';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
const code = '000G-40R4-0M30-E209-185G-R38E-1W81-24GK-2GAH-C5RR-34D1-P70X-3RFG-F3V8';
const native = { recoveryStatus: jest.fn(), revealRecovery: jest.fn(), renewRecovery: jest.fn(), hideRecovery: jest.fn(), confirmRecovery: jest.fn(), copyRecovery: jest.fn(), importRecovery: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(requireOptionalNativeModule).mockReturnValue(native); });

it('accepts only the exact native shapes', async () => {
  native.recoveryStatus.mockResolvedValueOnce({ state: 'pending' });
  await expect(recoveryCode.status()).resolves.toBe('pending');
  native.recoveryStatus.mockResolvedValueOnce({ state: 'pending', code });
  await expect(recoveryCode.status()).rejects.toThrow('outcome_unknown');
  native.revealRecovery.mockResolvedValueOnce({ code });
  await expect(recoveryCode.reveal('t', 'r')).resolves.toHaveLength(14);
  native.revealRecovery.mockResolvedValueOnce({ code: code.replace('000G', '000I') });
  await expect(recoveryCode.reveal('t', 'r')).rejects.toThrow('outcome_unknown');
  native.renewRecovery.mockResolvedValueOnce({ code });
  await expect(recoveryCode.renew('t', 'r')).resolves.toEqual(code.split('-'));
  native.renewRecovery.mockResolvedValueOnce({ code, extra: 1 });
  await expect(recoveryCode.renew('t', 'r')).rejects.toThrow('outcome_unknown');
});

it('normalizes answers and refuses invalid positions before native', async () => {
  native.confirmRecovery.mockResolvedValueOnce({ state: 'confirmed' });
  await expect(recoveryCode.confirm([[0, ' 000g'], [13, 'f3v8']])).resolves.toBe('confirmed');
  expect(native.confirmRecovery).toHaveBeenCalledWith(0, '000G', 13, 'F3V8');
  await expect(recoveryCode.confirm([[2, '0M30'], [2, '0M30']])).rejects.toThrow('invalid_request');
  await expect(recoveryCode.confirm([[0, '000G'], [14, 'F3V8']])).rejects.toThrow('invalid_request');
  await expect(recoveryCode.confirm([[0, '000G'], [1, 'IOU!']])).rejects.toThrow('invalid_request');
  expect(native.confirmRecovery).toHaveBeenCalledTimes(1);
});

it('copies only a well-formed shown code', async () => {
  native.copyRecovery.mockResolvedValueOnce({});
  await expect(recoveryCode.copy(code.split('-'))).resolves.toBeUndefined();
  expect(native.copyRecovery).toHaveBeenCalledWith(code);
  await expect(recoveryCode.copy(code.split('-').slice(1))).rejects.toThrow('invalid_request');
  expect(native.copyRecovery).toHaveBeenCalledTimes(1);
});

it('imports through native and accepts only the exact summary shape', async () => {
  const summary = { chains: 1, deltas: 2, entries: 5, unverified: 1, imported: 5 };
  native.importRecovery.mockResolvedValueOnce(summary);
  await expect(recoveryCode.importCatalog('target', ' abcd-efgh ')).resolves.toEqual(summary);
  expect(native.importRecovery).toHaveBeenLastCalledWith('target', ' abcd-efgh ');
  native.importRecovery.mockResolvedValueOnce({ ...summary, extra: 1 });
  await expect(recoveryCode.importCatalog('target', 'x')).rejects.toThrow('outcome_unknown');
  native.importRecovery.mockResolvedValueOnce({ ...summary, deltas: -1 });
  await expect(recoveryCode.importCatalog('target', 'x')).rejects.toThrow('outcome_unknown');
  native.importRecovery.mockClear();
  await expect(recoveryCode.importCatalog('', 'x')).rejects.toThrow('invalid_request');
  await expect(recoveryCode.importCatalog('target', 'x'.repeat(257))).rejects.toThrow('invalid_request');
  expect(native.importRecovery).not.toHaveBeenCalled();
});
