import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderLock } from 'lucide-react';

import type { BackgroundStatus } from '../../shared/api/desktop';
import { WelcomeIllustration } from '../../shared/ui/WelcomeIllustration';
import { Brand } from '../../shared/ui/Brand';
import { Notice } from '../../shared/ui/Kit';

export function DesktopWelcome({
  autostartEnabled = false,
  autostartReason,
  autostartSupported = false,
  onStart,
  onSkip,
  onAccess,
}: {
  autostartEnabled?: boolean;
  autostartReason?: BackgroundStatus['autostart']['reason'];
  autostartSupported?: boolean;
  onStart(): void;
  onSkip(): void;
  onAccess(): void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [localAutostart, setLocalAutostart] = useState<boolean | null>(null);
  const [localReason, setLocalReason] = useState<BackgroundStatus['autostart']['reason'] | null>(null);
  const [toggleNotApplied, setToggleNotApplied] = useState(false);
  const checked = localAutostart ?? autostartEnabled;
  const effectiveReason = localReason ?? autostartReason;
  const bg = window.kloda?.background;

  const toggleAutostart = async (next: boolean) => {
    if (!bg || busy) return;
    setBusy(true);
    setToggleNotApplied(false);
    try {
      const updated = await bg.setAutostart(next);
      setLocalAutostart(updated.autostart.enabled);
      setLocalReason(updated.autostart.reason ?? null);
      setToggleNotApplied(next && !updated.autostart.enabled && !updated.autostart.reason);
    } catch {
      setToggleNotApplied(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="desktop-welcome">
      <section className="welcome-introduction">
        <Brand large />
        <h1 className="!mt-4 !text-[36px] !leading-tight">{t('ui.welcomeTitle')}</h1>
        <p>{t('ui.welcomeDescription')}</p>
        <WelcomeIllustration className="welcome-illustration" />
      </section>
      <section className="pairing-card welcome-actions !p-6" aria-label={t('ui.setup')}>
        <p className="text-sm font-semibold text-primary-text">{t('receiver.accessTitle')}</p>
        <button className="pairing-button w-full" onClick={onAccess} type="button">
          <FolderLock aria-hidden="true" size={18} />
          {t('receiver.accessAction')}
        </button>
        <p className="text-xs leading-relaxed text-secondary-text">{t('receiver.accessDescription')}</p>

        <label className="relative flex min-h-12 cursor-pointer items-center justify-between gap-3 border-y border-border-subtle py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-primary-text">{t('background.loginLabel')}</span>
            <span className="block text-xs text-secondary-text">
              {t(checked ? 'background.loginEnabled' : 'background.loginDisabled')}
            </span>
          </span>
          <span className="relative inline-flex shrink-0 items-center">
            <input
              aria-label={t('background.loginLabel')}
              checked={checked}
              className="kloda-switch-input"
              disabled={busy || !bg || !autostartSupported}
              onChange={(event) => void toggleAutostart(event.target.checked)}
              type="checkbox"
            />
            <span aria-hidden="true" className="kloda-switch-track">
              <span className="kloda-switch-thumb" />
            </span>
          </span>
        </label>

        {toggleNotApplied && <Notice tone="warn">{t('background.loginNotApplied')}</Notice>}
        {effectiveReason && <Notice tone="warn">{t(`background.loginReasons.${effectiveReason}`)}</Notice>}

        <Notice>{t('receiver.trustBoundary')}</Notice>

        <button className="pairing-button pairing-button-primary !min-h-[52px] w-full" onClick={onStart} type="button">
          {t('ui.startSetup')}
        </button>
        <button className="pairing-button pairing-button-quiet w-full" onClick={onSkip} type="button">
          {t('ui.skipSetup')}
        </button>
        <p className="text-center text-xs leading-relaxed text-secondary-text">{t('ui.skipDescription')}</p>
      </section>
    </main>
  );
}
