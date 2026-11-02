import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SftpPage } from './sftp-page';
import { sftp } from '../../../shared/api/sftp';
import { i18n } from '../../../shared/i18n';
jest.mock('../../../shared/api/sftp',() => ({ emptySftpForm:{ address:'',port:'22',root:'',username:'',fingerprint:'',password:'' },sftp:{ status:jest.fn(),configure:jest.fn(),action:jest.fn() } }));
const mocked = jest.mocked(sftp);
beforeEach(() => jest.clearAllMocks());
it('keeps an unsupported native build visibly unavailable and does not configure it',async () => {
  mocked.status.mockResolvedValue({ supported:false,configured:false,enabled:false,running:false });
  const view = await render(<SftpPage onBack={() => undefined} />);
  await waitFor(() => expect(view.getByText(i18n.t('ui.integrationUnavailable'))).toBeTruthy());
  expect(view.getByRole('button',{ name:i18n.t('destinations.sftp.saveEnable') }).props.accessibilityState.disabled).toBe(true);
  expect(mocked.configure).not.toHaveBeenCalled(); await view.unmount();
});
it('requires an explicit save-and-enable press and clears the password after native persistence',async () => {
  const idle = { supported:true,configured:false,enabled:false,running:false };
  mocked.status.mockResolvedValue(idle); mocked.configure.mockResolvedValue({ ...idle,configured:true,enabled:true });
  const view = await render(<SftpPage onBack={() => undefined} />);
  await waitFor(() => expect(view.getByLabelText(i18n.t('ui.providerFields.server')).props.editable).toBe(true));
  await fireEvent.changeText(view.getByLabelText(i18n.t('onboarding.password')),'owned-secret');
  expect(mocked.configure).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.sftp.saveEnable') }));
  await waitFor(() => expect(mocked.configure).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(view.getByLabelText(i18n.t('onboarding.password')).props.value).toBe(''));
  await view.unmount();
});
