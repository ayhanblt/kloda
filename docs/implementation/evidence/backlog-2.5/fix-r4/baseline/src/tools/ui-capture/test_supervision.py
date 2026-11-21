"""Device-free tests for supervised process ownership and the public CLI lifecycle."""
import sys

sys.dont_write_bytecode = True

import importlib  # noqa: E402
import importlib.util  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import signal  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402
import unittest  # noqa: E402
from types import SimpleNamespace  # noqa: E402
from unittest import mock  # noqa: E402
from pathlib import Path  # noqa: E402

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

import common  # noqa: E402
import desktop  # noqa: E402
import supervision  # noqa: E402
from test_capture import Tmp  # noqa: E402

CLI = HERE.parent / 'capture-ui.py'
_spec = importlib.util.spec_from_file_location('capture_ui', CLI)
cli = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cli)


def _cli(*argv, timeout=180):
    return subprocess.run([sys.executable, '-I', '-B', str(CLI), *argv], capture_output=True, text=True, timeout=timeout)


class OwnershipTests(Tmp):
    def group(self, pgid):
        return [p for p, (g, z, _) in supervision.process_table().items() if g == pgid and not z]

    def test_live_group_stopped_after_leader_exit(self):
        proc = self.run.spawn('tree', ['sh', '-c', 'sleep 60 & sleep 60 & sleep 0.3'])
        self.procs.append(proc)
        time.sleep(0.8)
        self.assertTrue(supervision.exited(proc))
        self.assertIsNone(proc.returncode)  # exited() did not reap: PGID stays reserved
        self.assertEqual(len(self.group(proc.pid)), 2)
        self.assertTrue(supervision.stop_owned(self.run, self.run.record['processes'][0], grace=5))
        self.assertEqual(self.group(proc.pid), [])

    def test_unrecorded_or_reaped_launch_not_signalled(self):
        entry = {'role': 'metro', 'pid': None, 'pgid': None, 'state': 'launching'}
        self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))
        self.assertEqual(entry['state'], 'unverified')
        proc = subprocess.Popen(['sh', '-c', 'sleep 60 & exit 0'], start_new_session=True)
        self.procs.append(proc)
        proc.wait()
        self.run.live[proc.pid] = proc
        time.sleep(0.2)
        entry.update(pid=proc.pid, pgid=proc.pid, state='running')
        self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))
        self.assertTrue(self.group(proc.pid))  # orphan still alive: nothing was signalled

    def test_supervisor_lost_then_retry(self):
        proc = subprocess.Popen(['sleep', '60'], start_new_session=True)
        self.procs.append(proc)
        entry = {'role': 'metro', 'pid': proc.pid, 'pgid': proc.pid, 'state': 'alive'}
        self.run.begin_cleanup()
        self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))
        self.assertIsNone(proc.poll())
        proc.kill()
        proc.wait()
        self.run.begin_cleanup()
        self.assertTrue(supervision.stop_owned(self.run, entry, grace=1))
        self.assertEqual(entry['state'], 'gone')

    def test_escaped_descendants_found(self):
        table = {10: (10, False, 1), 11: (10, False, 10), 12: (12, False, 11), 13: (13, True, 11), 14: (14, False, 12)}
        self.assertEqual(supervision.escaped(table, 10), [12, 14])

    def test_escaped_descendant_fails_cleanup_unsignalled(self):
        proc = self.run.spawn('metro', [sys.executable, '-c', 'import subprocess,time;'
                                        "subprocess.Popen(['sleep','60'],start_new_session=True);time.sleep(60)"])
        self.procs.append(proc)
        time.sleep(0.8)
        stray = supervision.escaped(supervision.process_table(), proc.pid)
        self.assertEqual(len(stray), 1)
        try:
            self.assertFalse(supervision.stop_owned(self.run, self.run.record['processes'][0], grace=5))
            self.assertIn(stray[0], supervision.process_table())  # left alive: never signalled
            self.assertEqual(self.run.record['processes'][0]['escaped'], stray)
        finally:
            os.kill(stray[0], signal.SIGKILL)

    def test_bootstrap_signal_kept_pending(self):
        supervision.install((signal.SIGUSR2,))
        try:
            os.kill(os.getpid(), signal.SIGUSR2)  # before arming: kept, not dropped
            with self.assertRaises(supervision.Interrupted):
                supervision.arm(True)
            with self.assertRaises(supervision.Interrupted):
                with supervision.critical():
                    os.kill(os.getpid(), signal.SIGUSR2)  # deferred until the critical section ends
        finally:
            supervision.arm(False)
            supervision._signals['pending'] = None
            signal.signal(signal.SIGUSR2, signal.SIG_DFL)

    def test_foreign_cannot_join_owned_group(self):
        proc = self.run.spawn('leader', ['sleep', '60'])
        self.procs.append(proc)
        with self.assertRaises(PermissionError):
            subprocess.Popen(['sleep', '1'], process_group=proc.pid)


