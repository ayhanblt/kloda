import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { destinationProviders } from '@kloda/sync-core';

import { ConnectionsPage } from './ConnectionsPage';
import { i18n } from '../../shared/i18n';

const emptyDraft = { intervalHours: 12, localTime: '12:00', sources: [], storage: null, storageTested: false };
afterEach(() => { cleanup(); window.kloda = undefined; });

it('lists all approved providers without claiming that planned adapters work', async () => {
  const onNavigate = vi.fn();
  render(<ConnectionsPage location={{ page: 'connection-add' }} onNavigate={onNavigate} />);
  for (const provider of destinationProviders) expect(screen.getByRole('button', { name: i18n.t(`ui.providers.${provider.id}`) })).toBeInTheDocument();
  expect(screen.getAllByText(i18n.t('ui.notImplemented'))).toHaveLength(15);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('ui.providers.sftp') }));
  expect(onNavigate).toHaveBeenCalledWith({ page: 'connection-add', provider: 'sftp' });
  await screen.findByText(i18n.t('ui.clouds'));
});

it.each(['tr', 'en', 'de'])('shows disabled SFTP identity fields with a truthful unavailable state in %s', async (language) => {
  await i18n.changeLanguage(language);
  render(<ConnectionsPage location={{ page: 'connection-add', provider: 'sftp' }} onNavigate={vi.fn()} />);
  expect(screen.getByText(i18n.t('ui.providerUnavailable'))).toHaveAttribute('role', 'status');
  expect(screen.getByRole('textbox', { name: i18n.t('ui.fields.hostKey') })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: i18n.t('ui.fields.server') })).toBeDisabled();
  expect(screen.queryByRole('button', { name: i18n.t('onboarding.testConnection') })).not.toBeInTheDocument();
  cleanup();
  await i18n.changeLanguage('tr');
});

it('marks the stored WebDAV profile as historical and discards it after a failed refresh', async () => {
  const getDraft = vi.fn().mockResolvedValue({ ...emptyDraft, storage: { endpoint: 'https://fixture.example', targetPath: 'backup', username: 'fixture' }, storageTested: true });
  window.kloda = { getDraft } as unknown as Window['kloda'];
  const props = { location: { page: 'connections' as const }, onNavigate: vi.fn() };
  const view = render(<ConnectionsPage {...props} />);
  expect(await screen.findByText('https://fixture.example')).toBeInTheDocument();
  expect(screen.getByText(i18n.t('ui.savedNotLive'))).toBeInTheDocument();
  const failingDraft = vi.fn().mockRejectedValue(new Error('fixture unavailable'));
  window.kloda = { getDraft: failingDraft } as unknown as Window['kloda'];
  view.rerender(<ConnectionsPage {...props} />);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('ui.connectionsUnavailable')));
  expect(screen.queryByText('https://fixture.example')).not.toBeInTheDocument();
});
