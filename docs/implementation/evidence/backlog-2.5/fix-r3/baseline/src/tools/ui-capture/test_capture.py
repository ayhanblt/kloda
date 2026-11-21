"""Device-free tests for the capture runner lifecycle, ownership, outputs and result protocol."""
import sys

sys.dont_write_bytecode = True

import hashlib  # noqa: E402
import http.server  # noqa: E402
import inspect  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import signal  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402
import threading  # noqa: E402
import time  # noqa: E402
import unittest  # noqa: E402
import urllib.request  # noqa: E402
import zlib  # noqa: E402
from pathlib import Path  # noqa: E402
from types import SimpleNamespace  # noqa: E402

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

import common  # noqa: E402
import desktop  # noqa: E402
import ios  # noqa: E402
import ios_build  # noqa: E402



def _cell(locale='tr', theme='light', size='normal'):
    return SimpleNamespace(locale=locale, theme=theme, size=size, id=f'x/{locale}/{theme}/{size}')


def _png(width=4, height=3, trailing=b'', filter_byte=0):
    def chunk(kind, body):
        return len(body).to_bytes(4, 'big') + kind + body + zlib.crc32(kind + body).to_bytes(4, 'big')
    ihdr = width.to_bytes(4, 'big') + height.to_bytes(4, 'big') + bytes([8, 6, 0, 0, 0])
    raw = zlib.compress(b''.join(bytes([filter_byte]) + b'\x80' * width * 4 for _ in range(height)))
    return common.PNG_SIGNATURE + chunk(b'IHDR', ihdr) + chunk(b'IDAT', raw) + chunk(b'IEND', b'') + trailing


