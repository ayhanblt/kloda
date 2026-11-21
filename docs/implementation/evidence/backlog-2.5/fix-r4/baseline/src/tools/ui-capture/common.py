"""Run ownership, atomic records, supervised processes and the single result protocol.

A run directory is created exclusively (never clobbered); `run.json` is the only durable
record and is read and written only while holding `run.lock`, which the per-run supervisor
holds for the whole run. Process ownership and signalling rules live in `supervision.py`.
"""
import fcntl
import hashlib
import http.server
import json
import os
import secrets
import subprocess
import threading
import time
import uuid
import zlib
from pathlib import Path

from supervision import critical

PHASES = ('PREPARED', 'CREATING', 'CREATED', 'RUNNING', 'RESTORE_PENDING', 'CLEANED')
EXIT_CODES = {'PASS': 0, 'FAIL': 1, 'BLOCKED': 2, 'CLEANUP_FAILED': 3, 'USAGE': 4}
RECORD, LOCK = 'run.json', 'run.lock'
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
PNG_CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
PNG_DEPTHS = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}


class CaptureError(RuntimeError):
    """A run cannot proceed safely; the message is diagnostic and secret-free."""


def atomic_write_json(path, data):
    path = Path(path)
    tmp = path.with_name(f'.{path.name}.{secrets.token_hex(6)}.tmp')
    with critical():
        with open(tmp, 'x', encoding='utf-8') as handle:
            json.dump(data, handle, indent=1, sort_keys=True, ensure_ascii=False)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 16), b''):
            digest.update(block)
    return digest.hexdigest()


def _png_chunks(data):
    """[(kind, body)] with every CRC verified and no truncation or trailing bytes, else None."""
    pos, chunks = 8, []
    while pos + 12 <= len(data):
        length, kind = int.from_bytes(data[pos:pos + 4], 'big'), data[pos + 4:pos + 8]
        body, crc = data[pos + 8:pos + 8 + length], data[pos + 8 + length:pos + 12 + length]
        if len(body) != length or zlib.crc32(kind + body).to_bytes(4, 'big') != crc:
            return None
        chunks.append((kind, body))
        pos += 12 + length
        if kind == b'IEND':
            break
    return chunks if pos == len(data) and chunks and chunks[-1] == (b'IEND', b'') else None


def _png_layout_ok(kinds, color):
    """Chunk order rules: one IHDR first, one empty IEND last, contiguous IDAT, no unknown critical chunk,
    PLTE once before IDAT (required for palette images, forbidden for grayscale)."""
    idat = [i for i, kind in enumerate(kinds) if kind == b'IDAT']
    critical = [kind for kind in kinds if kind[:1].isupper() and kind not in (b'IHDR', b'PLTE', b'IDAT', b'IEND')]
    plte = [i for i, kind in enumerate(kinds) if kind == b'PLTE']
    return (kinds[0] == b'IHDR' and kinds.count(b'IHDR') == 1 and kinds.count(b'IEND') == 1 and idat
            and idat == list(range(idat[0], idat[-1] + 1)) and not critical and len(plte) <= 1
            and (color != 3 or plte) and (color not in (0, 4) or not plte) and all(i < idat[0] for i in plte))


def png_info(path):
    """(width, height) only for a complete, well-formed PNG whose pixel data matches its header."""
    try:
        data = Path(path).read_bytes()
    except OSError:
        return None
    chunks = _png_chunks(data) if data[:8] == PNG_SIGNATURE else None
    if not chunks or chunks[0][0] != b'IHDR' or len(chunks[0][1]) != 13:
        return None
    ihdr, kinds = chunks[0][1], [kind for kind, _ in chunks]
    width, height, depth, color = int.from_bytes(ihdr[:4], 'big'), int.from_bytes(ihdr[4:8], 'big'), ihdr[8], ihdr[9]
    if not _png_layout_ok(kinds, color) or not width or not height or depth not in PNG_DEPTHS.get(color, ()) or any(ihdr[10:13]):
        return None
    plte = next((body for kind, body in chunks if kind == b'PLTE'), b'')
    if plte and (len(plte) % 3 or len(plte) > 768):
        return None
    try:
        raw = zlib.decompress(b''.join(body for kind, body in chunks if kind == b'IDAT'))
    except zlib.error:
        return None
    stride = 1 + (width * PNG_CHANNELS[color] * depth + 7) // 8
    if len(raw) != stride * height or any(raw[row * stride] > 4 for row in range(height)):
        return None  # every scanline must start with a defined filter type (0-4)
    return width, height


