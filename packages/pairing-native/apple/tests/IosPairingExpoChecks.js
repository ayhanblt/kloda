// Disposable simulator entry only; never a production app entry or hardware acceptance.
import React from 'react';
import { AppState, Text } from 'react-native';
import { registerRootComponent, requireNativeModule } from 'expo';

function Checks() {
  const [result, setResult] = React.useState('WAITING');
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      const checks = [];
      try {
        if (AppState.currentState !== 'active') throw new Error('fixture_not_active');
        const pairing = requireNativeModule('KlodaPairing');
        for (const name of ['status', 'scan', 'approve', 'deny', 'cancel', 'resume', 'removePairing', 'close']) {
          if (typeof pairing[name] !== 'function') throw new Error('missing_' + name);
        }
        checks.push('module_methods');
        try { await pairing.status(); throw new Error('unexpected_owner_success'); }
        catch (error) { if (error.code !== 'native_unsupported') throw error; }
        checks.push('simulator_custody_refusal');
        const sync = requireNativeModule('KlodaSyncRuntime');
        if ((await sync.loadDirectorySources()).length || (await sync.loadPhotoSources()).length) {
          throw new Error('fixture_not_empty');
        }
        const prepared = await sync.prepareSourceJobs();
        if (prepared.queuedFiles !== 0 || prepared.scannedSources !== 0) throw new Error('unexpected_journal');
        checks.push('empty_real_app_journal');
        await pairing.close();
        checks.push('empty_close');
        setResult('PASS');
        await fetch('http://127.0.0.1:18887/result', { method: 'POST', body: JSON.stringify({ result: 'PASS', checks }) });
      } catch (error) {
        setResult('FAIL');
        await fetch('http://127.0.0.1:18887/result', { method: 'POST', body: JSON.stringify({ result: 'FAIL', checks, code: error.code ?? error.message }) });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  return React.createElement(Text, { accessibilityLabel: 'Native pairing smoke result' }, result);
}

registerRootComponent(Checks);
