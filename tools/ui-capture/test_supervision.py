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


CELL = 'desktop.settings/tr/light/normal'
ESCAPING = [sys.executable, '-c', 'import subprocess,time;subprocess.Popen(["sleep","60"],start_new_session=True);time.sleep(60)']


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
        self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))
        self.assertIsNone(proc.poll())
        proc.kill()
        proc.wait()
        self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))  # root absence alone is no proof
        self.assertEqual(entry['state'], 'unverified')
        entry['state'] = 'gone'  # a verified terminal record stays a success
        self.assertTrue(supervision.stop_owned(self.run, entry, grace=1))

    def test_bootstrap_signal_kept_pending(self):
        supervision.install((signal.SIGUSR2,))
        self.addCleanup(signal.signal, signal.SIGUSR2, signal.SIG_DFL)
        self.addCleanup(supervision.arm, False)
        os.kill(os.getpid(), signal.SIGUSR2)  # before arming: kept, not dropped
        with self.assertRaises(supervision.Interrupted):
            supervision.arm(True)
        with self.assertRaises(supervision.Interrupted), supervision.critical():
            os.kill(os.getpid(), signal.SIGUSR2)  # deferred until the critical section ends


class FinalizationTests(Tmp):
    def finalized(self):
        for key in ('confirmation', 'unconfirmed', 'interrupted', 'runError', 'supervisorAbnormal'):
            self.run.record.pop(key, None)
        self.record(driver='desktop-renderer', phase='CLEANED', result='PASS', finalization={'gen': 'g1', 'result': 'PASS'},
                    selection={'cells': [CELL], 'args': {}}, cells={CELL: {'status': 'PASS', 'screen': 'settings'}})

    def stored(self):
        return json.loads((self.out / 'run.json').read_text())

    def test_exit_mismatch_and_generation_race_never_confirm(self):
        self.finalized()
        self.assertEqual(cli._settle(self.out, -6), 1)  # abnormal supervisor exit
        record = self.stored()
        self.assertEqual((common.confirmed(record), record['result'], record['supervisorAbnormal']), (False, 'FAIL', -6))
        self.finalized()
        original = common.Run._acquire

        def racing(root):  # another cleanup replaces the result between the CLI's two reads
            common.atomic_write_json(root / common.RECORD, {**json.loads((root / common.RECORD).read_text()),
                                                            'finalization': {'gen': 'g2', 'result': 'PASS'}})
            return original(root)
        with mock.patch.object(common.Run, '_acquire', staticmethod(racing)):
            self.assertEqual(cli._settle(self.out, 0), 1)
        self.assertFalse(common.confirmed(self.stored()))

    def test_offline_cleanup_cannot_confirm_and_a_confirmed_result_survives_it(self):
        self.finalized()  # supervisor wrote PASS, the CLI never confirmed it
        done = _cli('cleanup', '--run', str(self.out))
        record = self.stored()
        self.assertEqual((done.returncode, record['phase'], record['result']), (1, 'CLEANED', 'FAIL'))
        self.run = common.Run.open(self.out)
        self.assertEqual(cli._resume_cell(self.run, {}, {}, CELL)['changed'], ['unconfirmed'])
        self.run.close()
        self.finalized()
        cli._settle(self.out, 0)  # the waiting CLI confirmed it: offline cleanup keeps it
        self.assertEqual((_cli('cleanup', '--run', str(self.out)).returncode, self.stored()['result']), (0, 'PASS'))


class ProductionSettlement(Tmp):
    """Real cmd_run -> _settle with real SIGTERM/SIGINT on each side of the single confirmation decision."""

    def run_cli(self, at=None, sig=signal.SIGTERM, fail_write=False):
        out = self.dir / f'prod{len(list(self.dir.glob("prod*")))}'
        args = SimpleNamespace(driver='desktop-renderer', screen='settings', locale='tr', theme='light', size='normal',
                               width=1440, renderer=str(self.dir), fixture=None, runtime='r', device_type='d', out=str(out))
        real_open, real_write = common.Run.open, common.atomic_write_json

        def hit(point):
            if at == point:
                os.kill(os.getpid(), sig)

        def finished():  # the supervisor completed: provisional PASS with verified cleanup
            run = real_open(out)
            run.record.update(phase='CLEANED', result='PASS', cells={CELL: {'status': 'PASS'}},
                              finalization={'gen': 'g', 'result': 'PASS'})
            run.save()
            run.close()
            return 0

        def opened(*a, **k):
            hit('pre-lock')  # after wait() returned, before the CLI holds the lock
            run = real_open(*a, **k)
            hit('locked')  # lock held, decision not yet taken
            return run

        def written(path, data):
            if data.get('confirmation'):
                hit('commit')  # decision taken: delivery waits for the atomic write
                if fail_write:
                    raise OSError('disk full')
            return real_write(path, data)
        with mock.patch.object(cli.subprocess, 'Popen', mock.Mock(return_value=mock.Mock(wait=finished))), \
                mock.patch.object(common.Run, 'open', opened), mock.patch.object(common, 'atomic_write_json', written):
            code = cli.cmd_run(args)
        return code, json.loads((out / 'run.json').read_text())

    def test_single_decision_point(self):
        for at, sig, ok in ((None, signal.SIGTERM, True), ('pre-lock', signal.SIGTERM, False),
                            ('locked', signal.SIGINT, False), ('commit', signal.SIGTERM, True), ('commit', signal.SIGINT, True)):
            code, record = self.run_cli(at, sig)
            self.assertEqual((code, common.confirmed(record), record['result']), (0, True, 'PASS') if ok else (1, False, 'FAIL'), (at, sig))
        code, record = self.run_cli(fail_write=True)
        self.assertEqual((code, common.confirmed(record)), (1, False))

    def test_cli_killed_mid_write_leaves_no_confirmation(self):
        target = self.dir / 'run.json'
        target.write_text('{"old": true}')
        script = (f'import os,signal,sys\nsys.path.insert(0, {str(HERE)!r})\nimport common\n'
                  'os.replace = lambda *a: os.kill(os.getpid(), signal.SIGKILL)\n'
                  f'common.atomic_write_json({str(target)!r}, {{"confirmation": 1}})\n')
        done = subprocess.run([sys.executable, '-I', '-B', '-c', script])
        self.assertEqual((done.returncode, json.loads(target.read_text())), (-signal.SIGKILL, {'old': True}))


