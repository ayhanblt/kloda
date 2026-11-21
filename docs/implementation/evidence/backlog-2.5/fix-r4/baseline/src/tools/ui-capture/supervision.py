"""Per-run supervisor primitives: deferred interruption and process ownership.

The supervisor holds the live, unreaped handle of every process it starts; only such a handle
authorises a signal (its PID and process group cannot be reused while unreaped, and processes
from other sessions cannot join the group). Without that handle nothing is signalled: a
recorded process is accepted as gone only when no process with its PID or group remains.
Signals that arrive before the supervisor is armed or inside a critical section are kept
pending and raised at the next safe point; they are never dropped.
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
    if not _signals['armed'] or _signals['critical']:
        _signals['pending'] = _signals['pending'] or signum
        return
    raise Interrupted(signal.Signals(signum).name)


def _raise_pending():
    pending, _signals['pending'] = _signals['pending'], None
    if pending:
        raise Interrupted(signal.Signals(pending).name)


def arm(enabled):
    """Arming raises a signal that arrived during bootstrap; disarming keeps later ones pending."""
    _signals['armed'] = enabled
    if enabled and not _signals['critical']:
        _raise_pending()


@contextmanager
def critical():
    """Defer interruption so a launch and its record (or one capture step) stay atomic."""
    _signals['critical'] += 1
    try:
        yield
    finally:
        _signals['critical'] -= 1
        if not _signals['critical'] and _signals['armed']:
            _raise_pending()


def install(handled=(signal.SIGTERM, signal.SIGUSR1, signal.SIGINT, signal.SIGHUP)):
    for sig in handled:
        signal.signal(sig, on_signal)


def watch_parent(fd):
    """EOF on the public CLI pipe (closed on CLI signal or death) interrupts the supervisor.
    Handlers must be installed first; raw reads so no buffered-reader lock is held at shutdown."""
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
    """{pid: (pgid, zombie, ppid)}."""
    out = subprocess.run(['ps', '-A', '-o', 'pid=,pgid=,ppid=,stat='], capture_output=True, text=True,
                         check=True, timeout=30)
    table = {}
    for line in out.stdout.splitlines():
        fields = line.split()
        if len(fields) == 4:
            table[int(fields[0])] = (int(fields[1]), fields[3].startswith('Z'), int(fields[2]))
    return table


def _members(pgid, table=None):
    table = process_table() if table is None else table
    return sorted(pid for pid, (group, zombie, _) in table.items() if group == pgid and not zombie)


def escaped(table, pgid):
    """Live descendants of the group that moved to another process group (never signalled)."""
    found, frontier = set(), {pid for pid, (group, _, _) in table.items() if group == pgid}
    while frontier:
        children = {pid for pid, (_, _, ppid) in table.items() if ppid in frontier} - found - frontier
        found |= children
        frontier = children
    return sorted(pid for pid in found if table[pid][0] != pgid and not table[pid][1])


def stop_owned(run, entry, grace=15.0):
    """Stop one recorded process group; only an unreaped live handle authorises signals."""
    name = f'stop:{entry["role"]}'
    if entry.get('state') in TERMINAL:
        return run.cleanup_step(name, True, entry['state'])
    live = run.live.get(entry.get('pid'))
    if live is None or live.returncode is not None:
        return verify_absent(run, entry, name)
    pgid, table = entry['pgid'], process_table()
    outside = sorted(set(escaped(table, pgid)) | set(entry.get('escaped', [])))  # earlier attempts' strays stay recorded
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
    table = process_table()
    stray = [pid for pid in outside if pid in table and not table[pid][1]]
    entry['state'] = 'alive' if left or stray else 'stopped'
    if stray:
        entry['escaped'] = stray
    detail = (f'alive {left}' if left else '') + (f' descendants left the group, not signalled {stray}' if stray else '')
    return run.cleanup_step(name, not detail, detail or None)


def verify_absent(run, entry, name, wait=0.0):
    """No owning handle: never signal. Success needs the recorded PID, its group (when it has one) and every
    escaped descendant recorded by an earlier attempt to be gone; root absence alone proves nothing else."""
    if entry.get('pid') is None:
        entry['state'] = 'unverified'
        return run.cleanup_step(name, False, ('driver close not verified' if entry.get('closeBy') == 'driver'
                                              else 'launch outcome unrecorded') + '; ownership unprovable, not signalled')
    deadline = time.monotonic() + wait
    while True:
        table = process_table()
        present = ([entry['pid']] if entry['pid'] in table else []) + (_members(entry['pgid'], table) if entry.get('pgid') else [])
        present += [pid for pid in entry.get('escaped', []) if pid in table and not table[pid][1]]
        if not present or time.monotonic() >= deadline:
            break
        time.sleep(0.2)
    entry['state'] = 'unverified' if present else 'gone'
    return run.cleanup_step(name, not present, f'still present {sorted(set(present))}; ownership unprovable, not signalled'
                            if present else None)
