import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { App } from './App';

describe('App', () => {
  it('lets the user choose the 24-hour automatic schedule', async () => {
    const { getByText } = await render(<App />);

    fireEvent.press(getByText('Every 24 hours'));

    await waitFor(() => expect(getByText('Every 24 hours ✓')).toBeTruthy());
  });
});
