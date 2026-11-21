import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { S3Page } from './s3-page';
import { s3 } from '../../../shared/api/s3';
import { i18n } from '../../../shared/i18n';
jest.mock('../../../shared/api/s3',() => ({ emptyS3Form:{ endpoint:'',region:'',bucket:'',prefix:'',pathStyle:true,accessKey:'',secret:'',token:'' },s3:{ status:jest.fn(),action:jest.fn(),cancelTest:jest.fn() },s3ErrorCode:() => 'storage_failure' }));
const mocked = jest.mocked(s3), original = Object.getOwnPropertyDescriptor(AppState,'currentState')!;
const status = { provider:'amazon-s3' as const,supported:true,configured:true,enabled:false,canEnable:true,canRun:false,running:false,canTest:true,
  profile:{ endpoint:'https://s3.eu-north-1.amazonaws.com',region:'eu-north-1',bucket:'owned-bucket',prefix:'owned',pathStyle:false } };
beforeEach(() => {
  jest.clearAllMocks(); Object.defineProperty(AppState,'currentState',{ ...original,value:'active' });
  jest.spyOn(AppState,'addEventListener').mockReturnValue({ remove:jest.fn() }); mocked.cancelTest.mockResolvedValue(undefined);
});
afterEach(() => { Object.defineProperty(AppState,'currentState',original); jest.restoreAllMocks(); });
it('requires explicit opt-in before manual file run and blocks unsaved settings',async () => {
  mocked.status.mockResolvedValue(status); mocked.action.mockResolvedValue({ ...status,enabled:true,canRun:true });
  const view = await render(<S3Page provider="amazon-s3" onBack={() => undefined} />);
  const button = (key: string) => view.getByRole('button',{ name:i18n.t(`destinations.s3.${key}`) });
  await waitFor(() => expect(button('enable')).toBeTruthy()); expect(mocked.action).not.toHaveBeenCalled();
  expect(button('run').props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(button('enable')); await waitFor(() => expect(button('run').props.accessibilityState.disabled).toBe(false));
  expect(mocked.action).toHaveBeenCalledWith('amazon-s3','enableS3');
  await fireEvent.press(button('run')); expect(mocked.action).toHaveBeenCalledWith('amazon-s3','runS3');
  await fireEvent.changeText(view.getByLabelText(i18n.t('destinations.s3.fields.bucket')),'changed-bucket');
  expect(button('run').props.accessibilityState.disabled).toBe(true); await view.unmount();
});
it('keeps a running transfer settings read-only and exposes pause instead of another start',async () => {
  mocked.status.mockResolvedValue({ ...status,enabled:true,running:true });
  mocked.action.mockResolvedValue({ ...status,enabled:true,canRun:true });
  const view = await render(<S3Page provider="amazon-s3" onBack={() => undefined} />);
  await waitFor(() => expect(view.getByRole('button',{ name:i18n.t('destinations.s3.pause') })).toBeTruthy());
  expect(view.getByLabelText(i18n.t('destinations.s3.fields.bucket')).props.editable).toBe(false);
  expect(view.getByRole('button',{ name:i18n.t('destinations.s3.test') }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.s3.pause') }));
  expect(mocked.action).toHaveBeenCalledWith('amazon-s3','pauseS3'); await view.unmount();
});
it('ignores a delayed running status after an explicit pause',async () => {
  let poll: (() => void) | undefined, release: ((value: typeof status) => void) | undefined;
  jest.spyOn(global,'setInterval').mockImplementation(callback => { poll = callback as () => void; return 7 as unknown as ReturnType<typeof setInterval>; });
  jest.spyOn(global,'clearInterval').mockImplementation(() => undefined);
  mocked.status.mockResolvedValueOnce({ ...status,enabled:true,running:true }).mockImplementationOnce(() => new Promise(done => { release = done; }));
  mocked.action.mockResolvedValue({ ...status,enabled:true,canRun:true });
  const view = await render(<S3Page provider="amazon-s3" onBack={() => undefined} />);
  await waitFor(() => expect(poll).toBeDefined()); await act(async () => { poll?.(); });
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.s3.pause') }));
  await waitFor(() => expect(view.getByRole('button',{ name:i18n.t('destinations.s3.run') })).toBeTruthy());
  await act(async () => { release?.({ ...status,enabled:true,running:true }); });
  expect(view.queryByRole('button',{ name:i18n.t('destinations.s3.pause') })).toBeNull();
  await view.unmount();
});
