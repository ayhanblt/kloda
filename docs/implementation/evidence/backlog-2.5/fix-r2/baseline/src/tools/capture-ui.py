#!/usr/bin/env python3
"""Durable UI capture runner (2.5 / D25-M): check, list, run, prepare-*, cleanup, resume.

Exit codes: 0 PASS, 1 FAIL, 2 BLOCKED, 3 CLEANUP_FAILED, 4 usage/matrix error. A run is PASS
only when every selected cell passed (or was reused), it was not interrupted and its owned
resources were verified clean. `run` starts a per-run supervisor in its own session that
holds the run lock and every launched process; if the public CLI is signalled or killed the
supervisor still cleans up and records CLEANED + FAIL. Desktop captures are synthetic renderer
evidence; iOS captures are real components in a disposable fixture. Neither is Android,
physical-device, OS tray or full visual acceptance.
"""
import sys

sys.dont_write_bytecode = True

import argparse  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import re  # noqa: E402
import shutil  # noqa: E402
import signal  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402
from importlib.util import find_spec  # noqa: E402
from pathlib import Path  # noqa: E402
from types import SimpleNamespace  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
TOOLS = REPO / 'tools/ui-capture'
sys.path.insert(0, str(TOOLS))

import matrix as mx  # noqa: E402
import supervision  # noqa: E402
from common import EXIT_CODES, RECORD, CaptureError, Run, final_status  # noqa: E402
from supervision import TERMINAL, Interrupted  # noqa: E402

MATRIX = TOOLS / 'matrix.json'
SCREENS_TSX = REPO / 'apps/mobile/capture/screens.tsx'
DEFAULT_SCRATCH = Path.home() / 'Library/Caches/kloda-capture25'
WIDTH_RANGE = (320, 3840)


def driver_module(name):
    if name == 'desktop-renderer':
        import desktop
        return desktop
    import ios
    return ios


def registry_screens():
    text = SCREENS_TSX.read_text(encoding='utf-8') if SCREENS_TSX.is_file() else ''
    return set(re.findall(r"^\s*'([a-z0-9-]+)':\s*\{", text, re.MULTILINE))


def cmd_check(_args):
    errors, info = [], {}
    for path in [Path(__file__), *sorted(TOOLS.glob('*.py'))]:
        try:
            compile(path.read_text(encoding='utf-8'), str(path), 'exec')
        except SyntaxError as error:
            errors.append(f'syntax {path.name}: {error}')
    try:
        matrix = mx.load(MATRIX)
        ready = {r['screen'] for r in matrix['rows'] if r['driver'] == 'ios-native-entry' and r['status'] == 'ready'}
        if ready != registry_screens():
            errors.append(f'ios ready rows {sorted(ready)} != screens.tsx registry {sorted(registry_screens())}')
    except (mx.MatrixError, ValueError) as error:
        errors.append(f'matrix: {error}')
    info['playwright'] = find_spec('playwright') is not None
    for tool in ('ruby', 'xcrun', 'xcodebuild', 'segedit', 'vtool', 'codesign', '/usr/bin/derq', 'npx'):
        info[tool] = shutil.which(tool) is not None
    print(json.dumps({'errors': errors, 'environment': info}, indent=1))
    return EXIT_CODES['FAIL'] if errors else EXIT_CODES['PASS']


def cmd_list(args):
    listing = mx.listing(mx.load(MATRIX))
    if args.format == 'json':
        print(json.dumps(listing, indent=1, ensure_ascii=False))
    else:
        for row in listing['rows']:
            print(f"{row['id']:<36} {row['driver']:<18} {row['status']:<22} {row.get('reason') or ''}")
        print(json.dumps(listing['totals']))
    return EXIT_CODES['PASS']


def _select(matrix, opts, driver):
    return mx.select(matrix, screen=opts['screen'], locale=opts['locale'], theme=opts['theme'],
                     size=opts['size'], driver=driver)