class FinalizationTests(Tmp):
    CELL = 'a/tr/light/normal'

    def finalized(self, result='PASS', gen='g1'):
        self.run.record.pop('confirmation', None)
        self.record(driver='desktop-renderer', phase='CLEANED', result=result, finalization={'gen': gen, 'result': result},
                    cells={self.CELL: {'status': 'PASS', 'screen': 'settings'}})

    def stored(self):
        return json.loads((self.out / 'run.json').read_text())

    def test_matching_exit_is_confirmed_with_run_and_generation(self):
        self.finalized()
        self.assertEqual(cli._settle(self.out, 0), 0)
        record = self.stored()
        self.assertEqual((record['confirmation'], common.confirmed(record)), ({'runID': record['runID'], 'gen': 'g1', 'exit': 0}, True))

    def test_cli_loss_exit_mismatch_and_generation_change_never_confirm(self):
        for exit_code, interrupted in ((1, False), (0, True)):
            self.finalized()
            self.assertEqual(cli._settle(self.out, exit_code, cli_interrupted=interrupted), 1)
            self.assertFalse(common.confirmed(self.stored()))
            self.assertEqual(self.stored()['result'], 'FAIL')
        self.finalized()
        original = common.Run._acquire

        def racing(root):  # another cleanup replaces the result between the CLI's two reads
            data = json.loads((root / common.RECORD).read_text())
            common.atomic_write_json(root / common.RECORD, {**data, 'finalization': {'gen': 'g2', 'result': 'PASS'}})
            return original(root)
        common.Run._acquire = staticmethod(racing)
        try:
            self.assertEqual(cli._settle(self.out, 0), 1)
        finally:
            common.Run._acquire = staticmethod(original)
        self.assertFalse(common.confirmed(self.stored()))

    def test_offline_cleanup_cannot_confirm_and_resume_refuses(self):
        self.finalized()  # supervisor wrote PASS, the CLI never confirmed it
        done = _cli('cleanup', '--run', str(self.out))
        record = self.stored()
        self.assertEqual((done.returncode, record['phase'], record['result']), (1, 'CLEANED', 'FAIL'))
        self.run = common.Run.open(self.out)
        self.assertEqual(cli._resume_cell(self.run, {}, {}, self.CELL)['changed'], ['unconfirmed'])

    def test_confirmed_result_survives_offline_cleanup(self):
        self.finalized()
        cli._settle(self.out, 0)
        self.assertEqual(_cli('cleanup', '--run', str(self.out)).returncode, 0)
        self.assertEqual(self.stored()['result'], 'PASS')


