import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowDownToLine, FolderLock, QrCode, Settings, Smartphone } from 'lucide-react';

import type { IncomingTransfer } from '../../shared/api/desktop';
import { Notice, SectionTitle, StatusPill } from '../../shared/ui/Kit';

export function ReceiverHome({
  onNavigate,
  onSummaryChange,
}: {
  onNavigate(route: 'pairing' | 'devices' | 'incoming' | 'settings' | 'backups'): void;
  onSummaryChange?: (summary: { devicesTotal: number | null; devicesGranted: number; incomingCount: number | null }) => void;
}) {
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState<readonly IncomingTransfer[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const devicesApi = window.kloda?.devices;
        const activityApi = window.kloda?.background?.activity;
        const [devPage, actPage] = await Promise.all([
          devicesApi ? devicesApi.list().catch(() => null) : Promise.resolve(null),
          activityApi ? activityApi().catch(() => null) : Promise.resolve(null),
        ]);
        if (!alive) return;
        const total = devPage ? devPage.items.length : null;
        const granted = devPage ? devPage.items.filter((d) => d.backupScope?.state === 'approved').length : 0;
        const items = actPage?.items ?? [];
        setTransfers(items);
        onSummaryChange?.({
          devicesTotal: total,
          devicesGranted: granted,
          incomingCount: actPage ? items.length : null,
        });
      } catch {
        // Summary stays absent when native bridges are unavailable.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [onSummaryChange]);

  const filtered = transfers.filter((item) => {
    if (filter === 'active') return item.state !== 'completed';
    if (filter === 'completed') return item.state === 'completed';
    return true;
  });

  return (
    <main className="receiver-home space-y-6" aria-label={t('receiver.stepsTitle')}>
      {transfers.length > 0 && (
        <section aria-label={t('incoming.title')}>
          <SectionTitle>{t('ui.filterActive')}</SectionTitle>
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
            {(
              [
                ['all', t('ui.filterAll')],
                ['active', t('ui.filterActive')],
                ['completed', t('ui.filterCompleted')],
              ] as const
            ).map(([id, label]) => (
              <button
                aria-selected={filter === id}
                className={`min-h-10 rounded-xl border px-3 text-sm font-medium transition-colors ${
                  filter === id
                    ? 'border-[var(--action)] bg-[var(--action)] text-[var(--on-action)]'
                    : 'border-border-subtle bg-surface-1 text-secondary-text hover:bg-surface-2'
                }`}
                key={id}
                onClick={() => setFilter(id)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-border-subtle bg-surface-1 px-4 py-6 text-center text-sm text-secondary-text">
              {t('ui.filterEmpty')}
            </p>
          ) : (
            <div className="grid gap-2">
              {filtered.slice(0, 5).map((item) => {
                const rec = BigInt(item.receivedBytes);
                const tot = BigInt(item.totalBytes);
                const pct = tot === 0n ? (item.state === 'completed' ? 100 : 0) : Number((rec * 10000n) / tot) / 100;
                return (
                  <article className="pairing-card flex flex-wrap items-center justify-between gap-4 !p-4" key={item.id}>
                    <div className="min-w-0 flex-1 basis-52">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-primary-text">{item.name}</p>
                        <span className="shrink-0 text-xs tabular-nums text-secondary-text">{pct.toFixed(0)}%</span>
                      </div>
                      <progress
                        aria-label={t('incoming.progressLabel', { name: item.name })}
                        className="kloda-progress mt-2"
                        max={100}
                        value={pct}
                      />
                    </div>
                    <StatusPill tone={item.state === 'completed' ? 'synced' : 'syncing'}>
                      {t(`incoming.states.${item.state}`)}
                    </StatusPill>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <SectionTitle>{t('receiver.stepsTitle')}</SectionTitle>
        <div className="receiver-steps">
          <section className="pairing-card flex flex-col justify-between gap-4">
            <div>
              <p className="pairing-eyebrow text-secondary-text">{t('receiver.step', { number: 1 })}</p>
              <div className="pairing-section-heading mt-2">
                <QrCode aria-hidden="true" size={20} />
                <h3>{t('receiver.pairTitle')}</h3>
              </div>
              <p className="pairing-caption">{t('receiver.pairDescription')}</p>
            </div>
            <div>
              <button className="pairing-button pairing-button-primary" onClick={() => onNavigate('pairing')} type="button">
                {t('receiver.pairAction')}
              </button>
            </div>
          </section>

          <section className="pairing-card flex flex-col justify-between gap-4">
            <div>
              <p className="pairing-eyebrow text-secondary-text">{t('receiver.step', { number: 2 })}</p>
              <div className="pairing-section-heading mt-2">
                <FolderLock aria-hidden="true" size={20} />
                <h3>{t('receiver.accessTitle')}</h3>
              </div>
              <p className="pairing-caption">{t('receiver.accessDescription')}</p>
            </div>
            <div>
              <button className="pairing-button" onClick={() => onNavigate('devices')} type="button">
                {t('receiver.accessAction')}
              </button>
            </div>
          </section>
        </div>
      </section>

      <Notice>{t('receiver.trustBoundary')}</Notice>

      <div className="receiver-destinations">
        {(
          [
            ['devices', Smartphone, 'devicesTitle', 'devicesDescription'],
            ['incoming', ArrowDownToLine, 'incomingTitle', 'incomingDescription'],
            ['backups', Archive, 'backupsTitle', 'backupsDescription'],
            ['settings', Settings, 'settingsNavigation', 'settingsDescription'],
          ] as const
        ).map(([route, Icon, title, description]) => (
          <button className="pairing-card receiver-destination transition-colors" key={route} onClick={() => onNavigate(route)} type="button">
            <Icon aria-hidden="true" className="mt-0.5 text-secondary-text" size={20} strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <strong className="text-sm font-semibold text-primary-text">{t(`receiver.${title}`)}</strong>
              <span className="pairing-caption mt-1">{t(`receiver.${description}`)}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
