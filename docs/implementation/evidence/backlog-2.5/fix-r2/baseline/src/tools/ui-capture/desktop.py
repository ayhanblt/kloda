"""Desktop renderer adapter: compiled renderer + synthetic bridge, loopback only.

This is a synthetic renderer capture. It is not Electron, native, OS tray or packaged-app
acceptance. Every bridge access outside the read-only allowlist is recorded and fails the cell.
The served renderer must carry a runner-written build stamp whose source digest equals the
current sources and whose output digest equals the served files; anything else is BLOCKED.
"""
import functools
import hashlib
import http.server
import json
import subprocess
import sys
import threading
import time
from pathlib import Path

from common import CaptureError, atomic_write_json, png_info, sha256_file
from supervision import critical, stop_owned

SOURCE_ROOTS = ('apps/desktop/src', 'apps/desktop/index.html', 'apps/desktop/vite.config.ts',
                'apps/desktop/package.json', 'packages/sync-core/src', 'package-lock.json')
RENDERER = Path('apps/desktop/dist/renderer')
STAMP = '.kloda-capture-build.json'
READY = {'settings': '.appearance-settings', 'tray': '[role=group] [role=status]'}
VIEWPORT_HEIGHT, ROOT_FONT_PX = 1000, 16
CELL_TIMEOUT_MS = 30000
BUILD_TIMEOUT_S = 900

STUB = """
(() => {
  const status = { receiver: { available: true, activeTransfers: 0 }, backup: { active: false, failed: false },
    autostart: { enabled: false, supported: true }, autostartChoice: false, canHide: true,
    environmentLimited: false, shutdownError: false, appVersion: '0.0.0' };
  const readOnly = {
    'background.status': status,
    'getDraft': { intervalHours: 12, localTime: '12:00', sources: [], storage: null, storageTested: false },
    'getProgress': null,
  };
  const calls = [];
  Object.defineProperty(window, '__captureCalls', { value: calls });
  const bridge = (prefix) => new Proxy({}, { get(_, prop) {
    if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
    const name = prefix + String(prop);
    if (name === 'background') return bridge('background.');
    if (Object.prototype.hasOwnProperty.call(readOnly, name)) return async () => structuredClone(readOnly[name]);
    calls.push(name);
    return async () => { throw new Error('capture: bridge call outside read-only allowlist'); };
  } });
  window.kloda = bridge('');
})();
"""

MEASURE = """
() => {
  const doc = document.documentElement;
  const theme = doc.classList.contains('dark') ? 'dark' : doc.classList.contains('light') ? 'light' : 'none';
  return { lang: doc.lang || null, theme, hash: location.hash, innerWidth: window.innerWidth,
    rootFontPx: parseFloat(getComputedStyle(doc).fontSize), fontsStatus: document.fonts.status,
    interLoaded: document.fonts.check('16px Inter'),
    headings: [...document.querySelectorAll('h1')].filter(h => !h.closest('[hidden]')).map(h => h.textContent),
    pageOverflow: doc.scrollWidth > doc.clientWidth, calls: [...window.__captureCalls] };
}
"""


def _tree_digest(base, paths):
    digest = hashlib.sha256()
    for path in paths:
        digest.update(f'{path.relative_to(base)}\0{sha256_file(path)}\n'.encode())
    return digest.hexdigest()


def source_hash(repo):
    """Digest of every build input (tests excluded: they are not bundled)."""
    files = []
    for root in SOURCE_ROOTS:
        base = Path(repo) / root
        files += [base] if base.is_file() else [p for p in sorted(base.rglob('*')) if p.is_file()
                                                and '.spec.' not in p.name and '.test.' not in p.name]
    return _tree_digest(Path(repo), files)


def renderer_hash(renderer):
    renderer = Path(renderer)
    return _tree_digest(renderer, [p for p in sorted(renderer.rglob('*')) if p.is_file() and p.name != STAMP])


def prepare(repo):
    """Run the existing Vite build and stamp its output with the exact source digest it came from."""
    before = source_hash(repo)
    code = subprocess.run(['npx', 'vite', 'build'], cwd=Path(repo) / 'apps/desktop', stdout=sys.stderr,
                          stderr=subprocess.STDOUT, timeout=BUILD_TIMEOUT_S).returncode
    if code != 0:
        raise CaptureError(f'vite build exit {code}')
    if source_hash(repo) != before:
        raise CaptureError('desktop sources changed during the build; rebuild')
    renderer = Path(repo) / RENDERER
    stamp = {'sourceSha256': before, 'rendererSha256': renderer_hash(renderer), 'builtAt': time.time(),
             'command': 'npx vite build (apps/desktop)'}
    atomic_write_json(renderer / STAMP, stamp)
    return stamp


