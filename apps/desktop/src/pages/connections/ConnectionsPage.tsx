import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Cloud, Database, Network, Plus, ShieldAlert } from 'lucide-react';
import { destinationProviders, type DestinationProviderId } from '@kloda/sync-core';

import type { BackupDraft } from '../../shared/api/desktop';
import type { DesktopLocation } from '../../shared/navigation/desktop-route';

export function ConnectionsPage({ location, onNavigate }: { location: DesktopLocation; onNavigate(location: DesktopLocation): void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<BackupDraft | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const getDraft = window.kloda?.getDraft;
  useEffect(() => {
    let alive = true;
    setLoading(true); setFailed(false); setDraft(null);
    void (async () => {
      try {
        if (!getDraft) throw new Error('native_unsupported');
        const next = await getDraft();
        if (alive) setDraft(next);
      } catch { if (alive) setFailed(true); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [getDraft]);
  const provider = destinationProviders.find((item) => item.id === location.provider);
  const isDetail = location.page === 'connection-detail';
  const isList = location.page === 'connections';
  return <main className="connections-page">
    <header className="connections-heading">
      <div><h1>{t(isList ? 'ui.connections' : provider ? `ui.providers.${provider.id}` : 'ui.addConnection')}</h1>
        <p>{t('ui.connectionsDescription')}</p></div>
      {isList ? <button className="pairing-button pairing-button-primary" type="button" onClick={() => onNavigate({ page: 'connection-add' })}>
        <Plus size={18} aria-hidden="true" />{t('ui.addConnection')}</button>
        : <button className="pairing-button" onClick={() => onNavigate({ page: provider ? 'connection-add' : 'connections' })} type="button"><ArrowLeft size={18} aria-hidden="true" />{t('ui.back')}</button>}
    </header>
    {isList && <>
      {loading && <p role="status">{t('pairing.loading')}</p>}
      {failed && <p className="connection-warning" role="alert">{t('ui.connectionsUnavailable')}</p>}
      {!loading && !failed && !draft?.storage && <section className="pairing-card connection-empty"><Network size={32} aria-hidden="true" /><h2>{t('ui.noConnections')}</h2><p>{t('ui.noConnectionsDescription')}</p></section>}
      {!loading && !failed && draft?.storage && <section className="pairing-card connection-summary">
        <Network size={28} aria-hidden="true" /><div><h2>{t('ui.providers.webdav')}</h2><p>{t('ui.savedDestination')}</p><p className="break-all">{draft.storage.endpoint}</p><p className="break-all">{draft.storage.targetPath}</p><p>{t('ui.savedNotLive')}</p></div>
        <button className="pairing-button" type="button" onClick={() => onNavigate({ page: 'connection-detail', provider: 'webdav' })}>{t('ui.details')}<ArrowRight size={18} aria-hidden="true" /></button>
      </section>}
    </>}
    {!isList && !provider && <div className="space-y-8">
      {(['protocol', 'cloud'] as const).map((kind) => <section key={kind}>
        <h2 className="connection-group-title">{t(kind === 'protocol' ? 'ui.protocols' : 'ui.clouds')}</h2>
        <div className="connection-grid">{destinationProviders.filter((item) => item.kind === kind).map((item) => <button className="pairing-card connection-provider" key={item.id} type="button" aria-label={t(`ui.providers.${item.id}`)}
          onClick={() => onNavigate({ page: 'connection-add', provider: item.id })}>
          {kind === 'cloud' ? <Cloud size={25} aria-hidden="true" /> : <Network size={25} aria-hidden="true" />}
          <span><strong>{t(`ui.providers.${item.id}`)}</strong><span>{t(item.id === 'webdav' ? 'ui.existingWebdav' : 'ui.notImplemented')}</span></span><ArrowRight size={18} aria-hidden="true" />
        </button>)}</div>
      </section>)}
    </div>}
    {provider && <ProviderDetails id={provider.id} detail={isDetail} draft={!failed ? draft : null} loading={loading} failed={failed} onWebDav={() => onNavigate({ page: 'backup' })} />}
  </main>;
}

function ProviderDetails({ id, detail, draft, loading, failed, onWebDav }: { id: DestinationProviderId; detail: boolean; draft: BackupDraft | null; loading: boolean; failed: boolean; onWebDav(): void }) {
  const { t } = useTranslation();
  const bucket = id === 's3-compatible' || id === 'amazon-s3' || id === 'google-cloud-storage';
  const webdav = id === 'webdav';
  const fields = bucket ? ['endpoint', 'region', 'bucket', 'prefix', 'accessKey', 'secretKey']
    : id === 'smb' ? ['server', 'share', 'folder', 'username', 'domain']
      : id === 'ftp' ? ['server', 'port', 'username', 'password', 'security', 'folder']
        : id === 'sftp' ? ['server', 'port', 'username', 'authMethod', 'hostKey', 'folder']
          : ['account', 'folder'];
  return <section className="pairing-card connection-details">
    {bucket ? <Database size={32} aria-hidden="true" /> : <Cloud size={32} aria-hidden="true" />}
    <h2>{t(`ui.providers.${id}`)}</h2>
    {webdav ? <>
      <p>{t('ui.existingWebdavDescription')}</p>
      {detail && (loading ? <p role="status">{t('pairing.loading')}</p> : failed ? <p role="alert">{t('ui.connectionsUnavailable')}</p> : draft?.storage ? <dl className="connection-fields">
        <div><dt>{t('onboarding.endpoint')}</dt><dd>{draft.storage.endpoint}</dd></div>
        <div><dt>{t('onboarding.targetPath')}</dt><dd>{draft.storage.targetPath}</dd></div>
        <div><dt>{t('onboarding.username')}</dt><dd>{draft.storage.username}</dd></div>
      </dl> : <p>{t('ui.noConnections')}</p>)}
      <p>{t('ui.savedNotLive')}</p>
      <button className="pairing-button pairing-button-primary" type="button" onClick={onWebDav}>{t('ui.openWebdav')}</button>
    </> : <>
      <p className="connection-warning" role="status"><ShieldAlert size={20} aria-hidden="true" />{t('ui.providerUnavailable')}</p>
      <p>{t('ui.providerFuture')}</p>
      <fieldset disabled className="connection-fields"><legend>{t('ui.connectionFields')}</legend>
        {fields.map((field) => <label key={field}>{t(`ui.fields.${field}`)}<input aria-label={t(`ui.fields.${field}`)} placeholder={t('ui.notImplemented')} readOnly value="" /></label>)}
      </fieldset>
    </>}
  </section>;
}
