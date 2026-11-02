import { sftp, sftpStatusFromNative, validateSftpForm } from './sftp';
import { sftpPageFromNative } from './sftp-backups';
const mockNative = { sftpStatus:jest.fn(),configureSftp:jest.fn(),enableSftp:jest.fn() };
jest.mock('expo',() => ({ requireOptionalNativeModule:() => mockNative }));
const form = { address:'192.168.1.10',port:'22',root:'/backup',username:'owned',fingerprint:'SHA256:'+'A'.repeat(43),password:'fixture' };
const target = 'A'.repeat(43), id = '11111111-1111-4111-8111-111111111111';
const status = { supported:true,configured:true,enabled:true,running:false,targetId:target,config:{ address:form.address,port:22,root:form.root,username:form.username,fingerprint:form.fingerprint } };
const run = { id,targetId:target,automatic:false,state:'finished',attempts:1,osAttempts:1,counts:{ operations:'1',completedOperations:'1',files:'1',completedFiles:'1',photos:'0',completedPhotos:'0' } };
beforeEach(() => jest.clearAllMocks());
it('accepts numeric LAN syntax and rejects DNS, loopback, fallback and unsafe roots before a native call',async () => {
  expect(validateSftpForm(form)).toEqual(form);
  for (const changed of [{ address:'nas.local' },{ address:'127.0.0.1' },{ address:'8.8.8.8' },{ port:'0' },{ port:'65536' },{ root:'../outside' },{ fingerprint:'SHA256:'+'B'.repeat(43) },{ fingerprint:'' },{ root:'/a/../b' },{ root:'/a//b' },{ root:'/a/' },{ password:'' }]) {
    await expect(sftp.configure({ ...form,...changed })).rejects.toThrow('sftp_fields');
  }
  expect(mockNative.configureSftp).not.toHaveBeenCalled();
});
it('keeps passwords outside native status and rejects false completion, missing target and unknown state',() => {
  expect(sftpStatusFromNative({ ...status,run }).run?.counts.files).toBe('1');
  for (const raw of [{ ...status,config:{ ...status.config,password:'secret' } },{ ...status,run:{ ...run,targetId:'B'.repeat(43) } },{ ...status,run:{ ...run,counts:{ ...run.counts,completedOperations:'0' } } },{ ...status,running:true },{ ...status,run:{ ...run,state:'waiting' } }]) expect(() => sftpStatusFromNative(raw)).toThrow();
});
it('enables only from an explicit action and sends credentials solely to native configuration',async () => {
  mockNative.sftpStatus.mockResolvedValue(status); mockNative.configureSftp.mockResolvedValue(status); mockNative.enableSftp.mockResolvedValue(status);
  await sftp.status(); expect(mockNative.configureSftp).not.toHaveBeenCalled(); expect(mockNative.enableSftp).not.toHaveBeenCalled();
  await sftp.configure(form); expect(mockNative.configureSftp).toHaveBeenCalledWith(form.address,22,form.fingerprint,form.root,form.username,form.password);
  await sftp.action('enable'); expect(mockNative.enableSftp).toHaveBeenCalledTimes(1);
});
it('rejects duplicate catalog rows and inconsistent pagination',() => {
  const item = { id,name:'owned.bin',path:'source/owned.bin',kind:'file',sha256:target,size:'1' };
  const page = { targetId:target,items:[item],hasMore:false,canRestoreFiles:true,canRestorePhotos:true };
  expect(sftpPageFromNative(page).items).toHaveLength(1);
  expect(() => sftpPageFromNative({ ...page,items:[item,item] })).toThrow();
  expect(() => sftpPageFromNative({ ...page,hasMore:true })).toThrow();
});