class RecoveryTests(Tmp):
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

    def failed_launch(self, real_driver):
        from playwright.sync_api import sync_playwright as original

        def start():
            if not real_driver:
                raise RuntimeError('start failed')
            self.driver = original().start()  # a real driver, started after launch() took its baseline
            return SimpleNamespace(chromium=SimpleNamespace(launch=mock.Mock(side_effect=RuntimeError('launch failed'))),
                                   stop=self.driver.stop)
        with mock.patch('playwright.sync_api.sync_playwright', lambda: SimpleNamespace(start=start)):
            with self.assertRaises(RuntimeError):
                desktop.launch(self.run)

    def test_failed_start_or_launch_is_no_closed_proof(self):
        self.failed_launch(False)
        self.assertEqual(self.roles()['playwright-driver']['state'], 'launching')  # intent stays open
        desktop.cleanup(self.run)
        self.assertEqual(common.final_status({**self.run.record, 'phase': 'CLEANED'}), 'CLEANUP_FAILED')
        self.run.record['processes'].clear()
        self.failed_launch(True)  # driver observed alive, browser intent open
        desktop.cleanup(self.run)
        self.assertEqual((self.roles()['browser']['state'], bool(self.run.record['cleanup']['errors'])), ('unverified', True))
        self.driver.stop()
        desktop.cleanup(self.run)
        self.assertEqual(self.roles()['playwright-driver']['state'], 'gone')


class CliTests(Tmp):
    def test_usage_and_blocked(self):
        out = self.dir / 'blocked'
        done = _cli('run', '--driver', 'desktop-renderer', '--screen', 'settings', '--size', 'large', '--out', str(out))
        self.assertEqual(done.returncode, common.EXIT_CODES['BLOCKED'], done.stdout + done.stderr)
        record = json.loads((out / 'run.json').read_text())
        self.assertEqual((record['phase'], record['result'], common.confirmed(record)), ('CLEANED', 'BLOCKED', True))
        self.assertFalse(list(out.glob('*.png')))

    def stamped(self, html=''):
        renderer = self.dir / 'renderer'
        renderer.mkdir()
        (renderer / 'index.html').write_text(html or '<p>x</p>')
        common.atomic_write_json(renderer / desktop.STAMP, {'sourceSha256': desktop.source_hash(REPO),
                                                            'rendererSha256': desktop.renderer_hash(renderer)})
        return renderer

    def test_early_cli_loss_launches_nothing(self):
        opts = {'screen': 'settings', 'locale': 'tr', 'theme': 'light', 'size': 'normal', 'width': 1440,
                'renderer': str(self.stamped()), 'fixture': None, 'runtime': None, 'deviceType': None}
        out = self.dir / 'early'
        run = common.Run.create(out, 'desktop-renderer', {'cells': [CELL], 'args': opts})
        fd = run.lock_fileno()
        done = subprocess.run([sys.executable, '-I', '-B', str(CLI), '_supervise', '--run', str(run.root),
                               '--lock-fd', str(fd)], stdin=subprocess.DEVNULL, pass_fds=(fd,), timeout=120)
        run.close()
        record = json.loads((out / 'run.json').read_text())
        self.assertEqual((done.returncode, record['phase'], record['result'], bool(record['interrupted'])), (1, 'CLEANED', 'FAIL', True))
        self.assertEqual((record['processes'], record['cells'][CELL]['status']), ([], 'FAIL'))

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
        renderer = self.stamped('<input type=radio name=kloda-language value=tr><script>setTimeout(() => {'
                                ' const d = document.createElement("div"); d.className = "appearance-settings";'
                                ' document.body.append(d); }, 3000)</script>')
        out = self.dir / 'killed'
        public = subprocess.Popen([sys.executable, '-I', '-B', str(CLI), 'run', '--driver', 'desktop-renderer',
                                   '--screen', 'settings', '--locale', 'tr', '--theme', 'light', '--size', 'normal',
                                   '--renderer', str(renderer), '--out', str(out)], stdout=subprocess.DEVNULL)

        def state():
            try:
                return json.loads((out / 'run.json').read_text())
            except (OSError, ValueError):
                return {}

        def until(done):
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline and not done(state()):
                time.sleep(0.1)
        until(lambda r: any(e['state'] == 'running' for e in r.get('processes', [])))
        public.kill()  # the public CLI dies while the supervisor's browser is up
        public.wait()
        until(lambda r: 'result' in r)
        record = state()
        self.assertEqual((record['phase'], record['result'], common.confirmed(record)), ('CLEANED', 'FAIL', False))
        self.assertEqual({e['role']: e['state'] for e in record['processes']}, {'playwright-driver': 'gone', 'browser': 'gone'})
        self.assertTrue(all(e['pid'] for e in record['processes']))  # both identities were recorded at launch


if __name__ == '__main__':
    unittest.main()
