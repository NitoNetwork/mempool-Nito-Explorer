"""Public Orchard tree operations, using the pinned Core Rust implementation."""
import ctypes as C
import os
from functools import lru_cache


class Orchard:
    def __init__(self, path=None):
        path = path or os.environ.get('NITO_ORCHARD_LIBRARY')
        if not path:
            raise RuntimeError('NITO_ORCHARD_LIBRARY must name the pinned Core FFI library')
        self.lib = C.CDLL(path)
        self.lib.nito_orchard_empty_root.argtypes = [C.c_uint8, C.c_void_p, C.c_void_p, C.c_size_t]
        self.lib.nito_orchard_combine_nodes.argtypes = [C.c_uint8] + [C.c_void_p] * 4 + [C.c_size_t]
        self.lib.nito_orchard_compute_root.argtypes = [C.c_void_p, C.c_size_t, C.c_void_p, C.c_void_p, C.c_size_t]

    def call(self, name, *args):
        error = C.create_string_buffer(512)
        code = getattr(self.lib, 'nito_orchard_' + name)(*args, error, len(error))
        if code:
            raise ValueError(error.value.decode('utf-8', errors='replace'))

    @lru_cache(maxsize=33)
    def empty(self, level):
        if type(level) is not int or not 0 <= level <= 32:
            raise ValueError('invalid Orchard level')
        out = C.create_string_buffer(32)
        self.call('empty_root', level, out)
        return out.raw

    def combine(self, level, left, right):
        if type(level) is not int or not 0 <= level < 32 or len(left) != 32 or len(right) != 32:
            raise ValueError('invalid Orchard node')
        out = C.create_string_buffer(32)
        self.call('combine_nodes', level, left, right, out)
        return out.raw

    def root(self, commitments):
        if any(len(c) != 32 for c in commitments):
            raise ValueError('invalid commitment')
        out = C.create_string_buffer(32)
        self.call('compute_root', b''.join(commitments), len(commitments), out)
        return out.raw

    def verify(self, cmx, position, path, root):
        if type(position) is not int or not 0 <= position < 2**32 or len(path) != 32:
            raise ValueError('invalid Orchard witness')
        node = cmx
        for level, sibling in enumerate(path):
            node = self.combine(level, sibling, node) if (position >> level) & 1 else self.combine(level, node, sibling)
        if node != root:
            raise ValueError('Orchard witness root mismatch')


@lru_cache(maxsize=1)
def orchard():
    return Orchard()