def renderer_provenance(repo, renderer):
    renderer = Path(renderer)
    try:
        stamp = json.loads((renderer / STAMP).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {'fresh': False, 'reason': 'renderer has no capture build stamp; run prepare-desktop'}
    current = {'sourceSha256': source_hash(repo),
               'rendererSha256': renderer_hash(renderer) if (renderer / 'index.html').is_file() else None}
    stale = [key for key, value in current.items() if stamp.get(key) != value]
    return {**current, 'fresh': not stale, 'stamp': stamp,
            'reason': f'stamp mismatch: {stale}; run prepare-desktop' if stale else None}


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def _serve(renderer):
    handler = functools.partial(_QuietHandler, directory=str(renderer))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def _verdict(cell, row, measure, errors, png, width):
    checks = (('lang', cell.locale), ('theme', cell.theme), ('hash', row['ref']['hash']),
              ('innerWidth', width), ('rootFontPx', ROOT_FONT_PX), ('fontsStatus', 'loaded'), ('interLoaded', True))
    reasons = [f'{key} {measure.get(key)!r} != {want!r}' for key, want in checks if measure.get(key) != want]
    if measure.get('calls'):
        reasons.append(f'bridge calls outside allowlist {measure["calls"]}')
    if errors:
        reasons.append(f'{len(errors)} console/page errors')
    if png is None:
        reasons.append('missing or invalid PNG')
    elif png[0] != width or png[1] < VIEWPORT_HEIGHT:
        reasons.append(f'PNG {png[0]}x{png[1]} does not match viewport {width}x{VIEWPORT_HEIGHT}')
    return reasons


def capture(run, repo, cells, rows, opts):
    """Capture ready desktop cells; each result is written to the run, teardown is in cleanup()."""
    provenance = run.record['provenance']['renderer'] = renderer_provenance(repo, opts['renderer'])
    if not provenance['fresh']:
        for cell in cells:
            run.set_cell(cell.id, 'BLOCKED', reason=provenance['reason'])
        return
    run.advance('RUNNING')
    from playwright.sync_api import Error as PlaywrightError, sync_playwright
    server = run.live['server'] = _serve(opts['renderer'])
    entry = run.track('browser')
    with critical():
        run.live['playwright'] = playwright = sync_playwright().start()
        run.live['browser'] = browser = playwright.chromium.launch()
        entry['state'] = 'running'
        run.save()
    for cell in cells:
        # Playwright calls are never interrupted mid-flight; each step is bounded by its timeout.
        with critical():
            _capture_cell(run, browser, cell, rows[cell.row], server.server_address[1], opts['width'], PlaywrightError)


def _capture_cell(run, browser, cell, row, port, width, playwright_error):
    errors, ready = [], READY.get(row['screen'])
    base = {'screen': row['screen'], 'driverKind': 'synthetic-renderer'}
    if ready is None:
        return run.set_cell(cell.id, 'BLOCKED', reason='no readiness check for screen', **base)
    context = browser.new_context(viewport={'width': width, 'height': VIEWPORT_HEIGHT},
                                  color_scheme=cell.theme, reduced_motion='reduce')
    try:
        context.set_default_timeout(CELL_TIMEOUT_MS)
        context.add_init_script(STUB)
        context.add_init_script(f"localStorage.setItem('kloda.appearance', {json.dumps(cell.theme)})")
        page = context.new_page()
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{port}/index.html#/settings')
        page.wait_for_selector(READY['settings'])
        page.locator(f'input[name=kloda-language][value={cell.locale}]').check()
        page.evaluate(f'location.hash = {json.dumps(row["ref"]["hash"])}')
        page.wait_for_selector(ready)
        page.wait_for_function('document.fonts.status === "loaded"')
        measure = page.evaluate(MEASURE)
        name = cell.id.replace('/', '__') + '.png'
        target = run.path(name)
        page.screenshot(path=str(target), full_page=True)
        png = png_info(target)
        reasons = _verdict(cell, row, measure, errors, png, width)
        run.set_cell(cell.id, 'FAIL' if reasons else 'PASS', reasons=reasons, png=name, pngSize=png,
                     pngSha256=sha256_file(target) if png else None, **base,
                     measure={**measure, 'viewport': [width, VIEWPORT_HEIGHT], 'size': 'normal',
                              'consoleErrors': errors[:10]})
    except playwright_error as error:
        run.set_cell(cell.id, 'FAIL', reasons=[f'playwright: {str(error)[:300]}'], consoleErrors=errors[:10], **base)
    finally:
        context.close()


def cleanup(run):
    """Close through the driver's own path; an unverified close stays a cleanup failure."""
    run.begin_cleanup()
    playwright, browser = run.live.pop('playwright', None), run.live.pop('browser', None)
    tracked = [entry for entry in run.record['processes'] if entry.get('closeBy') == 'driver']
    if playwright is not None:
        try:
            if browser is not None:
                browser.close()
            playwright.stop()
            for entry in tracked:
                entry['state'] = 'stopped'
        except Exception as error:  # noqa: BLE001 - any teardown failure must fail the run
            run.cleanup_step('browser:close', False, f'{type(error).__name__}: {str(error)[:200]}')
    for entry in run.record['processes']:
        stop_owned(run, entry)
    server = run.live.pop('server', None)
    if server is not None:
        server.shutdown()
        server.server_close()
        run.cleanup_step('loopback:closed', True)


def resume_problems(repo, run, cell, row, old):
    recorded = run.record['provenance'].get('renderer', {})
    current = renderer_provenance(repo, run.record['selection']['args']['renderer'])
    if not current['fresh'] or any(current.get(k) != recorded.get(k) for k in ('sourceSha256', 'rendererSha256')):
        return ['renderer build changed or stale']
    measure = old.get('measure') or {}
    size = tuple(old['pngSize']) if old.get('pngSize') else None
    return _verdict(cell, row, measure, measure.get('consoleErrors', []), size, (measure.get('viewport') or [0])[0])
