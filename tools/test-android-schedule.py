"""Disposable SQLite + actual Kotlin occurrence model; not Android JobScheduler acceptance."""
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync'
SOURCE = (BASE / 'AndroidScheduleJournal.kt').read_text()


def sql(prefix):
    strings = re.findall(r'"""(.*?)"""|"([^"\n]+)"', SOURCE, re.S)
    return next(a or b for a, b in strings if (a or b).startswith(prefix))


class ScheduleChecks(unittest.TestCase):
    def create(self, db):
        for prefix in ('CREATE TABLE files_run_job', 'CREATE TRIGGER validate_files_run_job',
                       'CREATE TRIGGER immutable_files_run_job', 'CREATE TRIGGER retain_files_run_job', 'CREATE TABLE scheduled_occurrence', 'CREATE TRIGGER immutable_scheduled_occurrence',
                       'CREATE TRIGGER retain_scheduled_occurrence'):
            db.execute(sql(prefix))

    def insert(self, db, ident='occ', binding='binding', record='peer', occurrence=1000):
        db.execute(sql('INSERT INTO scheduled_occurrence('), (ident, binding, record, occurrence))

    def save(self, db, attempts=1, updated=0, phase='running', wall=None, elapsed=None, boot=None, run=None, error=None):
        prior = db.execute("SELECT os_attempts,phase FROM scheduled_occurrence WHERE id='occ'").fetchone()
        db.execute(sql('UPDATE scheduled_occurrence SET os_attempts='),
                   (attempts, updated, phase, wall, elapsed, boot, run, error, 'occ', *prior))

    def test_schema6_only_adds_occurrence_metadata(self):
        source = (BASE / 'AndroidSyncJournal.kt').read_text()
        self.assertIn('null, 6)', source)
        self.assertIn('if (oldVersion < 6) AndroidScheduleJournal.create(database)', source)
        self.assertEqual(source.count('AndroidScheduleJournal.create(database)'), 2)
        db = sqlite3.connect(':memory:')
        # Existing receipts, access-retry budget and context stay untouched on schema5 ->6.
        db.execute('CREATE TABLE files_job(id PRIMARY KEY, state)')
        db.execute("INSERT INTO files_job VALUES('receipt','completed')")
        db.execute('CREATE TABLE files_run(id PRIMARY KEY, attempts, context_binding)')
        db.execute("INSERT INTO files_run VALUES('run',5,'old-binding')")
        self.create(db)
        self.assertEqual(db.execute('SELECT * FROM scheduled_occurrence').fetchall(), [])
        self.assertEqual(db.execute('SELECT * FROM files_job').fetchall(), [('receipt', 'completed')])
        self.assertEqual(db.execute('SELECT * FROM files_run').fetchall(), [('run', 5, 'old-binding')])

    def test_unique_occurrence_bound_record_and_run(self):
        db = sqlite3.connect(':memory:'); self.create(db); self.insert(db)
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(db, 'duplicate', record='other-peer')
        for field in ('id', 'context_binding', 'record_id', 'occurrence_ms'):
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(f'UPDATE scheduled_occurrence SET {field}=?', (2000 if field == 'occurrence_ms' else 'other',))
        self.save(db, run='run')
        with self.assertRaises(sqlite3.IntegrityError):
            self.save(db, run='replacement')
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute('DELETE FROM scheduled_occurrence')
        self.insert(db, 'new-settings', binding='new-binding')
        self.assertEqual(db.execute('SELECT count(*) FROM scheduled_occurrence').fetchone(), (2,))

    def test_retry_budget_and_truthful_terminal_result(self):
        db = sqlite3.connect(':memory:'); self.create(db); self.insert(db)
        for attempts in range(1, 6):
            self.save(db, attempts, phase='waiting', wall=301000, elapsed=305000, boot=7)
            if attempts < 5:
                self.save(db, attempts + 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.save(db, 6)
        with self.assertRaises(sqlite3.IntegrityError):
            self.save(db, 4)
        with self.assertRaises(sqlite3.IntegrityError):
            self.save(db, 5, updated=1)
        self.save(db, 5, phase='exhausted')
        with self.assertRaises(sqlite3.IntegrityError):
            self.save(db, 5, updated=1, phase='finished')
        other = sqlite3.connect(':memory:'); self.create(other); self.insert(other)
        self.save(other, phase='finished', error='denied')
        self.assertEqual(other.execute('SELECT os_attempts,updated FROM scheduled_occurrence').fetchone(), (1, 0))
        with self.assertRaises(sqlite3.IntegrityError):
            self.save(other, updated=1, phase='finished')
        good = sqlite3.connect(':memory:'); self.create(good); self.insert(good)
        self.save(good, updated=1, phase='finished')
        self.assertEqual(good.execute('SELECT updated FROM scheduled_occurrence').fetchone(), (1,))

    def test_old_attempt_callbacks_cannot_finish_or_rebind_the_new_attempt(self):
        db = sqlite3.connect(':memory:'); self.create(db); self.insert(db)
        self.save(db, phase='waiting', wall=301000, elapsed=305000, boot=7)
        self.save(db, 2, run='original-run')
        update = sql('UPDATE scheduled_occurrence SET os_attempts=')
        for phase, updated in (('finished', 1), ('paused', 0), ('waiting', 0)):
            result = db.execute(update, (1, updated, phase, None, None, None, 'wrong-run', None, 'occ', 1, 'running'))
            self.assertEqual(result.rowcount, 0)
        self.assertEqual(db.execute('SELECT os_attempts,updated,phase,run_id FROM scheduled_occurrence').fetchone(),
                         (2, 0, 'running', 'original-run'))

    def test_true_process_reopen_keeps_deadline_budget_and_bound_run(self):
        with tempfile.TemporaryDirectory(prefix='kloda-occurrence-') as directory:
            path = str(Path(directory) / 'journal.sqlite')
            db = sqlite3.connect(path); self.create(db); self.insert(db)
            self.save(db, 2)
            self.save(db, 3)
            self.save(db, 4, phase='waiting', wall=301000, elapsed=305000, boot=7, run='same-files-run', error='os_interrupted')
            db.commit(); db.close()
            result = subprocess.check_output(['python3', '-c',
                'import sqlite3,json,sys; print(json.dumps(sqlite3.connect(sys.argv[1]).execute("SELECT os_attempts,updated,phase,retry_at,retry_elapsed,retry_boot,run_id FROM scheduled_occurrence").fetchone()))', path], text=True)
            self.assertEqual(json.loads(result), [4, 0, 'waiting', 301000, 305000, 7, 'same-files-run'])

    def test_linked_terminal_reconciliation_requires_exact_record_context_and_completion(self):
        db = sqlite3.connect(':memory:'); self.create(db); self.insert(db)
        db.executescript("""CREATE TABLE files_run(id PRIMARY KEY,record_id,context_binding,state,error_code);
          CREATE TABLE files_job(id PRIMARY KEY,record_id,state);
          CREATE TABLE owner_deleted(job PRIMARY KEY);
          INSERT INTO files_run VALUES('run','peer','binding','finished',NULL);""")
        query = sql('SELECT r.state,r.error_code,')
        args = ('run', 'peer', 'binding')
        self.assertEqual(db.execute(query, args).fetchone(), ('finished', None, 0))
        db.execute("INSERT INTO files_job VALUES('completed','peer','completed')")
        # Unrelated historical completion is never evidence for this run.
        self.assertEqual(db.execute(query, args).fetchone(), ('finished', None, 0))
        db.execute("INSERT INTO files_run_job VALUES('run','completed')")
        self.assertEqual(db.execute(query, args).fetchone(), ('finished', None, 1))
        db.execute("INSERT INTO files_job VALUES('pending','peer','paused')")
        db.execute("INSERT INTO files_run_job VALUES('run','pending')")
        self.assertEqual(db.execute(query, args).fetchone(), ('finished', None, 0))
        db.execute("UPDATE files_job SET state='completed' WHERE id='pending'")
        self.assertEqual(db.execute(query, args).fetchone(), ('finished', None, 1))
        db.execute("INSERT INTO files_job VALUES('other','other-peer','completed')")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO files_run_job VALUES('run','other')")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("UPDATE files_run_job SET job_id='other'")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("DELETE FROM files_run_job WHERE job_id='pending'")
        db.execute("INSERT INTO owner_deleted VALUES('completed')")
        self.assertEqual(db.execute(query, args).fetchone(), ('finished', None, 0))
        for record, binding in (('other-peer', 'binding'), ('peer', 'old-binding')):
            self.assertIsNone(db.execute(query, ('run', record, binding)).fetchone())
        for phase, error in (('failed', 'denied'), ('needs_attention', 'source_changed'), ('finished', 'denied')):
            db.execute('UPDATE files_run SET state=?,error_code=?', (phase, error))
            state, code, completed = db.execute(query, args).fetchone()
            self.assertFalse(state == 'finished' and code is None and completed == 1)
        for phase in ('running', 'paused', 'retry_wait'):
            db.execute('UPDATE files_run SET state=?', (phase,))
            self.assertIsNone(db.execute(query, args).fetchone())

    def test_crash_after_linked_run_completion_reconciles_in_a_new_process_without_new_run(self):
        with tempfile.TemporaryDirectory(prefix='kloda-occurrence-linked-') as directory:
            path = str(Path(directory) / 'journal.sqlite')
            db = sqlite3.connect(path); self.create(db); self.insert(db)
            db.executescript("""CREATE TABLE files_run(id PRIMARY KEY,record_id,context_binding,state,error_code);
              CREATE TABLE files_job(id PRIMARY KEY,record_id,state);
              CREATE TABLE owner_deleted(job PRIMARY KEY);
              INSERT INTO files_run VALUES('run-A','peer','binding','finished',NULL);
              INSERT INTO files_job VALUES('receipt','peer','completed');
              INSERT INTO files_run_job VALUES('run-A','receipt');""")
            self.save(db, run='run-A'); db.commit(); db.close()
            child = """import sqlite3,json,sys,runpy
sql=runpy.run_path(sys.argv[2])['sql']
db=sqlite3.connect(sys.argv[1])
old=db.execute("SELECT os_attempts,phase,run_id FROM scheduled_occurrence WHERE id='occ'").fetchone()
state,error,completed=db.execute(sql('SELECT r.state,r.error_code,'),(old[2],'peer','binding')).fetchone()
verified=state=='finished' and error is None and completed==1
changed=db.execute(sql('UPDATE scheduled_occurrence SET os_attempts='),(old[0],int(verified),'finished',None,None,None,old[2],error,'occ',old[0],old[1])).rowcount
assert changed==1
db.commit()
print(json.dumps([db.execute('SELECT os_attempts,updated,phase,run_id FROM scheduled_occurrence').fetchone(),db.execute('SELECT count(*) FROM files_run').fetchone(),db.execute('SELECT * FROM files_job').fetchall()]))
"""
            result = subprocess.check_output(['python3', '-c', child, path, str(Path(__file__).resolve())], text=True)
            self.assertEqual(json.loads(result), [[1, 1, 'finished', 'run-A'], [1], [['receipt', 'peer', 'completed']]])

    def test_actual_kotlin_clock_pause_and_interruption_model(self):
        cache = Path.home() / '.gradle/caches/modules-2/files-2.1'
        jars = [str(p) for group in ('org.jetbrains.kotlin', 'org.jetbrains.kotlinx', 'org.jetbrains.intellij.deps', 'org.jetbrains')
                for p in (cache / group).rglob('*.jar') if ('2.1.20' in str(p) or 'kotlinx-coroutines-core-jvm' in str(p)
                    or 'trove4j' in str(p) or 'annotations' in str(p))]
        stdlib = next(p for p in jars if p.endswith('/kotlin-stdlib-2.1.20.jar'))
        with tempfile.TemporaryDirectory(prefix='kloda-occurrence-model-') as directory:
            path = Path(directory); checks = path / 'checks.kt'
            checks.write_text('''package com.kloda.sync
fun main() {
  val initial = ScheduledOccurrence("id","binding","peer",1000)
  check(initial.updated == 0 && initial.osAttempts == 1)
  var current = initial
  repeat(4) { index ->
    val waiting = current.stopped(1000,5000,7,false,"os_interrupted")
    check(waiting.phase == "waiting" && waiting.osAttempts == index + 1)
    check(!waiting.due(304999,7))
    // Both forward and backward wall-clock changes leave the elapsed deadline authoritative.
    check(waiting.copy(retryAt = Long.MAX_VALUE).due(305000,7))
    check(!waiting.copy(retryAt = 0).due(304999,7))
    check(!waiting.due(305000,8))
    check(!waiting.due(Long.MAX_VALUE,null))
    check(waiting.due(305000,7))
    current = waiting.claimed()
    check(current.osAttempts == index + 2 && current.runId == null && current.updated == 0)
  }
  check(current.stopped(1000,5000,7,false,null).phase == "exhausted")
  val paused = initial.stopped(1000,5000,7,true,null)
  check(paused.phase == "paused" && paused.osAttempts == 1 && paused.updated == 0)
  check(paused.stopped(1000,5000,7,false,null) == paused)
  check(initial.stopped(1000,5000,null,false,null).error == "retry_clock_unavailable")
  val rebooted = initial.waiting(0,0,8,"os_interrupted")
  check(!rebooted.due(299999,8) && rebooted.due(300000,8))
  var overflow = false
  try { initial.waiting(Long.MAX_VALUE,0,7,null) } catch (_: ArithmeticException) { overflow = true }
  check(overflow)
  println("Actual Kotlin occurrence model PASS: 5-attempt OS cap, monotonic+boot deadline with wall-clock changes, pause, unknown clock, overflow")
}
''')
            doubles = path / 'doubles.kt'
            doubles.write_text('''package com.kloda.sync
internal class AndroidSyncJournal { val readableDatabase: android.database.sqlite.SQLiteDatabase get() = TODO(); val writableDatabase: android.database.sqlite.SQLiteDatabase get() = TODO() }
internal object AndroidFilesSnapshots { fun randomId(): String = "fixture" }
internal class FilesFailure(code: String): RuntimeException(code)
''')
            android_jar = str(Path.home() / 'Library/Android/sdk/platforms/android-36/android.jar')
            subprocess.run(['java', '-cp', os.pathsep.join(jars), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
                '-no-stdlib', '-no-reflect', '-classpath', stdlib + os.pathsep + android_jar, '-d', str(path / 'classes'),
                str(BASE / 'ScheduledOccurrence.kt'), str(BASE / 'AndroidScheduleJournal.kt'), str(doubles), str(checks)], check=True)
            subprocess.run(['java', '-cp', str(path / 'classes') + os.pathsep + stdlib, 'com.kloda.sync.ChecksKt'], check=True)


if __name__ == '__main__':
    unittest.main()