class RecoveryTests(Tmp):
    def test_escaped_descendant_blocks_every_retry(self):
        stray = subprocess.Popen(['sleep', '60'], start_new_session=True)
        root = subprocess.Popen(['true'])
        root.wait()
        self.procs.append(stray)
        entry = {'role': 'metro', 'pid': root.pid, 'pgid': root.pid, 'state': 'alive', 'escaped': [stray.pid]}
        self.run.record['processes'].append(entry)
        self.record(driver='desktop-renderer', phase='RESTORE_PENDING', result='CLEANUP_FAILED')
        for _ in range(2):  # root group is gone, the recorded escaped child is not: still pending, never signalled
            self.assertEqual(_cli('cleanup', '--run', str(self.out)).returncode, common.EXIT_CODES['CLEANUP_FAILED'])
            self.assertIsNone(stray.poll())
        stray.kill()
        stray.wait()
        self.assertEqual(_cli('cleanup', '--run', str(self.out)).returncode, common.EXIT_CODES['FAIL'])
        self.assertEqual(json.loads((self.out / 'run.json').read_text())['phase'], 'CLEANED')

    def roles(self):
        return {e['role']: e for e in self.run.record['processes']}

    def test_driver_and_browser_get_separate_receipts(self):
        desktop.launch(self.run)
        roles = self.roles()
        self.assertEqual(set(roles), {'playwright-driver', 'browser'})
        self.assertTrue(all(e['pid'] for e in roles.values()))
        desktop.cleanup(self.run)
        self.assertEqual(self.run.record['cleanup']['errors'], [])
        self.assertEqual([self.roles()[r]['state'] for r in sorted(roles)], ['gone', 'gone'])
        self.assertEqual({s['step'] for s in self.run.record['cleanup']['steps']}, {'stop:browser', 'stop:playwright-driver'})

    def test_browser_gone_driver_alive_or_unknown_stays_pending(self):
        desktop.launch(self.run)
        driver, entry = self.run.live.pop('playwright'), self.roles()['playwright-driver']
        self.run.live.pop('browser').close()  # supervisor lost after only the browser closed
        desktop.cleanup(self.run)
        self.assertEqual((self.roles()['browser']['state'], entry['state']), ('gone', 'unverified'))
        pid, entry['pid'] = entry['pid'], None  # identity never established: no receipt either
        desktop.cleanup(self.run)
        self.assertEqual(entry['state'], 'unverified')
        driver.stop()
        entry['pid'] = pid
        desktop.cleanup(self.run)
        self.assertEqual((self.run.record['cleanup']['errors'], entry['state']), ([], 'gone'))

    def test_intents_precede_start_and_launch(self):
        seen = []

        def start_fails():
            seen.append([e['state'] for e in self.run.record['processes']])
            raise RuntimeError('start failed')
        with mock.patch('playwright.sync_api.sync_playwright', lambda: SimpleNamespace(start=start_fails)):
            with self.assertRaises(RuntimeError):
                desktop.launch(self.run)
        self.assertEqual(seen, [['launching']])
        desktop.cleanup(self.run)  # failed start with no child observed: nothing to prove open
        self.assertEqual(self.run.record['cleanup']['errors'], [])
        self.run.record['processes'].clear()
        original, seen = importlib.import_module('playwright.sync_api').sync_playwright, []

        def launch_fails(**_kwargs):
            seen.append({e['role']: e['state'] for e in self.run.record['processes']})
            raise RuntimeError('launch failed')

        def start():  # a real driver, started after launch() took its baseline
            real = original().start()
            return SimpleNamespace(chromium=SimpleNamespace(launch=launch_fails), stop=real.stop)
        with mock.patch('playwright.sync_api.sync_playwright', lambda: SimpleNamespace(start=start)):
            with self.assertRaises(RuntimeError):
                desktop.launch(self.run)
        self.assertEqual(seen[0]['browser'], 'launching')  # Chromium intent exists before launch()
        desktop.cleanup(self.run)
        self.assertEqual(self.run.record['cleanup']['errors'], [])


