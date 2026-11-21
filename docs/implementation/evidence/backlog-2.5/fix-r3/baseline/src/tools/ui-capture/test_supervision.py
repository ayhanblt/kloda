"""Device-free tests for supervised process ownership and the public CLI lifecycle."""
import sys

sys.dont_write_bytecode = True

import importlib.util  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import signal  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402
import unittest  # noqa: E402
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

    def test_unrecorded_launch_not_signalled(self):
        entry = {'role': 'metro', 'pid': None, 'pgid': None, 'state': 'launching'}
        self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))
        self.assertEqual(entry['state'], 'unverified')

    def test_reaped_handle_not_signalled(self):
        proc = subprocess.Popen(['sh', '-c', 'sleep 60 & exit 0'], start_new_session=True)
        self.procs.append(proc)
        proc.wait()
        self.run.live[proc.pid] = proc
        entry = {'role': 'metro', 'pid': proc.pid, 'pgid': proc.pid, 'state': 'running'}
        time.sleep(0.2)
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
        table = {10: (10, False, 1), 11: (10, False, 10), 12: (12, False, 11), 13: (13, True, 11),
                 14: (14, False, 12), 20: (20, False, 1)}
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
        reached = False
        try:
            os.kill(os.getpid(), signal.SIGUSR2)  # before arming: kept, not dropped
            with self.assertRaises(supervision.Interrupted):
                supervision.arm(True)
            with self.assertRaises(supervision.Interrupted):
                with supervision.critical():
                    os.kill(os.getpid(), signal.SIGUSR2)  # deferred until the critical section ends
                    reached = True
            self.assertTrue(reached)
        finally:
            supervision.arm(False)
            supervision._signals['pending'] = None
            signal.signal(signal.SIGUSR2, signal.SIG_DFL)

    def test_foreign_cannot_join_owned_group(self):
        proc = self.run.spawn('leader', ['sleep', '60'])
        self.procs.append(proc)
        with self.assertRaises(PermissionError):
            subprocess.Popen(['sleep', '1'], process_group=proc.pid)


class CliTests(Tmp):
    def test_usage_and_blocked(self):
        out = self.dir / 'blocked'
        done = _cli('run', '--driver', 'desktop-renderer', '--screen', 'settings', '--size', 'large', '--out', str(out))
        self.assertEqual(done.returncode, common.EXIT_CODES['BLOCKED'], done.stdout + done.stderr)
        record = json.loads((out / 'run.json').read_text())
        self.assertEqual((record['phase'], record['result']), ('CLEANED', 'BLOCKED'))
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
        self.assertEqual(cli._resume_cell(self.run, {}, {}, 'a/tr/light/normal')['changed'], ['supervisor'])

    def test_normal_supervisor_exit_kept(self):
        self.record(phase='RESTORE_PENDING', result='CLEANUP_FAILED')
        self.assertEqual(cli._settle(self.out, 3), common.EXIT_CODES['CLEANUP_FAILED'])
        self.assertNotIn('supervisorAbnormal', json.loads((self.out / 'run.json').read_text()))

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
        self.run.record.update(driver='ios-native-entry', cells={'mobile.settings/tr/light/normal': old})
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
        self.assertEqual([e['state'] for e in record['processes']], ['gone'])
        self.assertIsNotNone(record['processes'][0]['pid'])  # browser identity was recorded at launch


if __name__ == '__main__':
    unittest.main()
