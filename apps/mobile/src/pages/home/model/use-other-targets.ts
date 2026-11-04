import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cloudDestinations, providerLabel } from '../../../shared/api/cloud-destinations';
import { smb } from '../../../shared/api/smb';
import { sftp } from '../../../shared/api/sftp';
import { ftps } from '../../../shared/api/ftps';
import { s3, type S3Provider } from '../../../shared/api/s3';
import type { OtherTarget } from './home-status';

// Reads every destination's own status for the home summary; read-only, no sign-in, form or run side effects.
// A module that is missing or fails to answer contributes no destination.
async function read(label: (key: string) => string): Promise<OtherTarget[]> {
  const [cloud, smbStatus, sftpStatus, ftpsStatus, ...s3Status] = await Promise.allSettled([cloudDestinations.list(), smb.status(), sftp.status(),
    ftps.status(), ...(['amazon-s3', 's3-compatible'] as S3Provider[]).map(provider => s3.status(provider))]);
  const targets: OtherTarget[] = [];
  // The original WebDAV profile is listed too; the home status already reads it through KlodaBackup.
  if (cloud.status === 'fulfilled') for (const item of cloud.value.filter(value => value.provider !== 'webdav')) targets.push({ id: item.targetId, label: label(providerLabel(item.provider)), kind: 'cloud', enabled: item.enabled, run: item.run });
  for (const [result, id] of [[smbStatus, 'smb'], [sftpStatus, 'sftp'], [ftpsStatus, 'ftp']] as const) {
    if (result.status !== 'fulfilled' || !result.value.configured) continue;
    const value = result.value;
    targets.push({ id: value.targetId ?? id, label: label(`ui.providers.${id}`), kind: 'nas', enabled: value.enabled, running: value.running, run: value.run,
      errorCode: value.errorCode, automaticError: value.automaticError });
  }
  for (const result of s3Status) {
    if (result.status !== 'fulfilled' || !result.value.configured) continue;
    const value = result.value;
    targets.push({ id: value.provider, label: label(`ui.providers.${value.provider}`), kind: 'cloud', enabled: value.enabled, running: value.running, run: value.run });
  }
  return targets;
}

export function useOtherTargets() {
  const { t } = useTranslation();
  const [targets, setTargets] = useState<OtherTarget[]>([]);
  const epoch = useRef(0);
  const running = targets.some(target => target.enabled && (target.running || target.run?.state === 'running'));
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const version = ++epoch.current;
      const value = await read((key) => t(key));
      if (mounted && version === epoch.current) setTargets(value);
    };
    void refresh();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const timer = running ? setInterval(() => { void refresh(); }, 2000) : undefined;
    return () => { mounted = false; listener.remove(); if (timer) clearInterval(timer); };
  }, [running, t]);
  return targets;
}
