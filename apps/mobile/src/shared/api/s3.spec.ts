import { requireOptionalNativeModule } from 'expo';
import { emptyS3Form, s3, s3StatusFromNative, validateS3Form } from './s3';
jest.mock('expo',() => ({ requireOptionalNativeModule:jest.fn() }));
const form = { ...emptyS3Form,region:'us-east-1',bucket:'owned-bucket',prefix:'owned',accessKey:'synthetic',secret:'synthetic-secret' };
beforeEach(() => jest.clearAllMocks());
it('keeps AWS endpoint/credentials separate from P5 and rejects unsafe scope input',() => {
  expect(validateS3Form('amazon-s3',form).endpoint).toBe('https://s3.us-east-1.amazonaws.com');
  expect(validateS3Form('amazon-s3',{ ...form,bucket:'owned.bucket' }).pathStyle).toBe(true);
  for (const change of [{ prefix:'../escape' },{ bucket:'127.0.0.1' },{ secret:'' }]) expect(() => validateS3Form('amazon-s3',{ ...form,...change })).toThrow('s3_fields');
  expect(() => validateS3Form('s3-compatible',{ ...form,endpoint:'https://u:p@example.test' })).toThrow('s3_fields');
});
it('rejects provider confusion, secret echo and unsupported native activation',() => {
  const idle = { provider:'amazon-s3',supported:true,configured:false,enabled:false,canRun:false };
  expect(() => s3StatusFromNative({ ...idle,secret:'leaked' },'amazon-s3')).toThrow();
  expect(() => s3StatusFromNative(idle,'s3-compatible')).toThrow();
  expect(() => s3StatusFromNative({ ...idle,enabled:true },'amazon-s3')).toThrow();
});
it('sends credentials only to the selected native configure call, never in returned status',async () => {
  const configureS3 = jest.fn().mockResolvedValue({ provider:'amazon-s3',supported:true,configured:false,enabled:false,canRun:false });
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ configureS3 });
  const result = await s3.configure('amazon-s3',form);
  expect(configureS3).toHaveBeenCalledWith('amazon-s3',expect.objectContaining({ secret:'synthetic-secret',token:null }));
  expect(JSON.stringify(result)).not.toContain('synthetic-secret');
});

it('retains a valid saved AWS path-style profile without treating a trailing root slash as another target',() => {
 const native = { provider:'amazon-s3',supported:true,configured:true,enabled:false,canRun:false,profile:{ endpoint:'https://s3.us-east-1.amazonaws.com/',region:'us-east-1',bucket:'owned-bucket',prefix:'owned',pathStyle:true } };
 expect(s3StatusFromNative(native,'amazon-s3').profile?.pathStyle).toBe(true);
});
