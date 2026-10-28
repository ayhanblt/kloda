// Disposable simulator only. No source selection, pairing, transfer or Photos access.
import React from 'react';
import { AppState, Text } from 'react-native';
import { registerRootComponent, requireNativeModule } from 'expo';

function Checks() {
  const [label, setLabel] = React.useState('WAITING');
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      const checks = [];
      try {
        if (AppState.currentState !== 'active') throw new Error('fixture_not_active');
        const phase = await (await fetch('http://127.0.0.1:18887/phase')).json();
        const files = requireNativeModule('KlodaPairing');
        for (const name of ['queueStatus', 'runFiles', 'rebackupFile', 'pauseFiles', 'listBackups', 'restoreBackup', 'cancelRestore']) {
          if (typeof files[name] !== 'function') throw new Error('missing_' + name);
        }
        checks.push('files_module_methods');
        if (phase.mode === 'start') {
          try { await files.runFiles('AAAAAAAAAAAAAAAAAAAAAA'); throw new Error('unexpected_owner_success'); }
          catch (error) { if (error.code !== 'native_unsupported') throw error; }
          checks.push('simulator_custody_refusal');
        }
        const queue = await files.queueStatus();
        if (queue.running || queue.jobs.length || !queue.run || queue.run.state === 'finished'
          || queue.run.errorCode !== 'native_unsupported' || (phase.id && phase.id !== queue.run.id)) {
          throw new Error('invalid_persistent_result');
        }
        checks.push(phase.mode === 'start' ? 'early_error_durable_without_fake_jobs' : 'process_restart_retains_same_run_error');
        await files.cancelRestore();
        await files.pauseFiles();
        await files.close();
        setLabel('PASS');
        await fetch('http://127.0.0.1:18887/result', { method: 'POST', body: JSON.stringify({ result: 'PASS', checks, id: queue.run.id }) });
      } catch (error) {
        setLabel('FAIL');
        await fetch('http://127.0.0.1:18887/result', { method: 'POST', body: JSON.stringify({ result: 'FAIL', checks, code: error.code ?? error.message }) });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  return React.createElement(Text, { accessibilityLabel: 'Files native smoke result' }, label);
}
registerRootComponent(Checks);