class Run:
    """Exclusive, locked ownership of one run directory and its recorded resources."""

    def __init__(self, root, record, lock_handle):
        self.root, self.record, self._lock, self.live = root, record, lock_handle, {}

    @classmethod
    def create(cls, out, driver, selection):
        out = Path(out)
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            out.mkdir()
        except FileExistsError:
            raise CaptureError(f'output exists; refusing to overwrite: {out}') from None
        root = out.resolve(strict=True)
        lock = cls._acquire(root)
        record = {'runID': uuid.uuid4().hex, 'root': str(root), 'driver': driver,
                  'selection': selection, 'phase': 'PREPARED', 'events': [],
                  'processes': [], 'simulator': None, 'settings': {}, 'cells': {},
                  'cleanup': {'steps': [], 'errors': []}, 'provenance': {}}
        run = cls(root, record, lock)
        run.event('PREPARED')
        return run

    @classmethod
    def open(cls, out, lock_fd=None):
        """Lock first, then read: the record is never acted on from a pre-lock snapshot."""
        root = Path(out).resolve(strict=True)
        if lock_fd is None:
            lock = cls._acquire(root)
        else:
            lock = os.fdopen(lock_fd, 'a+', encoding='utf-8')
            if os.fstat(lock.fileno()).st_ino != (root / LOCK).stat().st_ino:
                lock.close()
                raise CaptureError('inherited lock does not belong to this run')
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            record = json.loads((root / RECORD).read_text(encoding='utf-8'))
        except (OSError, ValueError):
            lock.close()
            raise CaptureError('run record unreadable') from None
        if record.get('root') != str(root):
            lock.close()
            raise CaptureError('run record root does not match its directory')
        return cls(root, record, lock)

    @staticmethod
    def _acquire(root):
        handle = open(root / LOCK, 'a+', encoding='utf-8')
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            handle.close()
            raise CaptureError('run is locked by a live capture supervisor') from None
        return handle

    def lock_fileno(self):
        return self._lock.fileno()

    def close(self):
        self._lock.close()

    def save(self):
        atomic_write_json(self.root / RECORD, self.record)

    def event(self, name, **data):
        self.record['events'].append({'at': time.time(), 'event': name, **data})
        self.save()

    def advance(self, phase):
        current, target = PHASES.index(self.record['phase']), PHASES.index(phase)
        if target < current or (phase == 'CLEANED' and self.record['cleanup']['errors']):
            raise CaptureError(f'invalid phase transition {self.record["phase"]} -> {phase}')
        self.record['phase'] = phase
        self.event(phase)

    def set_cell(self, cell_id, status, **data):
        self.record['cells'][cell_id] = {'status': status, **data}
        self.save()

    def path(self, name):
        """A path for a new artifact strictly inside this run root (no symlink escape)."""
        candidate = (self.root / name).resolve()
        if self.root not in candidate.parents:
            raise CaptureError(f'artifact path escapes run root: {name}')
        candidate.parent.mkdir(parents=True, exist_ok=True)
        if candidate.exists():
            raise CaptureError(f'artifact exists; refusing to overwrite: {name}')
        return candidate

    def artifact_problems(self, cell):
        """A recorded PNG is reusable only as a plain file in the run root with equal digest/size."""
        name = cell.get('png') or ''
        path = self.root / name
        if not name or '/' in name or path.is_symlink() or path.resolve().parent != self.root:
            return ['png outside run root']
        if not path.is_file() or sha256_file(path) != cell.get('pngSha256'):
            return ['png missing or digest changed']
        size = png_info(path)
        return [] if size and list(size) == list(cell.get('pngSize') or []) else ['png invalid or size changed']

    def track(self, role):
        """Record a driver-managed resource (closed by its driver) before it is launched."""
        entry = {'role': role, 'pid': None, 'pgid': None, 'state': 'launching', 'closeBy': 'driver'}
        self.record['processes'].append(entry)
        self.save()
        return entry

    def spawn(self, role, argv, **kwargs):
        """Intent is durable before launch; the live handle is kept unreaped for signalling."""
        entry = {'role': role, 'pid': None, 'pgid': None, 'state': 'launching'}
        with critical():
            self.record['processes'].append(entry)
            self.save()
            proc = subprocess.Popen(argv, start_new_session=True, **kwargs)
            self.live[proc.pid] = proc
            entry.update(pid=proc.pid, pgid=proc.pid, state='running')
            self.event('spawned', role=role, pid=proc.pid)
        return proc

    def begin_cleanup(self):
        """A fresh attempt re-verifies every resource; earlier attempts stay as history."""
        cleanup = self.record['cleanup']
        if cleanup['steps']:
            cleanup.setdefault('attempts', []).append({'steps': cleanup['steps'], 'errors': cleanup['errors']})
        cleanup['steps'], cleanup['errors'] = [], []
        if self.record['phase'] != 'CLEANED':
            self.record['phase'] = 'RESTORE_PENDING'
        self.event('RESTORE_PENDING')

    def cleanup_step(self, name, ok, detail=None):
        entry = {'step': name, 'ok': bool(ok)}
        if detail:
            entry['detail'] = str(detail)[:500]
        self.record['cleanup']['steps'].append(entry)
        if not ok:
            self.record['cleanup']['errors'].append(entry)
        self.save()
        return bool(ok)


