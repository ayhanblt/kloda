import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { App } from './App';
import { i18n } from '../shared/i18n';

describe('App', () => {
  it('lets the user choose the 24-hour automatic schedule', async () => {
    const { getByText } = await render(<App />);

    fireEvent.press(getByText(i18n.t('onboarding.everyHours', { hours: 24 })));

    await waitFor(() => expect(getByText(i18n.t('onboarding.everyHoursSelected', { hours: 24 }))).toBeTruthy());
  });

  it('blocks storage setup until a source is selected', async () => {
    const { getByText } = await render(<App />);

    fireEvent.press(getByText(i18n.t('onboarding.saveSchedule')));

    await waitFor(() => expect(getByText(i18n.t('onboarding.sourceRequired'))).toBeTruthy());
  });
});
