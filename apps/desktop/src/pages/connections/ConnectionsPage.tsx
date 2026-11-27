import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Network, Plus, ShieldAlert } from 'lucide-react';
import { destinationProviders, type DestinationProviderId } from '@kloda/sync-core';

import type { BackupDraft } from '../../shared/api/desktop';
import type { DesktopLocation } from '../../shared/navigation/desktop-route';
import { DeviceGlyph, Notice, PageHeader, SectionTitle, StatusPill } from '../../shared/ui/Kit';

export function ConnectionsPage({ location, onNavigate }: { location: DesktopLocation; onNavigate(location: DesktopLocation): void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<BackupDraft | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const getDraft = window.kloda?.getDraft;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    setDraft(null);
    void (async () => {
      try {
        if (!getDraft) throw new Error('native_unsupported');
        const next = await getDraft();
        if (alive) setDraft(next);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getDraft]);

  const provider = destinationProviders.find((item) => item.id === location.provider);
  const isDetail = location.page === 'connection-detail';
  const isList = location.page === 'connections';
  const configuredCount = !loading && !failed && draft?.storage ? 1 : 0;

  return (
    <main className="connections-page space-y-6">
      <PageHeader
        actions={
          isList ? (
            <button className="pairing-button pairing-button-primary !min-h-10 !px-4 !text-sm" onClick={() => onNavigate({ page: 'connection-add' })} type="button">
              <Plus aria-hidden="true" size={16} />
              {t('ui.addConnection')}
            </button>
          ) : (
            <button
              className="pairing-button !min-h-10 !px-4 !text-sm"
              onClick={() => onNavigate({ page: provider ? 'connection-add' : 'connections' })}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={16} />
              {t('ui.back')}
            </button>
          )
        }
        body={t('ui.connectionsDescription')}
        title={t(isList ? 'ui.connections' : provider ? `ui.providers.${provider.id}` : 'ui.addConnection')}
      />

      {isList && (
        <>
          <div className="grid grid-cols-2 gap-3 border-b border-border-subtle pb-5 lg:grid-cols-4">
            <div className="rounded-xl bg-surface-2/70 p-4">
              <p className="text-2xl font-semibold tabular-nums text-primary-text">{configuredCount}</p>
              <p className="mt-1 text-xs text-secondary-text">{t('ui.statsTargets')}</p>
            </div>
            <div className="rounded-xl bg-[color-mix(in_srgb,var(--brand-base)_10%,var(--surface-1))] p-4">
              <p className="text-2xl font-semibold tabular-nums text-primary-text">{configuredCount}</p>
              <p className="mt-1 text-xs text-secondary-text">{t('ui.statsConfigured')}</p>
            </div>
            <div className="rounded-xl bg-surface-2/70 p-4">
              <p className="text-2xl font-semibold tabular-nums text-primary-text">{configuredCount === 0 ? 1 : 0}</p>
              <p className="mt-1 text-xs text-secondary-text">{t('ui.statsUnconfigured')}</p>
            </div>
            <div className="rounded-xl bg-surface-2/70 p-4">
              <p className="text-2xl font-semibold tabular-nums text-primary-text">{destinationProviders.length}</p>
              <p className="mt-1 text-xs text-secondary-text">{t('ui.statsTotal')}</p>
            </div>
          </div>

          {loading && (
            <p className="text-sm text-secondary-text" role="status">
              {t('pairing.loading')}
            </p>
          )}
          {failed && (
            <Notice role="alert" tone="danger">
              {t('ui.connectionsUnavailable')}
            </Notice>
          )}
          {!loading && !failed && !draft?.storage && (
            <section className="pairing-card connection-empty">
              <Network aria-hidden="true" size={32} />
              <h2>{t('ui.noConnections')}</h2>
              <p>{t('ui.noConnectionsDescription')}</p>
            </section>
          )}
          {!loading && !failed && draft?.storage && (
            <section className="pairing-card grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <DeviceGlyph kind="nas" />
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-primary-text">{t('ui.providers.webdav')}</h2>
                    <StatusPill tone="pending">{t('ui.savedDestination')}</StatusPill>
                  </div>
                </div>
                <p className="truncate rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-secondary-text" title={draft.storage.endpoint}>
                  {draft.storage.endpoint}
                </p>
                <p className="break-all text-xs text-secondary-text">{draft.storage.targetPath}</p>
                <Notice>{t('ui.savedNotLive')}</Notice>
              </div>
              <button
                className="pairing-button !min-h-10 !px-4 !text-sm"
                onClick={() => onNavigate({ page: 'connection-detail', provider: 'webdav' })}
                type="button"
              >
                {t('ui.details')}
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </section>
          )}
        </>
      )}

      {!isList && !provider && (
        <div className="space-y-8">
          {(['protocol', 'cloud'] as const).map((kind) => (
            <section key={kind}>
              <SectionTitle>{t(kind === 'protocol' ? 'ui.protocols' : 'ui.clouds')}</SectionTitle>
              <div className="connection-grid">
                {destinationProviders
                  .filter((item) => item.kind === kind)
                  .map((item) => (
                    <button
                      aria-label={t(`ui.providers.${item.id}`)}
                      className="pairing-card connection-provider"
                      key={item.id}
                      onClick={() => onNavigate({ page: 'connection-add', provider: item.id })}
                      type="button"
                    >
                      <DeviceGlyph kind={kind === 'cloud' ? 'cloud' : 'nas'} />
                      <span>
                        <strong>{t(`ui.providers.${item.id}`)}</strong>
                        <span>{t(item.id === 'webdav' ? 'ui.existingWebdav' : 'ui.notImplemented')}</span>
                      </span>
                      <ArrowRight aria-hidden="true" size={16} />
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {provider && (
        <ProviderDetails
          detail={isDetail}
          draft={!failed ? draft : null}
          failed={failed}
          id={provider.id}
          loading={loading}
          onWebDav={() => onNavigate({ page: 'backup' })}
        />
      )}
    </main>
  );
}

function ProviderDetails({
  id,
  detail,
  draft,
  loading,
  failed,
  onWebDav,
}: {
  id: DestinationProviderId;
  detail: boolean;
  draft: BackupDraft | null;
  loading: boolean;
  failed: boolean;
  onWebDav(): void;
}) {
  const { t } = useTranslation();
  const bucket = id === 's3-compatible' || id === 'amazon-s3' || id === 'google-cloud-storage';
  const webdav = id === 'webdav';
  const kind = destinationProviders.find((p) => p.id === id)?.kind ?? 'protocol';
  const fields = bucket
    ? ['endpoint', 'region', 'bucket', 'prefix', 'accessKey', 'secretKey']
    : id === 'smb'
      ? ['server', 'share', 'folder', 'username', 'domain']
      : id === 'ftp'
        ? ['server', 'port', 'username', 'password', 'security', 'folder']
        : id === 'sftp'
          ? ['server', 'port', 'username', 'authMethod', 'hostKey', 'folder']
          : ['account', 'folder'];

  return (
    <section className="pairing-card connection-details">
      <div className="flex items-center gap-3">
        <DeviceGlyph kind={kind === 'cloud' ? 'cloud' : 'nas'} />
        <h2 className="text-xl font-semibold text-primary-text">{t(`ui.providers.${id}`)}</h2>
      </div>
      {webdav ? (
        <>
          <p className="text-sm text-secondary-text">{t('ui.existingWebdavDescription')}</p>
          {detail &&
            (loading ? (
              <p className="text-sm text-secondary-text" role="status">
                {t('pairing.loading')}
              </p>
            ) : failed ? (
              <Notice role="alert" tone="danger">
                {t('ui.connectionsUnavailable')}
              </Notice>
            ) : draft?.storage ? (
              <dl className="connection-fields rounded-xl border border-border-subtle bg-surface-2/50 p-4">
                <div>
                  <dt className="font-semibold text-primary-text">{t('onboarding.endpoint')}</dt>
                  <dd className="font-mono text-xs">{draft.storage.endpoint}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-primary-text">{t('onboarding.targetPath')}</dt>
                  <dd className="font-mono text-xs">{draft.storage.targetPath}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-primary-text">{t('onboarding.username')}</dt>
                  <dd className="text-xs">{draft.storage.username}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-secondary-text">{t('ui.noConnections')}</p>
            ))}
          <Notice>{t('ui.savedNotLive')}</Notice>
          <div>
            <button className="pairing-button pairing-button-primary" onClick={onWebDav} type="button">
              {t('ui.openWebdav')}
            </button>
          </div>
        </>
      ) : (
        <>
          <Notice icon={ShieldAlert} role="status" tone="warn">
            {t('ui.providerUnavailable')}
          </Notice>
          <p className="text-sm text-secondary-text">{t('ui.providerFuture')}</p>
          <fieldset className="connection-fields" disabled>
            <legend>{t('ui.connectionFields')}</legend>
            {fields.map((field) => (
              <label key={field}>
                {t(`ui.fields.${field}`)}
                <input aria-label={t(`ui.fields.${field}`)} placeholder={t('ui.notImplemented')} readOnly value="" />
              </label>
            ))}
          </fieldset>
        </>
      )}
    </section>
  );
}