def new_phase(run_id, index, cell, extra=None):
    return {'runID': run_id, 'phase': index, 'nonce': secrets.token_hex(16), **cell, **(extra or {})}


def match_report(expected, report):
    """A report is current only when runID, phase index and nonce all equal the live phase."""
    if not isinstance(report, dict) or expected is None:
        return False
    return all(report.get(key) == expected.get(key) for key in ('runID', 'phase', 'nonce'))


REPORT_KEYS = frozenset(('runID', 'phase', 'nonce', 'probe', 'screen', 'language', 'themeMode', 'fontScale',
                         'fontsLoaded', 'fontError', 'appState', 'layoutReady', 'width', 'height'))
MAX_REPORT_BYTES = 8192


class PhaseServer:
    """Loopback rendezvous: serves the live phase; keeps only reports for that exact phase.

    Each phase carries a probe token. `reprobe()` replaces it after a screenshot; a report that
    echoes the new token was measured from a phase fetched after the screenshot finished, so a
    delayed earlier report of the same phase can never stand in for it."""

    def __init__(self):
        self._lock = threading.Lock()
        self._phase, self.reports, self.stale = None, [], 0
        owner = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def _reply(self, code, body=b'{}'):
                self.send_response(code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                if self.path != '/phase':
                    return self._reply(404)
                with owner._lock:
                    body = json.dumps(owner._phase or {}).encode()
                return self._reply(200, body)

            def do_POST(self):
                length = int(self.headers.get('Content-Length') or 0)
                if self.path != '/report' or not 0 < length <= MAX_REPORT_BYTES:
                    return self._reply(400)
                try:
                    report = json.loads(self.rfile.read(length))
                except ValueError:
                    return self._reply(400)
                owner.offer(report)
                return self._reply(200)

        self._server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.port = self._server.server_address[1]
        threading.Thread(target=self._server.serve_forever, daemon=True).start()

    def offer(self, report):
        with self._lock:
            valid = isinstance(report, dict) and set(report) == REPORT_KEYS and isinstance(report['probe'], str)
            if valid and match_report(self._phase, report):
                self.reports.append(report)
            else:
                self.stale += 1

    def announce(self, phase):
        with self._lock:
            self._phase = phase and {**phase, 'probe': secrets.token_hex(16)}
            self.reports = []
            return self._phase and self._phase['probe']

    def reprobe(self):
        with self._lock:
            self._phase = {**self._phase, 'probe': secrets.token_hex(16)}
            return self._phase['probe']

    def latest(self, probe=None):
        with self._lock:
            found = [r for r in self.reports if probe is None or r['probe'] == probe]
            return found[-1] if found else None

    def close(self):
        self.announce(None)
        self._server.shutdown()
        self._server.server_close()


def confirmed(record):
    """The supervisor's result counts only after the CLI that waited for that exact supervisor exit
    wrote run ID + result generation + the matching exit code (cleanup/resume can never write it)."""
    final, proof = record.get('finalization') or {}, record.get('confirmation') or {}
    return bool(final) and final.get('result') == record.get('result') and proof == {
        'runID': record.get('runID'), 'gen': final.get('gen'), 'exit': EXIT_CODES.get(final.get('result'))}


def final_status(record):
    """Single result protocol: cleanup failure > interrupted/unconfirmed/run error/FAIL > BLOCKED > PASS."""
    if record['cleanup']['errors'] or record['phase'] != 'CLEANED':
        return 'CLEANUP_FAILED'
    if record.get('interrupted') or record.get('runError') or record.get('unconfirmed'):
        return 'FAIL'
    wanted = record['selection'].get('cells', [])
    statuses = [record['cells'].get(cell, {}).get('status', 'FAIL') for cell in wanted]
    if not statuses or 'FAIL' in statuses:
        return 'FAIL'
    if 'BLOCKED' in statuses:
        return 'BLOCKED'
    return 'PASS' if all(status in ('PASS', 'REUSED') for status in statuses) else 'FAIL'
