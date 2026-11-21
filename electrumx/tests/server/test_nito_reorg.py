from types import SimpleNamespace
import logging
import pytest
from electrumx.server.block_processor import BlockProcessor, ChainError
from electrumx.server.daemon import DaemonError
from electrumx.server import nito_orchard_index


@pytest.mark.asyncio
@pytest.mark.parametrize('height,daemon_height,common', [(10, 8, 8), (10, 10, 9), (10, 10, 0), (101, 120, 50), (1, 0, 0)])
async def test_common_prefix(height, daemon_height, common):
    async def remote_height():
        return daemon_height

    async def local_hashes(start, count):
        assert count == 1
        return [start.to_bytes(32, 'little')]

    async def remote_hashes(start, count):
        assert count == 1 and start <= daemon_height
        value = start if start <= common else start + 1000
        return [value.to_bytes(32, 'big').hex()]

    bp = SimpleNamespace(height=height, coin=SimpleNamespace(NAME='Nito', GENESIS_HASH='00'*32),
                         db=SimpleNamespace(fs_block_hashes=local_hashes),
                         daemon=SimpleNamespace(height=remote_height, block_hex_hashes=remote_hashes))
    assert await BlockProcessor.calc_reorg_range(bp, None) == (common + 1, height - common)


@pytest.mark.asyncio
async def test_orchard_repair_reports_pruned_missing_block(monkeypatch):
    state = {'height': 0, 'block_hash': '00' * 32}
    monkeypatch.setattr(nito_orchard_index, 'read_state', lambda _db: state)

    async def height():
        return 2

    async def hashes(start, count):
        return ['00' * 32 for _height in range(start, start + count)]

    async def raw_blocks(_hashes):
        raise DaemonError({'code': -1, 'message': 'Block not available (pruned data)'})

    async def local_hashes(_start, count):
        return [bytes(32)] * count

    db = SimpleNamespace(
        private_enabled=True, private_needs_repair=True,
        private_activation_height=1, db_height=2, utxo_db=object(),
        fs_block_hashes=local_hashes, DBError=RuntimeError)
    daemon = SimpleNamespace(height=height, block_hex_hashes=hashes,
                             raw_blocks=raw_blocks)
    bp = SimpleNamespace(db=db, daemon=daemon, coin=object(),
                         logger=logging.getLogger('test'))
    with pytest.raises(RuntimeError, match='pruned or missing historical blocks'):
        await BlockProcessor._repair_private_index(bp)