class CliTests(Tmp):
    def test_usage_and_blocked(self):
        out = self.dir / 'blocked'
        done = _cli('run', '--driver', 'desktop-renderer', '--screen', 'settings', '--size', 'large', '--out', str(out))
        self.assertEqual(done.returncode, common.EXIT_CODES['BLOCKED'], done.stdout + done.stderr)
        record = json.loads((out / 'run.json').read_text())
        self.assertEqual((record['phase'], record['result']), ('CLEANED', 'BLOCKED'))
        self.assertTrue(common.confirmed(record))  # a normal run: the waiting CLI confirmed the exit
        self.assertFalse(list(out.glob('*.png')))
        bad = _cli('run', '--driver', 'desktop-renderer', '--width', '0', '--out', str(self.dir / 'w'))
        self.assertEqual(bad.returncode, common.EXIT_CODES['USAGE'])

    def test_lost_desktop_supervisor_stays_pending(self):
        self.run.record['driver'] = 'desktop-renderer'
        self.run.track('browser')['state'] = 'running'
        self.record(phase='RUNNING', cells={'a/tr/light/normal': {'status': 'PASS'}})
        for attempt in range(2):
            done = _cli('cleanup', '--run', str(self.out))
            self.assertEqual(done.returncode, common.EXIT_CODES['CLEANUP_FAILED'], done.stdout)
        self.assertEqual(json.loads((self.out / 'run.json').read_text())['phase'], 'RESTORE_PENDING')
        self.assertEqual(_cli('resume', '--run', str(self.out)).returncode, common.EXIT_CODES['CLEANUP_FAILED'])

    def test_recovered_run_is_never_pass(self):
        self.record(driver='desktop-renderer', phase='RUNNING', cells={'a/tr/light/normal': {'status': 'PASS'}})
        done = _cli('cleanup', '--run', str(self.out), timeout=120)
        record = json.loads((self.out / 'run.json').read_text())
        self.assertEqual((done.returncode, record['phase'], record['result']), (1, 'CLEANED', 'FAIL'))
        self.assertTrue(record['interrupted'])

    def test_abnormal_supervisor_exit_never_pass(self):
        self.record(phase='CLEANED', result='PASS', cells={'a/tr/light/normal': {'status': 'PASS'}})
        self.assertEqual(cli._settle(self.out, -6), common.EXIT_CODES['FAIL'])
        record = json.loads((self.out / 'run.json').read_text())
        self.assertEqual((record['result'], record['supervisorAbnormal']), ('FAIL', -6))
        self.run = common.Run.open(self.out)
        self.assertEqual(cli._resume_cell(self.run, {}, {}, 'a/tr/light/normal')['changed'], ['unconfirmed'])

    def test_early_cli_loss_launches_nothing(self):
        renderer = self.dir / 'renderer'
        renderer.mkdir()
        (renderer / 'index.html').write_text('<p>x</p>')
        common.atomic_write_json(renderer / desktop.STAMP, {'sourceSha256': desktop.source_hash(REPO),
                                                            'rendererSha256': desktop.renderer_hash(renderer)})
        opts = {'screen': 'settings', 'locale': 'tr', 'theme': 'light', 'size': 'normal', 'width': 1440,
                'renderer': str(renderer), 'fixture': None, 'runtime': None, 'deviceType': None}
        out = self.dir / 'early'
        run = common.Run.create(out, 'desktop-renderer', {'cells': ['desktop.settings/tr/light/normal'], 'args': opts})
        fd = run.lock_fileno()
        done = subprocess.run([sys.executable, '-I', '-B', str(CLI), '_supervise', '--run', str(run.root),
                               '--lock-fd', str(fd)], stdin=subprocess.DEVNULL, pass_fds=(fd,), timeout=120)
        run.close()
        record = json.loads((out / 'run.json').read_text())
        self.assertEqual((done.returncode, record['phase'], record['result']), (1, 'CLEANED', 'FAIL'))
        self.assertTrue(record['interrupted'])
        self.assertEqual((record['processes'], record['cells']['desktop.settings/tr/light/normal']['status']),
                         ([], 'FAIL'))

    def test_resume_rejects_changed_row(self):
        old = {'status': 'PASS', 'screen': 'other-screen', 'fingerprint': {}}
        self.run.record.update(driver='ios-native-entry', cells={'mobile.settings/tr/light/normal': old}, result='PASS',
                               finalization={'gen': 'g', 'result': 'PASS'})
        self.run.record['confirmation'] = {'runID': self.run.record['runID'], 'gen': 'g', 'exit': 0}
        matrix = cli.mx.load(cli.MATRIX)
        rows = {row['id']: row for row in matrix['rows']}
        self.assertEqual(cli._resume_cell(self.run, matrix, rows, 'mobile.settings/tr/light/normal')['changed'], ['row'])

    def test_public_cli_sigkill_supervisor_cleans(self):
        if importlib.util.find_spec('playwright') is None:
            self.skipTest('python playwright not installed')
        renderer = self.dir / 'renderer'
        renderer.mkdir()
        (renderer / 'index.html').write_text(
            '<input type=radio name=kloda-language value=tr><script>setTimeout(() => {'
            ' const d = document.createElement("div"); d.className = "appearance-settings";'
            ' document.body.append(d); }, 3000)</script>')
        common.atomic_write_json(renderer / desktop.STAMP, {'sourceSha256': desktop.source_hash(REPO),
                                                            'rendererSha256': desktop.renderer_hash(renderer)})
        out = self.dir / 'killed'
        public = subprocess.Popen([sys.executable, '-I', '-B', str(CLI), 'run', '--driver', 'desktop-renderer',
                                   '--screen', 'settings', '--locale', 'tr', '--theme', 'light', '--size', 'normal',
                                   '--renderer', str(renderer), '--out', str(out)], stdout=subprocess.DEVNULL)
        def state():
            try:
                return json.loads((out / 'run.json').read_text())
            except (OSError, ValueError):
                return {}
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline and not [e for e in state().get('processes', []) if e['state'] == 'running']:
            time.sleep(0.1)
        public.kill()  # the public CLI dies while the supervisor's browser is up
        public.wait()
        while time.monotonic() < deadline and 'result' not in state():
            time.sleep(0.2)
        record = state()
        self.assertEqual((record['phase'], record['result']), ('CLEANED', 'FAIL'))
        self.assertTrue(record['interrupted'])
        self.assertEqual({e['role']: e['state'] for e in record['processes']}, {'playwright-driver': 'gone', 'browser': 'gone'})
        self.assertTrue(all(e['pid'] for e in record['processes']))  # both identities were recorded at launch
        self.assertTrue(common.confirmed(record) is False)  # the CLI died: no exit confirmation


if __name__ == '__main__':
    unittest.main()
