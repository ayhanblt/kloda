import { smb, smbStatusFromNative, validateSmbForm } from './smb';
import { smbPageFromNative } from './smb-backups';
const mockNative = { smbStatus:jest.fn(),configureSmb:jest.fn(),enableSmb:jest.fn() };
jest.mock('expo',() => ({ requireOptionalNativeModule:() => mockNative }));
const form = { address:'192.168.1.10',port:'445',share:'owned',root:'backup',username:'owned',domain:'',password:'fixture' };
const target = 'A'.repeat(43), id = '11111111-1111-4111-8111-111111111111';
const status = { supported:true,configured:true,enabled:true,running:false,targetId:target,config:{ address:form.address,port:445,share:form.share,root:form.root,username:form.username,domain:'' } };
const run = { id,targetId:target,automatic:false,state:'finished',attempts:1,osAttempts:1,counts:{ operations:'1',completedOperations:'1',files:'1',completedFiles:'1',photos:'0',completedPhotos:'0' } };
beforeEach(() => jest.clearAllMocks());
it('accepts numeric LAN syntax and rejects DNS, loopback, fallback and unsafe roots before a native call',async () => {
  expect(validateSmbForm(form)).toEqual(form);
  for (const changed of [{ address:'nas.local' },{ address:'127.0.0.1' },{ address:'8.8.8.8' },{ port:'0' },{ port:'65536' },{ root:'../outside' },{ share:'a/b' },{ password:'' }]) {
    await expect(smb.configure({ ...form,...changed })).rejects.toThrow('smb_fields');
  }
  expect(mockNative.configureSmb).not.toHaveBeenCalled();
});
it('keeps passwords outside native status and rejects false completion, missing target and unknown state',() => {
  expect(smbStatusFromNative({ ...status,run }).run?.counts.files).toBe('1');
  for (const raw of [{ ...status,config:{ ...status.config,password:'secret' } },{ ...status,run:{ ...run,targetId:'B'.repeat(43) } },{ ...status,run:{ ...run,counts:{ ...run.counts,completedOperations:'0' } } },{ ...status,running:true },{ ...status,run:{ ...run,state:'waiting' } }]) expect(() => smbStatusFromNative(raw)).toThrow();
});
it('enables only from an explicit action and sends credentials solely to native configuration',async () => {
  mockNative.smbStatus.mockResolvedValue(status); mockNative.configureSmb.mockResolvedValue(status); mockNative.enableSmb.mockResolvedValue(status);
  await smb.status(); expect(mockNative.configureSmb).not.toHaveBeenCalled(); expect(mockNative.enableSmb).not.toHaveBeenCalled();
  await smb.configure(form); expect(mockNative.configureSmb).toHaveBeenCalledWith(form.address,445,form.share,form.root,form.username,'',form.password);
  await smb.action('enable'); expect(mockNative.enableSmb).toHaveBeenCalledTimes(1);
});
it('rejects duplicate catalog rows and inconsistent pagination',() => {
  const item = { id,name:'owned.bin',path:'source/owned.bin',kind:'file',sha256:target,size:'1' };
  const page = { targetId:target,items:[item],hasMore:false,canRestoreFiles:true,canRestorePhotos:true };
  expect(smbPageFromNative(page).items).toHaveLength(1);
  expect(() => smbPageFromNative({ ...page,items:[item,item] })).toThrow();
  expect(() => smbPageFromNative({ ...page,hasMore:true })).toThrow();
});
