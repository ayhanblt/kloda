import { ftps, ftpsStatusFromNative, validateFtpsForm } from './ftps';
import { ftpsPageFromNative } from './ftps-backups';
const mockNative = { ftpsStatus:jest.fn(),configureFtps:jest.fn(),enableFtps:jest.fn() };
let mockModule: Record<string, unknown> | null = mockNative;
jest.mock('expo',() => ({ requireOptionalNativeModule:() => mockModule }));
const form = { address:'192.168.1.10',port:'21',root:'/backup',username:'owned',hostname:'nas.example.test',password:'fixture' };
const target = 'A'.repeat(43), id = '11111111-1111-4111-8111-111111111111';
const status = { supported:true,configured:true,enabled:true,running:false,targetId:target,config:{ address:form.address,port:21,root:form.root,username:form.username,hostname:form.hostname } };
const run = { id,targetId:target,automatic:false,state:'finished',attempts:1,osAttempts:1,counts:{ operations:'1',completedOperations:'1',files:'1',completedFiles:'1',photos:'0',completedPhotos:'0' } };
beforeEach(() => { jest.clearAllMocks(); mockModule = mockNative; });
it('accepts numeric LAN syntax and rejects DNS, loopback, fallback and unsafe roots before a native call',async () => {
  expect(validateFtpsForm(form)).toEqual(form);
  for (const changed of [{ address:'nas.local' },{ address:'127.0.0.1' },{ address:'8.8.8.8' },{ port:'0' },{ port:'65536' },{ root:'../outside' },{ hostname:'-bad.example' },{ hostname:'' },{ root:'/a/../b' },{ root:'/a//b' },{ root:'/a/' },{ password:'' }]) {
    await expect(ftps.configure({ ...form,...changed })).rejects.toThrow('ftps_fields');
  }
  expect(mockNative.configureFtps).not.toHaveBeenCalled();
});
it('keeps passwords outside native status and rejects false completion, missing target and unknown state',() => {
  expect(ftpsStatusFromNative({ ...status,run }).run?.counts.files).toBe('1');
  for (const raw of [{ ...status,config:{ ...status.config,password:'secret' } },{ ...status,run:{ ...run,targetId:'B'.repeat(43) } },{ ...status,run:{ ...run,counts:{ ...run.counts,completedOperations:'0' } } },{ ...status,running:true },{ ...status,run:{ ...run,state:'waiting' } }]) expect(() => ftpsStatusFromNative(raw)).toThrow();
});
it('enables only from an explicit action and sends credentials solely to native configuration',async () => {
  mockNative.ftpsStatus.mockResolvedValue(status); mockNative.configureFtps.mockResolvedValue(status); mockNative.enableFtps.mockResolvedValue(status);
  await ftps.status(); expect(mockNative.configureFtps).not.toHaveBeenCalled(); expect(mockNative.enableFtps).not.toHaveBeenCalled();
  await ftps.configure(form); expect(mockNative.configureFtps).toHaveBeenCalledWith(form.address,21,form.hostname,form.root,form.username,form.password);
  await ftps.action('enable'); expect(mockNative.enableFtps).toHaveBeenCalledTimes(1);
});
it('rejects duplicate catalog rows and inconsistent pagination',() => {
  const item = { id,name:'owned.bin',path:'source/owned.bin',kind:'file',sha256:target,size:'1' };
  const page = { targetId:target,items:[item],hasMore:false,canRestoreFiles:true,canRestorePhotos:true };
  expect(ftpsPageFromNative(page).items).toHaveLength(1);
  expect(() => ftpsPageFromNative({ ...page,items:[item,item] })).toThrow();
  expect(() => ftpsPageFromNative({ ...page,hasMore:true })).toThrow();
});
it('takes request tickets only from the protocol native UUID factory',() => {
  const factory = jest.fn(() => '22222222-2222-4222-8222-222222222222');
  mockModule = { ...mockNative,ftpsRequest:factory };
  expect(ftps.newRequest()).toBe('22222222-2222-4222-8222-222222222222'); expect(factory).toHaveBeenCalledTimes(1);
  for (const missing of [null,mockNative,{ ...mockNative,ftpsRequest:'not-a-function' }]) { mockModule = missing; expect(() => ftps.newRequest()).toThrow('native_unsupported'); }
  for (const value of [undefined,42,'','not-a-uuid','22222222-2222-4222-8222-22222222222','22222222-2222-4222-8222-2222222222222',' 22222222-2222-4222-8222-222222222222']) {
    mockModule = { ...mockNative,ftpsRequest:() => value }; expect(() => ftps.newRequest()).toThrow('outcome_unknown');
  }
  mockModule = { ...mockNative,ftpsRequest:() => { throw new Error('native_failure'); } };
  expect(() => ftps.newRequest()).toThrow('native_failure');
  expect(mockNative.configureFtps).not.toHaveBeenCalled();
});
