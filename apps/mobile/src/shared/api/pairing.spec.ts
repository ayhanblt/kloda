import { requireOptionalNativeModule } from 'expo';

import { pairing, PairingError } from './pairing';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => null) }));

const optionalModule = jest.mocked(requireOptionalNativeModule);

describe('phone native pairing availability', () => {
  beforeEach(() => optionalModule.mockReturnValue(null));

  it('fails closed when the native module is absent instead of accepting scan or fabricating a pin', async () => {
    await expect(pairing.status()).rejects.toEqual(new PairingError('native_unsupported'));
    await expect(pairing.scan('camera-qr')).rejects.toEqual(new PairingError('native_unsupported'));
    await expect(pairing.resume('saved-record')).rejects.toEqual(new PairingError('native_unsupported'));
  });

  it('drops accidental QR and private fields from native status before consumers see it', async () => {
    optionalModule.mockReturnValue({
      status: async () => ({ phase: 'pending', operationId: 'op', qr: 'never-render-this-secret', certificate: 'private', keyHandle: 'private' }),
    });
    const result = await pairing.status();
    expect(result.phase).toBe('pending');
    expect(result).not.toHaveProperty('qr');
    expect(result).not.toHaveProperty('certificate');
    expect(result).not.toHaveProperty('keyHandle');
  });

  it('preserves only known asynchronous error and hardware classifications', async () => {
    optionalModule.mockReturnValue({
      status: async () => ({
        phase: 'invalid', errorCode: 'tls_rejected', hardwareClass: 'strongbox',
        message: 'private-TLS-detail', certificate: 'private',
      }),
    });
    const status = await pairing.status();
    expect(status).toMatchObject({ phase: 'invalid', errorCode: 'tls_rejected', hardwareClass: 'strongbox' });
    expect(status).not.toHaveProperty('message');
    expect(status).not.toHaveProperty('certificate');
  });

  it('maps unknown present errors to outcome_unknown and drops unknown hardware classes', async () => {
    optionalModule.mockReturnValue({
      status: async () => ({ phase: 'invalid', errorCode: 'private-native-detail', hardwareClass: 'toString' }),
    });
    expect(await pairing.status()).toMatchObject({
      phase: 'invalid', errorCode: 'outcome_unknown', hardwareClass: undefined,
    });
    optionalModule.mockReturnValue({ status: async () => ({ phase: 'idle' }) });
    expect((await pairing.status()).errorCode).toBeUndefined();
  });

  it('does not interpret malformed or unrecognized native status as an idle or complete result', async () => {
    optionalModule.mockReturnValue({ status: async () => ({ phase: 'success', recordId: 'not-evidence' }) });
    await expect(pairing.status()).rejects.toEqual(new PairingError('outcome_unknown'));
    optionalModule.mockReturnValue({ status: async () => ({ phase: 'complete', repairRequired: 'yes' }) });
    await expect(pairing.status()).rejects.toEqual(new PairingError('outcome_unknown'));
  });
});
