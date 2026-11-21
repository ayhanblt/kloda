"""iOS native-entry adapter: disposable fixture bundle, run-created Simulator, supervised Metro.

Real product components and native modules run inside a fixture bundle whose only Keychain
group is its own identifier, on a Simulator this run creates and deletes. Existing Simulators,
apps, containers and Keychains are never adopted. This is not production signing acceptance.
"""
import json
import os
import socket
import subprocess
import time
import urllib.request

from common import CaptureError, PhaseServer, new_phase, png_info, sha256_file
from ios_build import FIXTURE_KEYS, verify_fixture
from supervision import critical, exited, stop_owned

SIZES = {'normal': 'large', 'large': 'accessibility-extra-extra-extra-large'}
METRO_READY_S, PHASE_S, SIMCTL_S, BOOT_S, INSTALL_S = 90, 60, 60, 240, 180
LAUNCH_ARGS = ['-EXDevMenuIsOnboardingFinished', '1', '-EXDevMenuShowsAtLaunch', '0']


def simctl(*argv, check=True, timeout=SIMCTL_S):
    return subprocess.run(['xcrun', 'simctl', *argv], capture_output=True, text=True, check=check, timeout=timeout)


def resolve_owned_device(simulator, listing):
    """('none'|'absent'|'owned'|'ambiguous', udid|reason) from the run record only."""
    if not simulator:
        return 'none', None
    devices = [dict(d, runtime=rt) for rt, items in listing.get('devices', {}).items() for d in items]
    if simulator.get('udid'):
        found = [d for d in devices if d['udid'] == simulator['udid']]
        if not found:
            return 'absent', None
        if found[0]['name'] != simulator['name']:
            return 'ambiguous', 'recorded UDID now has a different name'
        return 'owned', found[0]['udid']
    found = [d for d in devices if d['name'] == simulator['name'] and d['runtime'] == simulator['runtime']
             and d.get('deviceTypeIdentifier') == simulator['deviceType']]
    if not found:
        return 'absent', None
    return ('owned', found[0]['udid']) if len(found) == 1 else ('ambiguous', f'{len(found)} intent matches')


def report_problems(cell, screen, report):
    if not report:
        return ['no current-phase report']
    problems = [f'{key} {report.get(key)!r} != {want!r}' for key, want in
                (('screen', screen), ('language', cell.locale), ('themeMode', cell.theme),
                 ('fontsLoaded', True), ('fontError', False), ('appState', 'active'), ('layoutReady', True))
                if report.get(key) != want]
    scale = report.get('fontScale') or 0
    if (cell.size == 'large' and scale <= 1.5) or (cell.size == 'normal' and abs(scale - 1.0) > 0.01):
        problems.append(f'fontScale {scale} does not match size {cell.size}')
    if not (report.get('width') or 0) > 0 < (report.get('height') or 0):
        problems.append('no positive layout size')
    return problems


def png_problems(size, report):
    """The PNG must be a complete image of the measured screen (same aspect, at least 1x)."""
    if size is None:
        return ['missing or invalid PNG']
    width, height = (report or {}).get('width') or 0, (report or {}).get('height') or 0
    if width <= 0 or height <= 0 or size[0] < width or abs(size[0] * height - size[1] * width) > size[0]:
        return [f'PNG {size[0]}x{size[1]} does not match measured screen {width}x{height}']
    return []


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def wait_bundle(url, metro):
    """Whole bundle download inside one absolute deadline; Metro exit is seen without reaping."""
    deadline = time.monotonic() + METRO_READY_S
    while time.monotonic() < deadline:
        if exited(metro):
            raise CaptureError('Metro exited before the bundle was ready')
        try:
            with urllib.request.urlopen(url, timeout=max(1, deadline - time.monotonic())) as response:
                while response.status == 200 and time.monotonic() < deadline:
                    if not response.read(1 << 16):
                        return
        except OSError:
            time.sleep(1)
    raise CaptureError(f'Metro bundle not ready in {METRO_READY_S}s')


def simulator_listing():
    return json.loads(simctl('list', 'devices', '-j').stdout)


def _target_problem(opts):
    runtimes = json.loads(simctl('list', 'runtimes', '-j').stdout)['runtimes']
    types = json.loads(simctl('list', 'devicetypes', '-j').stdout)['devicetypes']
    if not any(r['identifier'] == opts['runtime'] and r.get('isAvailable') for r in runtimes):
        return f'runtime not installed: {opts["runtime"]}'
    if not any(t['identifier'] == opts['deviceType'] for t in types):
        return f'device type not installed: {opts["deviceType"]}'
    return None


