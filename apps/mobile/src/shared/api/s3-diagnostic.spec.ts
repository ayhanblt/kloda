import { requireOptionalNativeModule } from 'expo';
import { s3, s3StatusFromNative, s3TestFromNative } from './s3';
jest.mock('expo',() => ({ requireOptionalNativeModule:jest.fn() }));
const id = 'c743dfae-e2f9-4c45-a688-cbf43c9030a4';
const result = { provider:'amazon-s3',state:'completed',id,size:4097,sha256:'A'.repeat(43) };
it('keeps diagnostic authority separate from general activation and rejects secret or unverified results',() => {
  const idle = { provider:'amazon-s3',supported:true,configured:false,enabled:false,canRun:false };
  expect(() => s3StatusFromNative({ ...idle,canTest:true },'amazon-s3')).toThrow();
  expect(s3TestFromNative(result,'amazon-s3').size).toBe(4097);
  for (const change of [{ provider:'s3-compatible' },{ state:'review' },{ size:4098 },{ secret:'unexpected' },{ sha256:'etag' }]) {
    expect(() => s3TestFromNative({ ...result,...change },'amazon-s3')).toThrow();
  }
});
it('sends only provider and request to the diagnostic native action, then cancels the same request',async () => {
  const testS3 = jest.fn().mockResolvedValue(result), cancelS3Test = jest.fn().mockResolvedValue(undefined);
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ testS3,cancelS3Test });
  await expect(s3.test('amazon-s3',id)).resolves.toEqual(result);
  await s3.cancelTest(id);
  expect(testS3).toHaveBeenCalledWith('amazon-s3',id); expect(cancelS3Test).toHaveBeenCalledWith(id);
});

it('creates request IDs natively without relying on a Hermes global crypto implementation',() => {
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ s3TestRequest:() => id }); expect(s3.newRequest()).toBe(id);
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ s3TestRequest:() => 'not-a-uuid' }); expect(() => s3.newRequest()).toThrow();
  jest.mocked(requireOptionalNativeModule).mockReturnValue({}); expect(() => s3.newRequest()).toThrow('native_unavailable');
});
