"""Device-free tests for write-ahead escape records and ownerless recovery (pending, never signalled)."""
import sys

sys.dont_write_bytecode = True

import json  # noqa: E402
import os  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402
from pathlib import Path  # noqa: E402
from unittest import mock  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402
import supervision  # noqa: E402
from test_capture import Tmp  # noqa: E402
from test_supervision import ESCAPING, _cli  # noqa: E402


class WriteAheadTests(Tmp):
    def tree(self):
        proc = self.run.spawn('metro', ESCAPING)
        self.procs.append(proc)
        time.sleep(0.8)
        self.strays = supervision.escaped(supervision.process_table(), proc.pid)
        self.addCleanup(lambda: [subprocess.run(['kill', '-9', str(pid)], capture_output=True) for pid in self.strays])
        return proc, self.run.record['processes'][0]

    def test_record_precedes_first_signal_and_stray_is_never_signalled(self):
        _, entry = self.tree()
        seen, real = [], os.killpg

        def spy(pgid, sig):
            seen.append(json.loads((self.out / 'run.json').read_text())['processes'][0].get('escaped'))
            return real(pgid, sig)
        with mock.patch.object(supervision.os, 'killpg', spy):
            self.assertFalse(supervision.stop_owned(self.run, entry, grace=5))
        self.assertEqual((seen[0], entry['escaped']), (self.strays, self.strays))
        self.assertIn(self.strays[0], supervision.process_table())  # left alive: never signalled

    def test_unpersisted_record_means_no_signal(self):
        proc, entry = self.tree()
        killpg = mock.Mock(side_effect=AssertionError('signalled without a durable escape record'))
        with mock.patch.object(supervision.os, 'killpg', killpg), \
                mock.patch.object(common, 'atomic_write_json', side_effect=OSError('disk full')):
            self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))
        self.assertEqual((killpg.call_count, proc.poll(), entry['state']), (0, None, 'unverified'))

    def test_loss_after_the_record_then_two_retries_stay_pending(self):
        proc, entry = self.tree()

        class Lost(BaseException):
            pass
        with mock.patch.object(supervision.os, 'killpg', side_effect=Lost), self.assertRaises(Lost):
            supervision.stop_owned(self.run, entry, grace=1)  # the supervisor dies at its first signal
        proc.kill()
        proc.wait()
        self.record(driver='desktop-renderer', phase='RESTORE_PENDING', result='CLEANUP_FAILED')
        for _ in range(2):
            self.assertEqual(_cli('cleanup', '--run', str(self.out)).returncode, common.EXIT_CODES['CLEANUP_FAILED'])
            self.assertIn(self.strays[0], supervision.process_table())  # never signalled
        self.assertEqual(_cli('resume', '--run', str(self.out)).returncode, common.EXIT_CODES['CLEANUP_FAILED'])

    def failing_save(self):
        return mock.patch.object(common, 'atomic_write_json', side_effect=OSError('disk full'))

    def test_failed_write_keeps_observation_and_every_retry_saves_again(self):
        proc, entry = self.tree()
        killpg = mock.Mock(side_effect=AssertionError('signalled without a durable escape record'))
        with mock.patch.object(supervision.os, 'killpg', killpg), self.failing_save():
            for _ in range(2):  # same owner, same in-memory list: equality is not durable proof
                self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))
        self.assertEqual((killpg.call_count, entry['escaped'], proc.poll()), (0, self.strays, None))
        entry['state'] = 'running'
        self.assertFalse(supervision.stop_owned(self.run, entry, grace=5))  # stray stays alive: not clean
        self.assertEqual(json.loads((self.out / 'run.json').read_text())['processes'][0]['escaped'], self.strays)

    def lost_after_failed_write(self):
        proc, entry = self.tree()
        with mock.patch.object(supervision.os, 'killpg', side_effect=AssertionError('signalled')), self.failing_save():
            self.assertFalse(supervision.stop_owned(self.run, entry, grace=1))
        proc.kill()  # the supervisor is gone: the disk has no escape observation, the root and old strays are gone
        proc.wait()
        return entry

    def test_unrecorded_observation_then_loss_stays_pending_without_signal(self):
        entry = self.lost_after_failed_write()
        entry.pop('escaped')
        self.record(driver='desktop-renderer', phase='RESTORE_PENDING', result='CLEANUP_FAILED')
        for _ in range(2):
            self.assertEqual(_cli('cleanup', '--run', str(self.out)).returncode, common.EXIT_CODES['CLEANUP_FAILED'])
            self.assertIn(self.strays[0], supervision.process_table())
        self.assertEqual(_cli('resume', '--run', str(self.out)).returncode, common.EXIT_CODES['CLEANUP_FAILED'])
        self.assertEqual(json.loads((self.out / 'run.json').read_text())['phase'], 'RESTORE_PENDING')

    def test_null_escape_record_is_pending_not_a_crash(self):
        entry = self.lost_after_failed_write()
        entry['escaped'] = None
        self.record(driver='desktop-renderer', phase='RESTORE_PENDING', result='CLEANUP_FAILED')
        done = _cli('cleanup', '--run', str(self.out))
        self.assertEqual((done.returncode, 'Traceback' in done.stderr), (common.EXIT_CODES['CLEANUP_FAILED'], False))
        self.assertEqual(self.stored_state(), 'unverified')

    def stored_state(self):
        return json.loads((self.out / 'run.json').read_text())['processes'][0]['state']
