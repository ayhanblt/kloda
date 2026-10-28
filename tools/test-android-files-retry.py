"""Run production retry SQL on disposable SQLite; not Android runtime acceptance."""
import re
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NATIVE = ROOT / "apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync"
SOURCE = (NATIVE / "AndroidFilesRunJournal.kt").read_text()
JOURNAL = (NATIVE / "AndroidSyncJournal.kt").read_text()


def statement(prefix, source=SOURCE):
    strings = re.findall(r'"""(.*?)"""|"([^"\n]+)"', source, re.S)
    return next(a or b for a, b in strings if (a or b).startswith(prefix))


def file_schema(db):
    start = JOURNAL.index("private fun createTransfers")
    end = JOURNAL.index("fun reconcileSourceFiles", start)
    for a, b in re.findall(r'execSQL\((?:"""(.*?)"""|"([^"\n]+)")', JOURNAL[start:end], re.S):
        db.execute(a or b)


class RetrySqlChecks(unittest.TestCase):
    def test_disposable_reopen_and_receipt_preservation(self):
        with tempfile.TemporaryDirectory(prefix="kloda-retry-") as scratch:
            path = Path(scratch) / "journal.sqlite"
            db = sqlite3.connect(path)
            # Exact production files schema/triggers and owner-deletion table survive v3 -> v4.
            file_schema(db)
            db.execute("INSERT INTO files_job VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                       ("file", "peer", "source", "uri", "tree", "name", "wire", "hash", 4, "op", 4, "completed", None, ""))
            db.execute("INSERT INTO owner_deleted VALUES ('file')")
            receipt = db.execute("SELECT * FROM files_job").fetchall()
            db.execute(statement("CREATE TABLE files_run"))
            db.execute(statement("CREATE TRIGGER immutable_files_run"))
            db.execute(statement("INSERT INTO files_run("), ("run", "peer", None, "binding"))
            db.execute(statement("UPDATE files_run SET state=?,retry_at=?"), ("retry_wait", 61000, "connection_closed", 90000, 7, "run"))
            db.execute(statement("UPDATE files_run SET state=?,error_code=?"), ("paused", "paused", "run"))
            db.execute(statement("INSERT INTO files_run("), ("other-run", "other-peer", None, "binding"))
            db.execute(statement("UPDATE files_run SET activation="), ("run",))
            self.assertEqual(db.execute("SELECT id FROM files_run ORDER BY activation DESC LIMIT 1").fetchone(), ("run",))
            db.commit()
            db.close()

            db = sqlite3.connect(path)
            self.assertEqual(db.execute("SELECT attempts,retry_at,state FROM files_run WHERE id='run'").fetchone(), (1, 61000, "paused"))
            db.execute(statement("UPDATE files_run SET state='running'"), (2, "run"))
            self.assertEqual(db.execute("SELECT attempts,retry_at,state FROM files_run WHERE id='run'").fetchone(), (2, None, "running"))
            for attempt in (0, 6):
                with self.assertRaises(sqlite3.IntegrityError):
                    db.execute("UPDATE files_run SET attempts=?", (attempt,))
            self.assertEqual(db.execute("SELECT * FROM files_job").fetchall(), receipt)
            self.assertEqual(db.execute("SELECT job FROM owner_deleted").fetchall(), [("file",)])
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("UPDATE files_job SET state='queued'")
            db.execute(statement("UPDATE files_run SET state=?,retry_at=?"), ("retry_wait", 121000, "connection_closed", 150000, 7, "run"))
            db.execute(statement("UPDATE files_run SET state=?,error_code=?,retry_at=NULL"), ("failed", "queue_unavailable", "run"))
            self.assertEqual(db.execute("SELECT state,retry_at,retry_elapsed,retry_boot FROM files_run WHERE id='run'").fetchone(), ("failed", None, None, None))
            db.close()

    def test_deleted_version_survives_process_reopen_without_hiding_other_sources(self):
        with tempfile.TemporaryDirectory(prefix="kloda-suppression-") as scratch:
            path = Path(scratch) / "journal.sqlite"
            db = sqlite3.connect(path)
            file_schema(db)
            insert = "INSERT INTO files_job VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            receipt = ("old", "peer", "source", "uri", "tree", "name", "wire", "hash", 4, "old-op", 4, "completed", None, "")
            db.execute(insert, receipt)
            mark = statement("INSERT OR IGNORE INTO owner_deleted(job)", JOURNAL)
            db.execute(mark, ("old",)); db.execute(mark, ("old",))
            version = statement("SELECT * FROM files_job WHERE record_id=? AND reference=?", JOURNAL)
            exact = ("peer", "uri", "tree", "name", "hash", "4")
            self.assertEqual(db.execute(version, exact).fetchone(), receipt)
            # Changed content and an unrelated source with equal bytes have no prior version.
            self.assertIsNone(db.execute(version, ("peer", "uri", "tree", "name", "changed", "4")).fetchone())
            self.assertIsNone(db.execute(version, ("peer", "other-uri", "tree", "name", "hash", "4")).fetchone())
            changed = ("changed", *receipt[1:7], "changed", 4, None, 0, "queued", None, "")
            unrelated = ("unrelated", "peer", "source", "other-uri", *receipt[4:9], None, 0, "queued", None, "")
            db.execute(insert, changed); db.execute(insert, unrelated)
            pending_deleted = ("pending-deleted", "peer", "source", "pending-uri", *receipt[4:9], None, 0, "paused", None, "")
            db.execute(insert, pending_deleted); db.execute(mark, ("pending-deleted",))
            jobs = statement("SELECT * FROM files_job WHERE record_id=? AND source_id=? AND state!='completed'", JOURNAL)
            queries = [(version, exact), (jobs, ("peer", "source", "")), ("SELECT job FROM owner_deleted ORDER BY job", ())]
            db.commit(); db.close()
            # A distinct read-only process observes committed SQL state, not an in-memory replay.
            child = """import json,sqlite3,sys
from pathlib import Path
db=sqlite3.connect(Path(sys.argv[1]).as_uri()+'?mode=ro',uri=True)
print(json.dumps([db.execute(sql,args).fetchall() for sql,args in json.loads(sys.argv[2])]))
db.close()
"""
            reopened = json.loads(subprocess.check_output([sys.executable, "-c", child, str(path), json.dumps(queries)], text=True))
            self.assertEqual(reopened[0], [list(receipt)])
            self.assertEqual([row[0] for row in reopened[1]], ["changed", "unrelated"])
            self.assertEqual(reopened[2], [["old"], ["pending-deleted"]])

    def test_explicit_rebackup_keeps_old_receipt_and_one_recoverable_intent(self):
        with tempfile.TemporaryDirectory(prefix="kloda-rebackup-") as scratch:
            path = Path(scratch) / "journal.sqlite"
            db = sqlite3.connect(path); file_schema(db)
            insert = "INSERT INTO files_job VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            receipt = ("old", "peer", "source", "uri", "tree", "name", "wire", "hash", 4, "old-op", 4, "completed", None, "")
            db.execute(insert, receipt)
            db.execute(statement("INSERT OR IGNORE INTO owner_deleted(job)", JOURNAL), ("old",))
            # Fixture input follows the existing caller's new request linked to the old operation.
            intent = ("explicit", *receipt[1:9], "new-op", 2, "paused", None, "old-op")
            db.execute(insert, intent)
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(insert, ("duplicate", *intent[1:]))
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("UPDATE files_job SET state='queued' WHERE id='old'")
            db.commit(); db.close()
            db = sqlite3.connect(path)
            version = statement("SELECT * FROM files_job WHERE record_id=? AND reference=?", JOURNAL)
            self.assertEqual(db.execute(version, ("peer", "uri", "tree", "name", "hash", "4")).fetchone(), intent)
            jobs = statement("SELECT * FROM files_job WHERE record_id=? AND source_id=? AND state!='completed'", JOURNAL)
            self.assertEqual(db.execute(jobs, ("peer", "source", "")).fetchall(), [intent])
            self.assertEqual(db.execute("SELECT * FROM files_job WHERE id='old'").fetchone(), receipt)
            self.assertEqual(db.execute("SELECT job FROM owner_deleted").fetchall(), [("old",)])
            self.assertEqual(db.execute("SELECT COUNT(*) FROM files_job WHERE rebackup_of='old-op'").fetchone(), (1,))
            db.close()


    def test_v4_context_migration_stale_results_and_other_target(self):
        with tempfile.TemporaryDirectory(prefix="kloda-run-context-") as scratch:
            path = Path(scratch) / "journal.sqlite"
            db = sqlite3.connect(path)
            db.execute(statement("CREATE TABLE files_run").replace(", context_binding TEXT", ""))
            db.execute("INSERT INTO files_run VALUES ('legacy','peer',NULL,3,'retry_wait',61000,'connection_closed',90000,7,1)")
            db.execute(statement("ALTER TABLE files_run"))
            db.execute(statement("CREATE TRIGGER immutable_files_run"))
            invalidate = statement("UPDATE files_run SET state='failed'")
            db.execute(invalidate, ("context-a", None, None))
            self.assertEqual(db.execute("SELECT state,error_code,attempts,retry_at FROM files_run").fetchone(),
                             ("failed", "settings_changed", 3, None))
            insert = statement("INSERT INTO files_run(")
            db.execute(insert, ("new", "peer", None, "context-a"))
            db.execute(statement("UPDATE files_run SET state=?,retry_at=?"),
                       ("retry_wait", 61000, "connection_closed", 90000, 7, "new"))
            db.commit(); db.close()
            db = sqlite3.connect(path)
            self.assertEqual(db.execute("SELECT context_binding,attempts,retry_at FROM files_run WHERE id='new'").fetchone(),
                             ("context-a", 1, 61000))
            db.execute(invalidate, ("context-a", None, None))
            self.assertEqual(db.execute("SELECT state FROM files_run WHERE id='new'").fetchone(), ("retry_wait",))
            # Changing context, then returning to old values, cannot resurrect the old run.
            db.execute(invalidate, ("context-b", None, None))
            db.execute(invalidate, ("context-a", None, None))
            db.execute(statement("UPDATE files_run SET state=?,error_code=? WHERE"), ("paused", "paused", "new"))
            db.execute(statement("UPDATE files_run SET state=?,error_code=?,retry_at=NULL"), ("finished", None, "new"))
            self.assertEqual(db.execute("SELECT state,error_code,retry_at FROM files_run WHERE id='new'").fetchone(),
                             ("failed", "settings_changed", None))
            self.assertEqual(db.execute(statement("UPDATE files_run SET state='running'"), (2, "new")).rowcount, 0)
            for column in ("record_id", "context_binding", "rebackup"):
                with self.assertRaises(sqlite3.IntegrityError):
                    db.execute(f"UPDATE files_run SET {column}='replacement' WHERE id='new'")
            db.execute(insert, ("target-a", "peer", None, "context-b"))
            db.execute(insert, ("target-b", "other-peer", None, "context-b"))
            db.execute(invalidate, ("context-b", "other-peer", "other-peer"))
            self.assertEqual(db.execute("SELECT state FROM files_run WHERE id='target-a'").fetchone(), ("failed",))
            self.assertEqual(db.execute("SELECT state,attempts FROM files_run WHERE id='target-b'").fetchone(), ("running", 1))
            db.close()



if __name__ == "__main__":
    unittest.main()
