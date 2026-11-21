import { requireOptionalNativeModule } from 'expo';
import { s3, s3StatusFromNative } from './s3';
import { s3Backups } from './s3-backups';
jest.mock('expo',() => ({ requireOptionalNativeModule:jest.fn() }));
const id = '12345678-1234-1234-1234-123456789abc', replacement = '22345678-1234-1234-1234-123456789abc', request = '32345678-1234-1234-1234-123456789abc';
const hash = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const file = { id,name:'owned.jpg',path:'owned/owned.jpg',kind:'file' as const,size:'5',sha256:hash };
const page = { targetId:hash,items:[file],hasMore:false,canRestoreFiles:true,canRestorePhotos:true };
beforeEach(() => jest.clearAllMocks());
it('requires enabled C1 capability for automatic work and validates its native result',async () => {
  const status = { provider:'amazon-s3',supported:true,configured:true,enabled:true,canRun:true,canEnable:true,canAutomatic:true,automaticEnabled:true,
    profile:{ endpoint:'https://s3.eu-north-1.amazonaws.com',region:'eu-north-1',bucket:'owned-bucket',prefix:'owned',pathStyle:false } };
  const automaticS3 = jest.fn().mockResolvedValue(status); jest.mocked(requireOptionalNativeModule).mockReturnValue({ automaticS3 });
  expect((await s3.automatic('amazon-s3',true)).automaticEnabled).toBe(true);
  expect(automaticS3).toHaveBeenCalledWith('amazon-s3',true);
  expect(() => s3StatusFromNative({ ...status,enabled:false },'amazon-s3')).toThrow();
  expect(() => s3StatusFromNative({ ...status,canEnable:false },'amazon-s3')).toThrow();
});
it('rejects provider confusion, credential echo, duplicate rows and unbounded catalogue pages',async () => {
  const s3BackupsNative = jest.fn(); jest.mocked(requireOptionalNativeModule).mockReturnValue({ s3Backups:s3BackupsNative });
  for (const value of [{ provider:'s3-compatible',page },{ provider:'amazon-s3',page,secret:'no' },
    { provider:'amazon-s3',page:{ ...page,items:[file,file] } },{ provider:'amazon-s3',page:{ ...page,items:Array(101).fill(file) } }]) {
    s3BackupsNative.mockResolvedValue(value); await expect(s3Backups.list('amazon-s3')).rejects.toThrow();
  }
  s3BackupsNative.mockResolvedValue({ provider:'amazon-s3',page }); expect((await s3Backups.list('amazon-s3')).items).toHaveLength(1);
});
it('routes Files and Photos restore distinctly and rejects resource-only import requests',async () => {
  const result = { id,state:'completed',name:'owned.jpg' };
  const restoreS3File = jest.fn().mockResolvedValue(result), restoreS3Photos = jest.fn().mockResolvedValue(result);
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ s3Backups:jest.fn(),restoreS3File,restoreS3Photos });
  await s3Backups.restore('amazon-s3',file,request); await s3Backups.restore('amazon-s3',{ ...file,kind:'photo_manifest' },request);
  expect(restoreS3File).toHaveBeenCalledWith('amazon-s3',id,request); expect(restoreS3Photos).toHaveBeenCalledWith('amazon-s3',id,request);
  await expect(s3Backups.restore('amazon-s3',{ ...file,kind:'photo_resource' },request)).rejects.toThrow();
});
it('requires a new receipt for explicit copy and sends cancellation to the corresponding native owner',async () => {
  const reviewS3 = jest.fn().mockResolvedValue({ id:replacement,state:'completed',path:'owned/owned.jpg' });
  const cancelS3Test = jest.fn(), cancelS3Restore = jest.fn();
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ s3Backups:jest.fn(),reviewS3,cancelS3Test,cancelS3Restore });
  await expect(s3Backups.copy('amazon-s3',id,request)).resolves.toBe('owned/owned.jpg');
  reviewS3.mockResolvedValue({ id,state:'completed',path:'owned/owned.jpg' }); await expect(s3Backups.copy('amazon-s3',id,request)).rejects.toThrow();
  await expect(s3Backups.copy('s3-compatible',id,request)).rejects.toThrow();
  await s3Backups.cancel(request,true); await s3Backups.cancel(request);
  expect(cancelS3Test).toHaveBeenCalledWith(request); expect(cancelS3Restore).toHaveBeenCalledWith(request);
});
