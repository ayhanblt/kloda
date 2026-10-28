// Disposable Simulator only: no source/media selection, pairing, owner or network transfer.
import React from 'react';
import { AppState, Text } from 'react-native';
import { registerRootComponent, requireNativeModule } from 'expo';
function Checks() {
  const [label, setLabel] = React.useState('WAITING');
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      const checks = [];
      try {
        if (AppState.currentState !== 'active') throw new Error('not_active');
        const phase = await (await fetch('http://127.0.0.1:18887/phase')).json();
        const files = requireNativeModule('KlodaPairing');
        const settings = requireNativeModule('KlodaSyncRuntime');
        for (const method of ['queueStatus', 'pauseFiles', 'resumeAutomatic']) {
          if (typeof files[method] !== 'function') throw new Error('missing_' + method);
        }
        const before = await files.queueStatus();
        if (phase.mode === 'reopen' && before.automaticPaused !== true) throw new Error('pause_not_retained');
        if (before.running || before.jobs.length) throw new Error('unexpected_work');
        checks.push(phase.mode === 'reopen' ? 'process_restart_retains_pause' : 'real_native_status_no_fake_work');
        await settings.saveLiveSchedule();
        if ((await settings.loadSchedule()).backupMode !== 'live') throw new Error('live_not_saved');
        checks.push('live_setting_exported');
        await settings.saveSchedule(24, '02:30');
        const schedule = await settings.loadSchedule();
        if (schedule.intervalHours !== 24 || schedule.localTime !== '02:30') throw new Error('schedule_not_saved');
        checks.push('native_schedule_saved');
        const resumed = await files.resumeAutomatic();
        if (resumed.automaticPaused !== false || resumed.running) throw new Error('resume_without_trust_invalid');
        checks.push('continue_does_not_invent_trust_or_jobs');
        const paused = await files.pauseFiles();
        if (paused.automaticPaused !== true || paused.running) throw new Error('pause_not_saved');
        checks.push('explicit_pause_saved');
        await files.close();
        const closed = await files.queueStatus();
        if (closed.automaticPaused !== true || closed.running) throw new Error('close_loses_pause');
        checks.push('ui_close_preserves_pause');
        setLabel('PASS');
        await fetch('http://127.0.0.1:18887/result', {method: 'POST', body: JSON.stringify({result:'PASS', checks, phase:phase.mode})});
      } catch (error) {
        setLabel('FAIL');
        await fetch('http://127.0.0.1:18887/result', {method:'POST', body:JSON.stringify({result:'FAIL', checks, code:error.code ?? error.message})});
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  return React.createElement(Text, {accessibilityLabel:'Automatic backup native smoke'}, label);
}
registerRootComponent(Checks);
