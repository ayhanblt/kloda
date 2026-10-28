"""Check produced Kloda libraries only; not APK packaging or Android runtime acceptance."""
from pathlib import Path
import struct


def check(data):
    assert data[:4] == b'\x7fELF' and data[5] == 1, 'Expected little-endian ELF'
    bits = data[4]
    assert bits in (1, 2), 'Unknown ELF class'
    wide = bits == 2
    offset = struct.unpack_from('<Q' if wide else '<I', data, 32 if wide else 28)[0]
    size, count = struct.unpack_from('<HH', data, 54 if wide else 42)
    assert size >= (56 if wide else 32) and count > 0, 'Missing program headers'
    assert offset + size * count <= len(data), 'Truncated program headers'
    loads = 0
    for index in range(count):
        start = offset + index * size
        if struct.unpack_from('<I', data, start)[0] != 1:
            continue
        file_offset, address = struct.unpack_from('<QQ' if wide else '<II', data, start + (8 if wide else 4))
        alignment = struct.unpack_from('<Q' if wide else '<I', data, start + (48 if wide else 28))[0]
        assert alignment >= 16384 and alignment & (alignment - 1) == 0, 'LOAD alignment below 16KB'
        assert (file_offset - address) % alignment == 0, 'LOAD address/offset incongruent'
        loads += 1
    assert loads > 0, 'No LOAD segments'


def self_test():
    for wide in (False, True):
        data = bytearray(128)
        data[:6] = b'\x7fELF' + bytes((2 if wide else 1, 1))
        struct.pack_into('<Q' if wide else '<I', data, 32 if wide else 28, 64)
        struct.pack_into('<HH', data, 54 if wide else 42, 56 if wide else 32, 1)
        struct.pack_into('<I', data, 64, 1)
        alignment_at = 64 + (48 if wide else 28)
        struct.pack_into('<Q' if wide else '<I', data, alignment_at, 16384)
        check(data)
        struct.pack_into('<Q' if wide else '<I', data, alignment_at, 4096)
        try:
            check(data)
        except AssertionError:
            pass
        else:
            raise AssertionError('4KB fixture accepted')
        struct.pack_into('<Q' if wide else '<I', data, alignment_at, 65536)
        struct.pack_into('<Q' if wide else '<I', data, 64 + (8 if wide else 4), 16384)
        try:
            check(data)
        except AssertionError:
            pass
        else:
            raise AssertionError('Incongruent LOAD fixture accepted')


if __name__ == '__main__':
    if not __debug__:
        raise RuntimeError('Run without -O; alignment assertions must remain enabled')
    self_test()
    base = Path(__file__).resolve().parents[1] / 'apps/mobile/modules/my-module/android/src/main/jniLibs'
    for abi in ('arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'):
        check((base / abi / 'libkloda_pairing_native.so').read_bytes())
        print(f'{abi}: ELF LOAD alignment PASS >=16KB')
