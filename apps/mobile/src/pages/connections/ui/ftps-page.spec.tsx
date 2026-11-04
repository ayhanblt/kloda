import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FtpsPage } from './ftps-page';
import { ftps } from '../../../shared/api/ftps';
import { i18n } from '../../../shared/i18n';
jest.mock('../../../shared/api/ftps',() => ({ emptyFtpsForm:{ address:'',port:'21',root:'',username:'',hostname:'',password:'' },ftps:{ status:jest.fn(),configure:jest.fn(),action:jest.fn() } }));
const mocked = jest.mocked(ftps);
beforeEach(() => jest.clearAllMocks());
it('keeps an unsupported native build visibly unavailable and does not configure it',async () => {
  mocked.status.mockResolvedValue({ supported:false,configured:false,enabled:false,running:false });
  const view = await render(<FtpsPage onBack={() => undefined} />);
  await waitFor(() => expect(view.getByText(i18n.t('ui.integrationUnavailable'))).toBeTruthy());
  expect(view.getByRole('button',{ name:i18n.t('destinations.ftps.saveEnable') }).props.accessibilityState.disabled).toBe(true);
  expect(mocked.configure).not.toHaveBeenCalled(); await view.unmount();
});
it('requires an explicit save-and-enable press and clears the password after native persistence',async () => {
  const idle = { supported:true,configured:false,enabled:false,running:false };
  mocked.status.mockResolvedValue(idle); mocked.configure.mockResolvedValue({ ...idle,configured:true,enabled:true });
  const view = await render(<FtpsPage onBack={() => undefined} />);
  await waitFor(() => expect(view.getByLabelText(i18n.t('ui.providerFields.server')).props.editable).toBe(true));
  await fireEvent.changeText(view.getByLabelText(i18n.t('onboarding.password')),'owned-secret');
  expect(mocked.configure).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.ftps.saveEnable') }));
  await waitFor(() => expect(mocked.configure).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(view.getByLabelText(i18n.t('onboarding.password')).props.value).toBe(''));
  await view.unmount();
});