def cmd_run(args):
    if args.driver == 'ios-native-entry' and not args.fixture:
        raise CaptureError('ios-native-entry requires --fixture from prepare-ios')
    if not WIDTH_RANGE[0] <= args.width <= WIDTH_RANGE[1]:
        raise CaptureError(f'--width must be within {WIDTH_RANGE}')
    opts = {'screen': args.screen, 'locale': args.locale, 'theme': args.theme, 'size': args.size,
            'width': args.width, 'renderer': str(Path(args.renderer).resolve()),
            'fixture': str(Path(args.fixture).resolve()) if args.fixture else None,
            'runtime': args.runtime, 'deviceType': args.device_type}
    cells = _select(mx.load(MATRIX), opts, args.driver)
    run = Run.create(args.out, args.driver, {'cells': [c.id for c in cells], 'args': opts})
    lock_fd = run.lock_fileno()
    supervisor = subprocess.Popen([sys.executable, '-I', '-B', str(Path(__file__).resolve()), '_supervise',
                                   '--run', str(run.root), '--lock-fd', str(lock_fd)],
                                  stdin=subprocess.PIPE, pass_fds=(lock_fd,), start_new_session=True)
    run.close()  # the supervisor's inherited descriptor keeps the run lock

    def interrupt(_signum, _frame):
        if not supervisor.stdin.closed:
            supervisor.stdin.close()  # EOF tells the supervisor to stop and clean up
    signal.signal(signal.SIGINT, interrupt)
    signal.signal(signal.SIGTERM, interrupt)
    return _report(run.root, supervisor.wait())


def _report(root, supervisor_exit=None):
    record = json.loads((root / RECORD).read_text(encoding='utf-8'))
    status = record.get('result') if record.get('phase') == 'CLEANED' else 'CLEANUP_FAILED'
    status = status if status in EXIT_CODES else 'CLEANUP_FAILED'
    print(json.dumps({'result': status, 'phase': record.get('phase'), 'run': str(root),
                      'supervisorExit': supervisor_exit,
                      'interrupted': bool(record.get('interrupted')),
                      'cells': {k: v['status'] for k, v in record['cells'].items()},
                      'cleanupErrors': record['cleanup']['errors']}, indent=1))
    return EXIT_CODES[status]


def cmd_supervise(args):
    run = Run.open(args.run, lock_fd=args.lock_fd)
    parent_gone = supervision.watch_parent(sys.stdin.fileno())
    for sig in (signal.SIGTERM, signal.SIGUSR1, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, supervision.on_signal)
    driver, opts = driver_module(run.record['driver']), run.record['selection']['args']
    run.record['supervisor'] = {'pid': os.getpid()}
    run.event('SUPERVISING')
    ready = []
    supervision.arm(True)
    try:
        matrix = mx.load(MATRIX)
        cells = _select(matrix, opts, run.record['driver'])
        if [c.id for c in cells] != run.record['selection']['cells']:
            raise CaptureError('selection changed between launch and supervision')
        fingerprints = run.record['provenance']['fingerprints'] = {}
        for cell in cells:
            fingerprints[cell.id] = mx.fingerprint(matrix, cell.row, cell.locale, REPO)
            if cell.status != 'ready':
                run.set_cell(cell.id, 'BLOCKED', reason=f'{cell.status}: {cell.reason}')
        ready = [c for c in cells if c.status == 'ready']
        if ready:
            driver.capture(run, REPO, ready, {row['id']: row for row in matrix['rows']}, opts)
    except Exception as error:  # noqa: BLE001 - every failure must still reach cleanup and the record
        detail = f'{type(error).__name__}: {str(getattr(error, "stderr", None) or error)[:300]}'
        run.record['interrupted' if isinstance(error, Interrupted) else 'runError'] = detail
        for cell in ready:
            if cell.id not in run.record['cells']:
                run.set_cell(cell.id, 'FAIL', reasons=[detail])
        run.event('error', detail=detail)
    finally:
        supervision.arm(False)
        for cell_id, fp in run.record['provenance'].get('fingerprints', {}).items():
            if cell_id in run.record['cells']:
                run.record['cells'][cell_id]['fingerprint'] = fp
        driver.cleanup(run)
    if parent_gone.is_set():
        run.record['interrupted'] = run.record.get('interrupted') or 'public CLI closed or killed'
    return _finish(run, quiet=True)


def _finish(run, quiet=False):
    unresolved = [e['role'] for e in run.record['processes'] if e.get('state') not in TERMINAL]
    if unresolved and not run.record['cleanup']['errors']:
        run.cleanup_step('processes:unresolved', False, unresolved)
    if not run.record['cleanup']['errors'] and run.record['phase'] != 'CLEANED':
        run.advance('CLEANED')
    status = run.record['result'] = final_status(run.record)
    run.save()
    run.close()
    return EXIT_CODES[status] if quiet else _report(run.root)


def cmd_cleanup(args):
    run = Run.open(args.run)
    if run.record.get('result') is None:
        # The lock was free and no result was written: the owning supervisor is gone.
        run.record['interrupted'] = run.record.get('interrupted') or 'supervisor lost before completion'
    if run.record['phase'] != 'CLEANED':
        driver_module(run.record['driver']).cleanup(run)
    return _finish(run)


