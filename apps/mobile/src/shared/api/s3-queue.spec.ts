import { requireOptionalNativeModule } from 'expo';
import { s3, s3StatusFromNative } from './s3';
jest.mock('expo',() => ({ requireOptionalNativeModule:jest.fn() }));
const status = { provider:'amazon-s3',supported:true,configured:true,enabled:true,canEnable:true,canRun:false,running:true,
  profile:{ endpoint:'https://s3.eu-north-1.amazonaws.com',region:'eu-north-1',bucket:'owned-bucket',prefix:'owned',pathStyle:false },
  run:{ id:'12345678-1234-1234-1234-123456789abc',state:'running',counts:{ verifiedFiles:'1',verifiedBytes:'4097' } } };
it('accepts explicit C1 queue status, rejects inconsistent state, unsafe counts and secret echoes',() => {
  expect(s3StatusFromNative(status,'amazon-s3').run?.counts.verifiedBytes).toBe('4097');
  for (const change of [{ canEnable:false },{ enabled:false },{ canRun:true },{ running:false },{ provider:'s3-compatible' },
    { run:{ ...status.run,counts:{ verifiedFiles:'-1',verifiedBytes:'4097' } } },
    { run:{ ...status.run,counts:{ verifiedFiles:'1',verifiedBytes:'9223372036854775808' } } },
    { run:{ ...status.run,secret:'no' } }]) expect(() => s3StatusFromNative({ ...status,...change },'amazon-s3')).toThrow();
});
it('routes opt-in and pause only through their native action and validates returned metadata',async () => {
  const enableS3 = jest.fn().mockResolvedValue(status), pauseS3 = jest.fn().mockResolvedValue({ ...status,running:false,canRun:true,run:{ ...status.run,state:'paused' } });
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ enableS3,pauseS3 });
  await s3.action('amazon-s3','enableS3'); expect(enableS3).toHaveBeenCalledWith('amazon-s3');
  expect((await s3.action('amazon-s3','pauseS3')).run?.state).toBe('paused'); expect(pauseS3).toHaveBeenCalledTimes(1);
});
