"""Synthetic query/metadata costs using actual scanner and membership SQL; no device/archive."""
import json
from pathlib import Path
import runpy
import sqlite3
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def scanner_cost():
    harness = runpy.run_path(str(ROOT / 'tools/test-android-saf.py'))
    stubs = harness['STUBS']
    stubs['cursor.kt'] = stubs['cursor.kt'].replace(
        'private var index = -1', 'companion object { var visits = 0L }; private var index = -1').replace(
        'fun moveToNext() = (++index < rows.size)', 'fun moveToNext(): Boolean { visits++; return ++index < rows.size }')
    prelude = stubs['checks.kt'].split('fun main() {')[0]
    stubs['checks.kt'] = prelude + '''fun main() {
      for (sdk in listOf(24, 29)) for (count in listOf(128, 1024, 8000)) {
        Build.VERSION.SDK_INT = sdk
        val r = resolver().apply {
          children.clear(); children["root-1"] = (1..count).map { row("opaque-$it") }
          authoritativeChild = true
        }
        android.database.Cursor.visits = 0
        val found = AndroidSafSourceScanner(r).scan(tree).count()
        check(found == count)
        println("Scanner sdk=$sdk files=$count queries=${r.queried} cursorVisits=${android.database.Cursor.visits} membershipCalls=${r.authoritativeCalls}")
      }
    }
    '''
    harness['main']()


def membership_cost():
    production = runpy.run_path(str(ROOT / 'tools/test-android-schedule.py'))
    statement = production['sql']
    with tempfile.TemporaryDirectory(prefix='kloda-membership-cost-') as directory:
        path = Path(directory) / 'journal.sqlite'
        db = sqlite3.connect(path)
        db.executescript('CREATE TABLE files_run(id TEXT PRIMARY KEY,record_id TEXT);'
                         'CREATE TABLE files_job(id TEXT PRIMARY KEY,record_id TEXT);')
        db.executemany('INSERT INTO files_job VALUES(?,?)', ((f'{i:032x}', 'peer') for i in range(8000)))
        for prefix in ('CREATE TABLE files_run_job', 'CREATE TRIGGER validate_files_run_job',
                       'CREATE TRIGGER immutable_files_run_job', 'CREATE TRIGGER retain_files_run_job'):
            db.execute(statement(prefix))
        db.commit()
        baseline = path.stat().st_size
        for run in range(1, 13):
            run_id = f'{run:032x}'
            db.execute('INSERT INTO files_run VALUES(?,?)', (run_id, 'peer'))
            db.execute('INSERT INTO files_run_job SELECT ?,id FROM files_job', (run_id,))
            db.commit()
            if run in (1, 4, 12):
                rows = db.execute('SELECT count(*) FROM files_run_job').fetchone()[0]
                assert rows == 8000 * run
                print(json.dumps({'files': 8000, 'runs': run, 'membershipRows': rows,
                                  'sqliteBytes': path.stat().st_size, 'growthBytes': path.stat().st_size - baseline}))
        db.close()


if __name__ == '__main__':
    scanner_cost()
    membership_cost()