def capture(run, repo, cells, rows, opts):
    fixture, problem = verify_fixture(repo, opts['fixture'])
    problem = problem or _target_problem(opts)
    if problem:
        for cell in cells:
            run.set_cell(cell.id, 'BLOCKED', reason=problem)
        return
    run.record['provenance']['fixture'] = {k: fixture[k] for k in FIXTURE_KEYS}
    sim = run.record['simulator'] = {'name': f'Kloda-Capture25-{run.record["runID"]}', 'runtime': opts['runtime'],
                                     'deviceType': opts['deviceType'], 'udid': None}
    run.advance('CREATING')
    with critical():
        sim['udid'] = simctl('create', sim['name'], opts['deviceType'], opts['runtime']).stdout.strip()
        run.advance('CREATED')
    simctl('boot', sim['udid'])
    simctl('bootstatus', sim['udid'], '-b', timeout=BOOT_S)
    run.record['settings'] = {key: simctl('ui', sim['udid'], key).stdout.strip() for key in ('appearance', 'content_size')}
    server = run.live['server'] = PhaseServer()
    port = free_port()
    url = f'http://localhost:{port}/apps/mobile/capture/entry.bundle?platform=ios&dev=true&minify=false'
    env = {**os.environ, 'CI': '1', 'EXPO_PUBLIC_KLODA_CAPTURE_PORT': str(server.port),
           'EXPO_PUBLIC_KLODA_CAPTURE_RUN': run.record['runID']}
    log = run.live['metroLog'] = open(run.path('metro.log'), 'w')
    metro = run.spawn('metro', ['npx', 'expo', 'start', '--dev-client', '--localhost', '--port', str(port)],
                      cwd=repo / 'apps/mobile', env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT)
    run.advance('RUNNING')
    wait_bundle(url, metro)
    simctl('install', sim['udid'], fixture['app'], timeout=INSTALL_S)
    simctl('launch', sim['udid'], fixture['bundle'], '--initialUrl', url, *LAUNCH_ARGS)
    for index, cell in enumerate(cells, 1):
        _capture_cell(run, sim['udid'], server, index, cell, rows[cell.row]['screen'])
    run.record['provenance']['staleReports'] = server.stale


def _await_report(server, cell, screen, after):
    deadline, report, problems = time.monotonic() + PHASE_S, None, ['no current-phase report']
    while time.monotonic() < deadline:
        latest = server.latest()
        if latest and latest['sample'] > after:
            report, problems = latest, report_problems(cell, screen, latest)
            if not problems:
                break
        time.sleep(0.25)
    return report, problems


def _capture_cell(run, udid, server, index, cell, screen):
    simctl('ui', udid, 'appearance', cell.theme)
    simctl('ui', udid, 'content_size', SIZES[cell.size])
    server.announce(new_phase(run.record['runID'], index, {'screen': screen, 'locale': cell.locale,
                                                           'theme': cell.theme, 'size': cell.size}))
    base = {'screen': screen, 'driverKind': 'native-component-fixture'}
    before, problems = _await_report(server, cell, screen, -1)
    if problems:
        return run.set_cell(cell.id, 'FAIL', reasons=problems, measure=before, **base)
    name = cell.id.replace('/', '__') + '.png'
    target = run.path(name)
    simctl('io', udid, 'screenshot', str(target))
    size = png_info(target)
    # A fresh sample after the screenshot proves the measured state held while it was taken.
    after, problems = _await_report(server, cell, screen, before['sample'])
    problems = problems + png_problems(size, after or before)
    run.set_cell(cell.id, 'FAIL' if problems else 'PASS', reasons=problems, png=name, pngSize=size,
                 pngSha256=sha256_file(target) if size else None, measure=after, before=before, **base)


def _try(*argv):
    try:
        return simctl(*argv, check=False).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def cleanup(run):
    run.begin_cleanup()
    server = run.live.pop('server', None)
    if server:
        server.announce(None)
    sim = run.record.get('simulator')
    try:
        state, udid = resolve_owned_device(sim, simulator_listing())
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        state, udid = 'ambiguous', f'simctl listing failed: {error}'
    if state == 'owned':
        bundle = run.record['provenance'].get('fixture', {}).get('bundle')
        if bundle:
            run.cleanup_step('app:terminated', True, None if _try('terminate', udid, bundle) else 'not running')
        for key, value in run.record.get('settings', {}).items():
            run.cleanup_step(f'restore:{key}', _try('ui', udid, key, value))
    for entry in run.record['processes']:
        stop_owned(run, entry)
    if run.live.get('metroLog'):
        run.live.pop('metroLog').close()
    if server:
        server.close()
        run.cleanup_step('phase-server:closed', True)
    if state == 'owned':
        _try('shutdown', udid)
        deleted = _try('delete', udid)
        try:
            gone = resolve_owned_device(sim, simulator_listing())[0] == 'absent'
        except (OSError, subprocess.SubprocessError, ValueError):
            gone = False
        run.cleanup_step('simulator:deleted', deleted and gone, None if gone else 'device still listed')
    elif state == 'ambiguous':
        run.cleanup_step('simulator:ownership', False, udid)
    else:
        run.cleanup_step('simulator:none-owned-present', True)


def resume_problems(repo, run, cell, _row, old):
    fixture, problem = verify_fixture(repo, run.record['selection']['args']['fixture'])
    if problem:
        return [problem]
    recorded = run.record['provenance'].get('fixture', {})
    if any(fixture[key] != recorded.get(key) for key in FIXTURE_KEYS):
        return ['fixture identity changed']
    measure = old.get('measure') or {}
    size = tuple(old['pngSize']) if old.get('pngSize') else None
    return report_problems(cell, old.get('screen'), measure) + png_problems(size, measure)