class Tmp(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.out = self.dir / 'run'
        self.run = common.Run.create(self.out, 'ios-native-entry', {'cells': ['a/tr/light/normal'], 'args': {}})
        self.procs = []

    def tearDown(self):
        for proc in self.procs:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass
            proc.wait()
        self.run.close()
        self.tmp.cleanup()

    def record(self, **changes):
        self.run.record.update(changes)
        self.run.save()
        self.run.close()


class RunTests(Tmp):
    def test_no_clobber_and_lock(self):
        with self.assertRaises(common.CaptureError):
            common.Run.create(self.out, 'x', {'cells': []})
        with self.assertRaises(common.CaptureError):
            common.Run.open(self.out)

    def test_open_reads_after_lock(self):
        self.run.close()
        original = common.Run._acquire

        def racing(root):  # another cleanup finishes just before this one gets the lock
            data = json.loads((root / common.RECORD).read_text())
            common.atomic_write_json(root / common.RECORD, {**data, 'phase': 'CLEANED'})
            return original(root)
        common.Run._acquire = staticmethod(racing)
        try:
            self.run = common.Run.open(self.out)
        finally:
            common.Run._acquire = staticmethod(original)
        self.assertEqual(self.run.record['phase'], 'CLEANED')

    def test_phase_rules_and_retry(self):
        self.run.advance('RUNNING')
        with self.assertRaises(common.CaptureError):
            self.run.advance('CREATED')
        self.run.begin_cleanup()
        self.run.cleanup_step('s', False, 'boom')
        with self.assertRaises(common.CaptureError):
            self.run.advance('CLEANED')
        self.run.begin_cleanup()
        self.assertEqual(self.run.record['cleanup']['attempts'][0]['errors'][0]['step'], 's')
        self.run.advance('CLEANED')

    def test_paths_and_artifacts(self):
        with self.assertRaises(common.CaptureError):
            self.run.path('../outside.png')
        os.symlink(self.tmp.name, self.out / 'link')
        with self.assertRaises(common.CaptureError):
            self.run.path('link/escape.png')
        target = self.run.path('a.png')
        target.write_bytes(_png())
        with self.assertRaises(common.CaptureError):
            self.run.path('a.png')
        good = {'png': 'a.png', 'pngSha256': common.sha256_file(target), 'pngSize': [4, 3]}
        self.assertEqual(self.run.artifact_problems(good), [])
        for bad in ({'png': 'link/a.png'}, {'png': '../run/a.png'}, {'pngSha256': 'x'}, {'pngSize': [4, 4]}):
            self.assertTrue(self.run.artifact_problems({**good, **bad}), bad)


class PngTests(unittest.TestCase):
    def test_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'p.png'
            for data, want in ((_png(), (4, 3)), (_png()[:40], None), (_png(trailing=b'x'), None),
                               (_png()[:24] + b'\0' * 30, None), (b'\x89PNG\r\n\x1a\n' + b'\0' * 16, None)):
                path.write_bytes(data)
                self.assertEqual(common.png_info(path), want)
            for ihdr_byte, value in ((24, 3), (26, 1)):  # depth 3 for RGBA, filter method 1
                patched = bytearray(_png())
                patched[ihdr_byte] = value
                patched[29:33] = zlib.crc32(bytes(patched[12:29])).to_bytes(4, 'big')
                path.write_bytes(bytes(patched))
                self.assertIsNone(common.png_info(path), ihdr_byte)
            path.write_bytes(_png(filter_byte=255))
            self.assertIsNone(common.png_info(path))
            broken = bytearray(_png())
            broken[40] ^= 1
            path.write_bytes(bytes(broken))
            self.assertIsNone(common.png_info(path))


class StatusTests(unittest.TestCase):
    def record(self, phase='CLEANED', errors=(), cells=None, wanted=('a', 'b'), **extra):
        return {'phase': phase, 'cleanup': {'errors': list(errors)}, 'selection': {'cells': list(wanted)},
                'cells': cells if cells is not None else {'a': {'status': 'PASS'}, 'b': {'status': 'PASS'}}, **extra}

    def test_priority(self):
        status = common.final_status
        self.assertEqual(status(self.record()), 'PASS')
        self.assertEqual(status(self.record(phase='RESTORE_PENDING')), 'CLEANUP_FAILED')
        self.assertEqual(status(self.record(errors=[{'step': 'x'}], interrupted='x')), 'CLEANUP_FAILED')
        self.assertEqual(status(self.record(interrupted='SIGTERM')), 'FAIL')
        self.assertEqual(status(self.record(runError='teardown')), 'FAIL')
        self.assertEqual(status(self.record(cells={'a': {'status': 'PASS'}})), 'FAIL')
        self.assertEqual(status(self.record(cells={'a': {'status': 'PASS'}, 'b': {'status': 'BLOCKED'}})), 'BLOCKED')
        self.assertEqual(status(self.record(cells={'a': {'status': 'FAIL'}, 'b': {'status': 'BLOCKED'}})), 'FAIL')
        self.assertEqual(status(self.record(wanted=())), 'FAIL')


class PhaseTests(unittest.TestCase):
    def test_match_and_server(self):
        phase = common.new_phase('r1', 1, {'screen': 's'})
        for key, value in (('runID', 'r0'), ('phase', 0), ('nonce', 'old')):
            self.assertFalse(common.match_report(phase, {**phase, key: value}))
        self.assertFalse(common.match_report(None, phase))
        server = common.PhaseServer()
        try:
            full = {**{key: None for key in common.REPORT_KEYS}, **{k: phase[k] for k in ('runID', 'phase', 'nonce')}}
            server.offer({**full, 'probe': 'p'})
            first = server.announce(phase)
            for stale in ({**full, 'nonce': 'old', 'probe': first}, {**full, 'extra': 1, 'probe': first},
                          {**full, 'probe': 3}):
                server.offer(stale)
            self.assertIsNone(server.latest(first))
            served = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{server.port}/phase', timeout=5).read())
            self.assertEqual(served['probe'], first)
            request = urllib.request.Request(f'http://127.0.0.1:{server.port}/report',
                                             data=json.dumps({**full, 'probe': first}).encode(), method='POST')
            urllib.request.urlopen(request, timeout=5).read()
            self.assertEqual((server.latest(first)['probe'], server.stale), (first, 4))
            after = server.reprobe()  # screenshot finished
            server.offer({**full, 'probe': first})  # a delayed pre-screenshot report arrives late
            self.assertIsNone(server.latest(after))
            server.offer({**full, 'probe': after})
            self.assertEqual(server.latest(after)['probe'], after)
        finally:
            server.close()


class DeviceTests(unittest.TestCase):
    SIM = {'name': 'Kloda-Capture25-r', 'runtime': 'rt', 'deviceType': 'dt', 'udid': None}

    def test_resolution(self):
        def listing(*devices):
            return {'devices': {'rt': [{'udid': u, 'name': n, 'deviceTypeIdentifier': k} for u, n, k in devices]}}
        own, resolve = ('U1', self.SIM['name'], 'dt'), ios.resolve_owned_device
        self.assertEqual(resolve(None, listing()), ('none', None))
        self.assertEqual(resolve(self.SIM, listing(own)), ('owned', 'U1'))
        self.assertEqual(resolve(self.SIM, listing(own, ('U2', self.SIM['name'], 'dt')))[0], 'ambiguous')
        self.assertEqual(resolve(self.SIM, listing(('U1', 'Personal', 'dt'))), ('absent', None))
        recorded = {**self.SIM, 'udid': 'U1'}
        self.assertEqual(resolve(recorded, listing(('U1', 'Renamed', 'dt')))[0], 'ambiguous')
        self.assertEqual(resolve(recorded, listing(('U2', self.SIM['name'], 'dt'))), ('absent', None))


class ReportTests(unittest.TestCase):
    GOOD = {'screen': 'settings', 'language': 'tr', 'themeMode': 'light', 'fontsLoaded': True, 'fontError': False,
            'appState': 'active', 'layoutReady': True, 'fontScale': 1.0, 'width': 402, 'height': 874}

    def test_problems(self):
        cell = _cell()
        self.assertEqual(ios.report_problems(cell, 'settings', self.GOOD), [])
        for key, value in (('language', 'en'), ('themeMode', 'dark'), ('fontError', True), ('width', 0),
                           ('appState', 'background'), ('screen', 'welcome'), ('fontScale', 1.3)):
            self.assertTrue(ios.report_problems(cell, 'settings', {**self.GOOD, key: value}), key)
        self.assertEqual(ios.report_problems(_cell(size='large'), 'settings', {**self.GOOD, 'fontScale': 3.1}), [])
        self.assertEqual(ios.png_problems((1206, 2622), self.GOOD), [])
        for size in (None, (402, 900), (300, 652), (1206, 2000)):
            self.assertTrue(ios.png_problems(size, self.GOOD), size)

    def test_recipe_covers_build_helpers_only(self):
        hashed = inspect.getsource(ios_build).replace(inspect.getsource(ios_build.verify_fixture), '')
        self.assertIn(inspect.getsource(ios_build._link_all), hashed)
        self.assertNotIn('def verify_fixture', hashed)
        self.assertEqual(ios_build._recipe(), hashlib.sha256(hashed.encode()).hexdigest())
        self.assertNotIn('ios.py', ios_build.TREE_INPUTS)

    def test_metro_deadline_is_absolute(self):
        def handler(delay):
            class Slow(http.server.BaseHTTPRequestHandler):
                def log_message(self, *args):
                    pass

                def do_GET(self):
                    self.send_response(200)
                    self.end_headers()
                    for _ in range(4):
                        self.wfile.write(b'x' * 10)
                        self.wfile.flush()
                        time.sleep(delay)
            return Slow
        metro = subprocess.Popen(['sleep', '30'])
        try:
            for delay, ok in ((0.0, True), (0.6, False)):  # 4 x 0.6 s drip / late EOF against a 1 s limit
                server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler(delay))
                threading.Thread(target=server.serve_forever, daemon=True).start()
                url, start = f'http://localhost:{server.server_address[1]}/b?x=1', time.monotonic()
                try:
                    if ok:
                        ios.wait_bundle(url, metro, limit=1)
                    else:
                        with self.assertRaises(common.CaptureError):
                            ios.wait_bundle(url, metro, limit=1)
                    self.assertLess(time.monotonic() - start, 1.5)
                finally:
                    server.shutdown()
                    server.server_close()
        finally:
            metro.kill()
            metro.wait()

    def test_fixture_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            fid = 'a' * 32
            base = {'status': 'READY', 'fixtureID': fid, 'bundle': ios_build.BUNDLE_PREFIX + fid, 'readback': {'x': True},
                    'scratch': f'{tmp}/{fid}', 'app': f'{tmp}/{fid}/{ios_build.PRODUCTS}/{ios_build.APP}.app'}
            path = Path(tmp) / 'fixture.json'
            for change, reason in (({'bundle': ios_build.BUNDLE_PREFIX + 'b' * 32}, 'identity'),
                                   ({'readback': {'x': False}}, 'readback'),
                                   ({'scratch': f'{tmp}/other'}, 'bound'), ({'app': f'{tmp}/x.app'}, 'bound')):
                path.write_text(json.dumps({**base, **change}))
                self.assertIn(reason, ios_build.verify_fixture(REPO, path)[1])


