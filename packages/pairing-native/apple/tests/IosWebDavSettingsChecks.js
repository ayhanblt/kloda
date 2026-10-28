// Disposable Simulator only. Synthetic credentials and loopback HTTP transport checks;
// no real WebDAV server, pairing authority, user media or TLS exception.
import React from 'react';
import { AppState, Text } from 'react-native';
import { registerRootComponent } from 'expo';
import { fetch as nativeFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { loadWebDavSettings, testAndSaveWebDavSettings } from '../../../../apps/mobile/src/shared/api/webdav-settings';

function Checks() {
  const [label, setLabel] = React.useState('WAITING');
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      const checks = [];
      try {
        if (AppState.currentState !== 'active') throw new Error('not_active');
        const phase = await (await fetch('http://127.0.0.1:18887/phase')).json();
        const key = 'kloda.webdav.profile.v1';
        const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
        const value = { version: 1, storage: { endpoint: 'https://fixture.invalid/dav/', targetPath: 'test-only', username: 'public-fixture', password: 'synthetic-not-a-user-secret' }, testedAt: null };
        if (phase.mode === 'seed') {
          const existing = await SecureStore.getItemAsync(key, options);
          if (existing !== null && existing !== JSON.stringify(value)) throw new Error('fixture_key_collision');
          if (existing === null) await SecureStore.setItemAsync(key, JSON.stringify(value), options);
        }
        const loaded = await loadWebDavSettings();
        if (loaded?.config.targetPath !== 'test-only' || loaded.testedAt !== null || 'password' in loaded.config) throw new Error('metadata_invalid');
        if (await SecureStore.getItemAsync(key, options) !== JSON.stringify(value)) throw new Error('whole_profile_not_retained');
        checks.push(phase.mode === 'seed' ? 'real_securestore_single_unverified_profile' : 'process_restart_retains_whole_profile');
        try { await testAndSaveWebDavSettings({ ...value.storage, endpoint: 'http://127.0.0.1:18887' }, () => true); throw new Error('http_accepted'); }
        catch (error) { if (error.message !== 'webdav_fields') throw error; }
        if (await SecureStore.getItemAsync(key, options) !== JSON.stringify(value)) throw new Error('invalid_form_changed_profile');
        checks.push('production_https_validation_before_mutation');
        await (await nativeFetch('http://127.0.0.1:18887/cookie', { credentials: 'include' })).text();
        const control = await (await nativeFetch('http://127.0.0.1:18887/cookie-control', { credentials: 'include' })).json();
        if (control.cookieAbsent) throw new Error('ambient_cookie_control_missing');
        checks.push('native_ambient_cookie_control_present');
        const isolated = await (await nativeFetch('http://127.0.0.1:18887/isolation', { credentials: 'omit', redirect: 'error', headers: { Authorization: 'Basic cHVibGljOmZpeHR1cmU=' } })).json();
        if (!isolated.cookieAbsent || !isolated.explicitAuthorization) throw new Error('ambient_cookie_or_missing_auth');
        checks.push('real_native_fetch_omits_ambient_cookie');
        for (const status of [302, 307]) {
          try { await nativeFetch(`http://127.0.0.1:18887/redirect/${status}`, { credentials: 'omit', redirect: 'error' }); throw new Error('redirect_followed'); }
          catch (error) { if (error.message === 'redirect_followed') throw error; }
        }
        checks.push('real_native_fetch_redirect_error');
        setLabel('PASS');
        await fetch('http://127.0.0.1:18887/result', { method: 'POST', body: JSON.stringify({ result: 'PASS', phase: phase.mode, checks }) });
      } catch (error) {
        setLabel('FAIL');
        await fetch('http://127.0.0.1:18887/result', { method: 'POST', body: JSON.stringify({ result: 'FAIL', checks, code: error.code ?? error.message }) });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  return React.createElement(Text, { accessibilityLabel: 'WebDAV settings native smoke' }, label);
}
registerRootComponent(Checks);
