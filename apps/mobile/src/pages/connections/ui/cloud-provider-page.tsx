import { useEffect, useRef, useState } from 'react';
import type { DestinationProviderId } from '@kloda/sync-core';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { CloudProvider, OAuthProvider } from '../../../shared/api/cloud-destinations';
import { useCloudDestinations } from '../../../features/cloud-destination/model/use-cloud-destinations';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { errorLabel, providerLabel } from './cloud-destination-list';

const addable = { nextcloud: 'nextcloud', 'kolab-now': 'kolab-now', dropbox: 'dropbox', onedrive: 'onedrive', 'yandex-disk': 'yandex', 'google-drive': 'google-drive' } as const;
type Addable = typeof addable[keyof typeof addable];
type Field = 'server' | 'username' | 'password' | 'folder';
const fieldsFor = (provider: Addable): readonly Field[] =>
  provider === 'nextcloud' ? ['server', 'folder'] : provider === 'kolab-now' ? ['username', 'password', 'folder'] : ['folder'];
export function cloudProviderFor(id: DestinationProviderId): Addable | null { return id in addable ? addable[id as keyof typeof addable] : null; }

// Adds one DAV or OAuth destination. Sign-in runs in the system browser; saving never enables (ADR0023).
export function CloudProviderPage({ provider, onBack, onSaved }: { provider: Addable; onBack: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const m = useCloudDestinations();
  const [form, setForm] = useState<Record<Field, string>>({ server: '', username: '', password: '', folder: '' });
  const initial = useRef(m.lastAdded);
  useEffect(() => { if (m.lastAdded && m.lastAdded !== initial.current) onSaved(); }, [m.lastAdded, onSaved]);
  const signingIn = m.action === 'signing-in';
  const working = m.action !== 'idle' || m.destinations === null;
  const submit = () => {
    if (provider === 'nextcloud') void m.signIn(form.server, form.folder);
    else if (provider === 'kolab-now') void m.addKolabNow(form.username, form.password, form.folder);
    else void m.signInOAuth(provider as OAuthProvider, form.folder);
  };
  const label = (field: Field) => t(field === 'password' ? 'onboarding.password' : `ui.providerFields.${field}`);
  const browser = provider !== 'kolab-now';
  return <MobileSurface title={t(providerLabel(provider as CloudProvider))} description={t('ui.conn.addHint')} onBack={onBack}>
    <MobilePanel>
      {fieldsFor(provider).map((field) => <View className="gap-2" key={field}>
        <Text className="text-sm font-inter-medium text-primary-text">{label(field)}</Text>
        <TextInput accessibilityLabel={label(field)} editable={!working} secureTextEntry={field === 'password'} autoCapitalize="none" autoCorrect={false}
          keyboardType={field === 'server' ? 'url' : field === 'username' ? 'email-address' : 'default'}
          className="font-sans min-h-[48px] rounded-xl border border-border-subtle bg-surface-1 p-3 text-base text-primary-text"
          value={form[field]} onChangeText={(value) => setForm((current) => ({ ...current, [field]: value }))} />
      </View>)}
      {browser && <Text className="font-sans text-sm text-secondary-text">{t('ui.conn.browserHint')}</Text>}
      {m.full && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(errorLabel('destination_limit'))}</Text>}
      <PairingButton variant="primary" disabled={working || m.full} label={t(browser ? 'ui.conn.signIn' : 'ui.conn.save')} onPress={submit} />
      {signingIn && <>
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t('ui.conn.waiting')}</Text>
        <PairingButton variant="secondary" label={t('ui.conn.cancelSignIn')} onPress={m.cancel} />
      </>}
      {m.error && m.error !== 'cancelled' && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(errorLabel(m.error), { defaultValue: t(errorLabel('outcome_unknown')) })}</Text>}
    </MobilePanel>
  </MobileSurface>;
}
