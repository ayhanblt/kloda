import { requireOptionalNativeModule } from 'expo';
import { recoveryCode } from './recovery-code';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
const code = '000G-40R4-0M30-E209-185G-R38E-1W81-24GK-2GAH-C5RR-34D1-P70X-3RFG-F3V8';
const native = { recoveryStatus: jest.fn(), revealRecovery: jest.fn(), hideRecovery: jest.fn(), confirmRecovery: jest.fn() };
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