def _resume_cell(run, matrix, rows, cell_id):
    old = run.record['cells'].get(cell_id, {})
    row_id, locale, theme, size = cell_id.split('/')
    row = rows.get(row_id)
    if old.get('status') != 'PASS':
        return {'decision': 'recapture', 'changed': ['status']}
    if row is None or row['status'] != 'ready' or row['driver'] != run.record['driver'] or row['screen'] != old.get('screen'):
        return {'decision': 'recapture', 'changed': ['row']}
    decision = mx.reuse_decision(old.get('fingerprint'), mx.fingerprint(matrix, row_id, locale, REPO))
    if decision['decision'] != 'reuse':
        return decision
    cell = SimpleNamespace(id=cell_id, row=row_id, locale=locale, theme=theme, size=size)
    reasons = run.artifact_problems(old) or driver_module(run.record['driver']).resume_problems(REPO, run, cell, row, old)
    return {'decision': 'recapture', 'changed': reasons} if reasons else decision


def cmd_resume(args):
    run = Run.open(args.run)
    try:
        if run.record['phase'] != 'CLEANED':
            print(json.dumps({'error': 'run not CLEANED; run cleanup --run first'}))
            return EXIT_CODES['CLEANUP_FAILED']
        matrix = mx.load(MATRIX)
        rows = {row['id']: row for row in matrix['rows']}
        decisions = {cell_id: _resume_cell(run, matrix, rows, cell_id) for cell_id in run.record['selection']['cells']}
        report = {'at': time.time(), 'decisions': decisions}
        run.path(f'resume-{int(time.time() * 1000)}.json').write_text(json.dumps(report, indent=1, sort_keys=True))
    finally:
        run.close()
    print(json.dumps(report, indent=1))
    return EXIT_CODES['PASS'] if all(d['decision'] == 'reuse' for d in decisions.values()) else EXIT_CODES['FAIL']


def cmd_prepare_ios(args):
    import ios_build
    record = ios_build.prepare(REPO, Path(args.out), Path(args.scratch))
    print(json.dumps({'status': record['status'], 'bundle': record['bundle'], 'readback': record['readback']}, indent=1))
    return EXIT_CODES['PASS']


def cmd_prepare_desktop(_args):
    import desktop
    print(json.dumps(desktop.prepare(REPO), indent=1))
    return EXIT_CODES['PASS']


def parser():
    root = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = root.add_subparsers(dest='command', required=True)
    sub.add_parser('check').set_defaults(func=cmd_check)
    listing = sub.add_parser('list')
    listing.add_argument('--format', choices=('json', 'text'), default='text')
    listing.set_defaults(func=cmd_list)
    run = sub.add_parser('run')
    run.add_argument('--driver', required=True, choices=('desktop-renderer', 'ios-native-entry'))
    for name in ('screen', 'locale', 'theme', 'size'):
        run.add_argument(f'--{name}')
    run.add_argument('--width', type=int, default=1440)
    run.add_argument('--renderer', default=str(REPO / 'apps/desktop/dist/renderer'))
    run.add_argument('--fixture')
    run.add_argument('--runtime', default='com.apple.CoreSimulator.SimRuntime.iOS-26-5')
    run.add_argument('--device-type', default='com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro')
    run.add_argument('--out', required=True)
    run.set_defaults(func=cmd_run)
    supervise = sub.add_parser('_supervise')
    supervise.add_argument('--run', required=True)
    supervise.add_argument('--lock-fd', type=int, required=True)
    supervise.set_defaults(func=cmd_supervise)
    prepare = sub.add_parser('prepare-ios')
    prepare.add_argument('--out', required=True)
    prepare.add_argument('--scratch', default=str(DEFAULT_SCRATCH))
    prepare.set_defaults(func=cmd_prepare_ios)
    sub.add_parser('prepare-desktop').set_defaults(func=cmd_prepare_desktop)
    for name, func in (('cleanup', cmd_cleanup), ('resume', cmd_resume)):
        command = sub.add_parser(name)
        command.add_argument('--run', required=True)
        command.set_defaults(func=func)
    return root


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        return args.func(args)
    except (mx.MatrixError, CaptureError) as error:
        print(json.dumps({'error': str(error)}))
        return EXIT_CODES['USAGE']


if __name__ == '__main__':
    sys.exit(main())
