"""Read-only APK ELF/RELRO check; zipalign/signing/runtime are separate gates."""
import hashlib
import json
from pathlib import Path
import runpy
import struct
import sys
import zipfile

PAGE = 16384
LOAD = 1
RELRO = 0x6474e552


def relro_safety(segments):
    protections = [s for s in segments if s[0] == RELRO]
    if not protections:
        return 'absent'
    results = []
    for _, address, size, _ in protections:
        end = address + size
        if end % PAGE == 0:
            results.append('aligned-end')
            continue
        end_page = (end + PAGE - 1) // PAGE * PAGE
        owners = [i for i, s in enumerate(segments) if s[0] == LOAD and s[1] == address and s[2] <= size
                  and (s[1] + s[2] + PAGE - 1) // PAGE * PAGE == end_page]
        assert len(owners) == 1, 'Unaligned RELRO shares writable LOAD'
        start_page = address // PAGE * PAGE
        assert all(not (s[1] < end_page and s[1] + s[2] > start_page)
                   for i, s in enumerate(segments) if i != owners[0] and s[0] == LOAD and s[3] & 2), 'RELRO overlaps another writable LOAD page'
        results.append('own-load-no-writable-overlap')
    return ','.join(results)


def segments64(data):
    assert data[:6] == b'\x7fELF\x02\x01', 'Expected little-endian ELF64'
    offset = struct.unpack_from('<Q', data, 32)[0]
    size, count = struct.unpack_from('<HH', data, 54)
    assert size >= 56 and offset + size * count <= len(data), 'Truncated ELF headers'
    return [(struct.unpack_from('<I', data, p)[0], struct.unpack_from('<Q', data, p + 16)[0],
             struct.unpack_from('<Q', data, p + 40)[0], struct.unpack_from('<I', data, p + 4)[0])
            for p in range(offset, offset + size * count, size)]


def self_test():
    assert relro_safety([]) == 'absent'
    assert relro_safety([(RELRO, 0x4680, 0x3980, 4)]) == 'aligned-end'
    own = [(LOAD, 0x4680, 0x980, 6), (RELRO, 0x4680, 0x980, 4)]
    assert relro_safety(own) == 'own-load-no-writable-overlap'
    assert relro_safety(own + [(LOAD, 0x8010, 0x100, 6)]) == 'own-load-no-writable-overlap'
    assert relro_safety([(LOAD, 0x5c40, 0x390, 6), (RELRO, 0x5c40, 0x3c0, 4), (LOAD, 0x9fd0, 0x10, 6)]) == 'own-load-no-writable-overlap'
    for bad in ([(LOAD, 0x4680, 0x4000, 6), (RELRO, 0x4680, 0x980, 4)], own + [(LOAD, 0x7000, 0x100, 6)],
                [(LOAD, 0x5c40, 0x390, 6), (RELRO, 0x5c40, 0x4400, 4)]):
        try:
            relro_safety(bad)
        except AssertionError:
            pass
        else:
            raise AssertionError('Unsafe RELRO fixture accepted')


def inspect(path):
    check = runpy.run_path(str(Path(__file__).with_name('check-android-elf-alignment.py')))['check']
    rows = []
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), 'Duplicate APK entry'
        for name in names:
            if not name.startswith(('lib/arm64-v8a/', 'lib/x86_64/')) or not name.endswith('.so'):
                continue
            data = archive.read(name)
            try:
                check(data)
                layout = relro_safety(segments64(data))
                error = None
            except AssertionError as failure:
                layout, error = 'UNVERIFIED', str(failure)
            rows.append({'path': name, 'relro': layout, 'error': error, 'sha256': hashlib.sha256(data).hexdigest()})
    assert all(any(row['path'] == f'lib/{abi}/libkloda_pairing_native.so' for row in rows) for abi in ('arm64-v8a', 'x86_64')), 'Missing Kloda ABI'
    return {'apkSha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(), 'elf64Count': len(rows),
            'status': 'PASS' if all(row['error'] is None for row in rows) else 'UNVERIFIED',
            'scope': 'ELF64 LOAD alignment and documented RELRO layout only; no runtime or ZIP/signature guarantee', 'libraries': rows}


if __name__ == '__main__':
    if not __debug__:
        raise RuntimeError('Run without -O; validation assertions must remain enabled')
    self_test()
    result = inspect(sys.argv[1])
    print(json.dumps(result, indent=2))
    sys.exit(0 if result['status'] == 'PASS' else 1)
