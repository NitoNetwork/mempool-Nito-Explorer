"""Bounded public-index benchmark; writes one JSON measurement to stdout."""
import json
from pathlib import Path
import tempfile
import time
import tracemalloc
import plyvel

from electrumx.server.nito_private import PrivateAction
from electrumx.server import nito_orchard_index as index


def main():
    count = 4096
    blocks = [(0, bytes(32), [])]
    for i in range(count):
        height = i // 32 + 1
        if height == len(blocks):
            blocks.append((height, height.to_bytes(32, 'little'), []))
        value = (i + 1).to_bytes(32, 'little')
        blocks[-1][2].append(PrivateAction(height, value, i % 32 + 1, 0, 1,
                                           value, value, bytes(32), bytes(52), 0, bytes(32)))
    tracemalloc.start()
    with tempfile.TemporaryDirectory(prefix='nito-index-bench-') as temp:
        with plyvel.DB(str(Path(temp) / 'db'), create_if_missing=True) as db:
            start = time.monotonic()
            with db.write_batch(transaction=True, sync=True) as batch:
                index.write_private_index(db, batch, blocks, [], blocks[-1][0], 'regtest', bytes(32).hex())
            write_time = time.monotonic() - start

            class Reader:
                reads = 0

                def get(self, key):
                    self.reads += 1
                    return db.get(key)

                def iterator(self, **kwargs):
                    raise AssertionError('positional witness must not scan the DB')

            samples = []
            for position in (0, count//2, count-1):
                reader = Reader()
                start = time.monotonic()
                result = index.read_witness(reader, position)
                samples.append({'seconds': time.monotonic()-start, 'db_reads': reader.reads})
                assert len(result['auth_path']) == 32 and reader.reads <= 70
            peak = tracemalloc.get_traced_memory()[1]
        size = sum(p.stat().st_size for p in Path(temp).rglob('*') if p.is_file())
    print(json.dumps({'actions': count, 'write_seconds': write_time, 'witnesses': samples,
                      'python_peak_bytes': peak, 'disk_bytes': size,
                      'scope': 'synthetic index; excludes native RSS and production-scale sync'}, indent=2))


if __name__ == '__main__':
    main()