class DesktopTests(Tmp):
    MEASURE = {'lang': 'tr', 'theme': 'light', 'hash': '#/settings', 'calls': [], 'innerWidth': 1440,
               'rootFontPx': 16, 'fontsStatus': 'loaded', 'interLoaded': True}

    def test_verdict(self):
        cell, row = _cell(), {'ref': {'hash': '#/settings'}}
        self.assertEqual(desktop._verdict(cell, row, self.MEASURE, [], (1440, 1000), 1440), [])
        for key, value in (('lang', 'en'), ('theme', 'dark'), ('hash', '#/'), ('calls', ['backup.start']),
                           ('innerWidth', 0), ('rootFontPx', 20), ('fontsStatus', 'loading'), ('interLoaded', False)):
            self.assertTrue(desktop._verdict(cell, row, {**self.MEASURE, key: value}, [], (1440, 1000), 1440), key)
        for errors, png in ((['pageerror'], (1440, 1000)), ([], None), ([], (1, 1)), ([], (1440, 999))):
            self.assertTrue(desktop._verdict(cell, row, self.MEASURE, errors, png, 1440))

    def test_teardown_failure_is_cleanup_failure(self):
        class Broken:
            def close(self):
                raise RuntimeError('browser close failed')
        self.run.track('browser')['state'] = 'running'
        self.run.live.update(playwright=SimpleNamespace(stop=lambda: None), browser=Broken())
        desktop.cleanup(self.run)
        self.assertTrue(self.run.record['cleanup']['errors'])
        self.assertEqual(common.final_status(self.run.record), 'CLEANUP_FAILED')

    def test_inputs_outside_src_and_resume(self):
        repo = self.dir / 'repo'
        for rel in ('apps/desktop/src/app/global.css', 'apps/desktop/src/shared/i18n/locales/tr.json',
                    'assets/fonts/inter/Inter-Regular.ttf'):
            (repo / rel).parent.mkdir(parents=True, exist_ok=True)
            (repo / rel).write_text(rel)
        source, base = desktop.source_hash(repo), desktop.global_hash(repo)
        self.run.record['provenance']['renderer'] = {'fresh': True, 'sourceSha256': source, 'rendererSha256': 'r',
                                                     'globalSha256': base, 'stamp': {'sourceSha256': source,
                                                                                     'rendererSha256': 'r'}}
        cell, row = _cell(), {'ref': {'hash': '#/settings'}}
        old = {'pngSize': [1440, 1000], 'measure': {**self.MEASURE, 'viewport': [1440, 1000]}}
        self.assertEqual(desktop.resume_problems(repo, self.run, cell, row, old), [])
        (repo / 'apps/desktop/src/shared/i18n/locales/tr.json').write_text('unrelated key edit')
        self.assertNotEqual(desktop.source_hash(repo), source)  # a new run needs a rebuild ...
        self.assertEqual(desktop.resume_problems(repo, self.run, cell, row, old), [])  # ... reuse is kept
        (repo / 'assets/fonts/inter/Inter-Regular.ttf').write_text('changed font')
        self.assertNotEqual(desktop.global_hash(repo), base)
        self.assertTrue(desktop.resume_problems(repo, self.run, cell, row, old))

    def test_build_stamp(self):
        renderer = self.dir / 'renderer'
        renderer.mkdir()
        (renderer / 'index.html').write_text('<p>old build</p>')
        self.assertFalse(desktop.renderer_provenance(REPO, renderer)['fresh'])
        stamp = {'sourceSha256': desktop.source_hash(REPO), 'rendererSha256': desktop.renderer_hash(renderer)}
        common.atomic_write_json(renderer / desktop.STAMP, stamp)
        self.assertTrue(desktop.renderer_provenance(REPO, renderer)['fresh'])
        common.atomic_write_json(renderer / desktop.STAMP, {**stamp, 'sourceSha256': 'other'})
        self.assertFalse(desktop.renderer_provenance(REPO, renderer)['fresh'])


if __name__ == '__main__':
    unittest.main()
