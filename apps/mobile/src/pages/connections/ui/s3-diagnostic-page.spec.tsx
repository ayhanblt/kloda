import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { S3Page } from './s3-page';
import { s3 } from '../../../shared/api/s3';
import { i18n } from '../../../shared/i18n';
jest.mock('../../../shared/api/s3',() => ({ emptyS3Form:{ endpoint:'',region:'',bucket:'',prefix:'',pathStyle:true,accessKey:'',secret:'',token:'' },s3:{ status:jest.fn(),configure:jest.fn(),test:jest.fn(),newRequest:jest.fn(),cancelTest:jest.fn() },s3ErrorCode:() => 'storage_failure' }));
const mocked = jest.mocked(s3), id = 'c743dfae-e2f9-4c45-a688-cbf43c9030a4';
const status = { provider:'amazon-s3' as const,supported:true,configured:true,enabled:false as const,canRun:false as const,canTest:true,
  profile:{ endpoint:'https://s3.eu-north-1.amazonaws.com',region:'eu-north-1',bucket:'owned-bucket',prefix:'test',pathStyle:false } };
const result = { provider:'amazon-s3' as const,state:'completed' as const,id,size:4097 as const,sha256:'A'.repeat(43) };
const originalState = Object.getOwnPropertyDescriptor(AppState,'currentState')!;
beforeEach(() => { jest.clearAllMocks(); Object.defineProperty(AppState,'currentState',{ ...originalState,value:'active' }); mocked.newRequest.mockReturnValue(id); mocked.status.mockResolvedValue(status); mocked.cancelTest.mockResolvedValue(undefined); });
afterEach(() => { Object.defineProperty(AppState,'currentState',originalState); jest.restoreAllMocks(); });
it('requires saving changed fields before a synthetic test and never enables backups',async () => {
  mocked.configure.mockResolvedValue({ ...status,profile:{ ...status.profile,bucket:'changed-bucket' } }); mocked.test.mockResolvedValue(result);
  const view = await render(<S3Page provider="amazon-s3" onBack={() => undefined} />);
  const testButton = () => view.getByRole('button',{ name:i18n.t('destinations.s3.test') });
  await waitFor(() => expect(testButton().props.accessibilityState.disabled).toBe(false));
  await fireEvent.changeText(view.getByLabelText(i18n.t('destinations.s3.fields.bucket')),'changed-bucket');
  expect(testButton().props.accessibilityState.disabled).toBe(true); await fireEvent.press(testButton()); expect(mocked.test).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.s3.save') }));
  await waitFor(() => expect(testButton().props.accessibilityState.disabled).toBe(false));
  await fireEvent.press(testButton()); await waitFor(() => expect(view.getByText(i18n.t('destinations.s3.testSuccess'))).toBeTruthy());
  expect(mocked.test).toHaveBeenCalledWith('amazon-s3',id); expect(mocked.configure).toHaveBeenCalledTimes(1);
  await view.unmount();
});
it('cancels the exact test on background or unmount and ignores a late successful response',async () => {
  let changed: ((state: AppStateStatus) => void) | undefined, resolve: ((value: typeof result) => void) | undefined;
  const subscription = jest.spyOn(AppState,'addEventListener').mockImplementation((_event,handler) => { changed = handler; return { remove:jest.fn() }; });
  mocked.test.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = await render(<S3Page provider="amazon-s3" onBack={() => undefined} />);
  const testButton = () => view.getByRole('button',{ name:i18n.t('destinations.s3.test') });
  await waitFor(() => expect(testButton().props.accessibilityState.disabled).toBe(false));
  await fireEvent.press(testButton()); await act(async () => { changed?.('background'); resolve?.(result); });
  expect(mocked.cancelTest).toHaveBeenCalledWith(id); expect(view.queryByText(i18n.t('destinations.s3.testSuccess'))).toBeNull();
  await act(async () => { changed?.('active'); });
  await fireEvent.press(testButton()); await view.unmount(); expect(mocked.cancelTest).toHaveBeenCalledTimes(2);
  await act(async () => { resolve?.(result); }); subscription.mockRestore();
});

it('handles a missing native request factory without starting network work or leaking a rejected promise',async () => {
  jest.spyOn(AppState,'addEventListener').mockReturnValue({ remove:jest.fn() });
  mocked.newRequest.mockImplementation(() => { throw new Error('native_unavailable'); });
  const view = await render(<S3Page provider="amazon-s3" onBack={() => undefined} />);
  const button = () => view.getByRole('button',{ name:i18n.t('destinations.s3.test') });
  await waitFor(() => expect(button().props.accessibilityState.disabled).toBe(false));
  await fireEvent.press(button()); expect(mocked.test).not.toHaveBeenCalled();
  await waitFor(() => expect(view.getByRole('alert')).toBeTruthy()); await view.unmount();
});
