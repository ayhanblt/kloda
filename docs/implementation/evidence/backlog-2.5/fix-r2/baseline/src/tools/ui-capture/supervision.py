"""Per-run supervisor primitives: deferred interruption and process ownership.

The supervisor holds the live, unreaped handle of every process it starts; only such a handle
authorises a signal (its PID and process group cannot be reused while unreaped, and processes
from other sessions cannot join the group). Without that handle nothing is signalled: a
recorded process is accepted as gone only when no process with its PID or group remains.
"""
import os
import signal
import subprocess
import threading
import time
from contextlib import contextmanager

TERMINAL = ('stopped', 'gone')


class Interrupted(Exception):
    """The supervisor was asked to stop (public CLI gone or signalled)."""


_signals = {'armed': False, 'critical': 0, 'pending': None}


def on_signal(signum, _frame):
    if not _signals['armed']:
        return
    if _signals['critical']:
        _signals['pending'] = signum
        return
    raise Interrupted(signal.Signals(signum).name)


def arm(enabled):
    _signals['armed'], _signals['pending'] = enabled, None


@contextmanager
def critical():
    """Defer interruption so a launch and its record (or one capture step) stay atomic."""
    _signals['critical'] += 1
    try:
        yield
    finally:
        _signals['critical'] -= 1
        pending = _signals['pending']
        if not _signals['critical'] and pending and _signals['armed']:
            _signals['pending'] = None
            raise Interrupted(signal.Signals(pending).name)


def watch_parent(fd):
    """EOF on the public CLI pipe (closed on CLI signal or death) interrupts the supervisor.
    Raw reads: a daemon thread must not hold a buffered-reader lock at interpreter shutdown."""
    gone = threading.Event()

    def loop():
        while os.read(fd, 1):
            pass
        gone.set()
        os.kill(os.getpid(), signal.SIGUSR1)
    threading.Thread(target=loop, daemon=True).start()
    return gone


def exited(proc):
    """True when the child has exited, without reaping it (its PID/PGID stay reserved)."""
    if proc.returncode is not None:
        return True
    return os.waitid(os.P_PID, proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT) is not None


def process_table():
    out = subprocess.run(['ps', '-A', '-o', 'pid=,pgid=,stat='], capture_output=True, text=True,
                         check=True, timeout=30)
    table = {}
    for line in out.stdout.splitlines():
        fields = line.split()
        if len(fields) == 3:
            table[int(fields[0])] = (int(fields[1]), fields[2].startswith('Z'))
    return table


def _members(pgid):
    return sorted(pid for pid, (group, zombie) in process_table().items() if group == pgid and not zombie)


def stop_owned(run, entry, grace=15.0):
    """Stop one recorded process group; only an unreaped live handle authorises signals."""
    name = f'stop:{entry["role"]}'
    if entry.get('state') in TERMINAL:
        return run.cleanup_step(name, True, entry['state'])
    live = run.live.get(entry.get('pid'))
    if live is None or live.returncode is not None:
        return _verify_absent(run, entry, name)
    pgid = entry['pgid']
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(pgid, sig)
        except (ProcessLookupError, PermissionError):
            pass  # only the unreaped (zombie) leader is left
        deadline = time.monotonic() + grace
        while _members(pgid) and time.monotonic() < deadline:
            time.sleep(0.2)
        if not _members(pgid):
            break
    left = _members(pgid)
    if not left:
        try:
            live.wait(timeout=grace)
        except subprocess.TimeoutExpired:
            left = [live.pid]
    entry['state'] = 'alive' if left else 'stopped'
    return run.cleanup_step(name, not left, f'alive {left}' if left else None)


def _verify_absent(run, entry, name):
    """No owning handle: never signal; accept only proven absence of the PID and its group."""
    if entry.get('pid') is None:
        ok, detail = False, ('driver close not verified' if entry.get('closeBy') == 'driver'
                             else 'launch outcome unrecorded') + '; ownership unprovable, not signalled'
    else:
        table = process_table()
        present = entry['pid'] in table or any(group == entry['pgid'] for group, _ in table.values())
        ok, detail = not present, 'supervisor lost; process present, ownership unprovable, not signalled'
    entry['state'] = 'gone' if ok else 'unverified'
    return run.cleanup_step(name, ok, None if ok else detail)
