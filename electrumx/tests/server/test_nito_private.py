import os
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import pytest
import plyvel
from electrumx.lib.orchard import orchard
from electrumx.server import nito_orchard_index as index
from electrumx.server.session import ElectrumX
from electrumx.server.nito_private import PrivateAction

LIBRARY = os.environ.get('NITO_ORCHARD_LIBRARY')
pytestmark = pytest.mark.skipif(not LIBRARY, reason='pinned native Orchard library required')
GENESIS = bytes(32).hex()


@pytest.fixture(autouse=True)
def native_library(monkeypatch):
    # The legacy env suite clears os.environ; restore this fixture explicitly.
    monkeypatch.setenv('NITO_ORCHARD_LIBRARY', LIBRARY)


def action(height, seed):
    return PrivateAction(height, bytes([seed]) * 32, 1, 0, 1, bytes([seed]) * 32,
                         seed.to_bytes(32, 'little'), bytes(32), bytes(52), 0, bytes(32))


def write(db, blocks, deletes=(), target=None, activation=0, base_hash=None):
    if target is None:
        target = blocks[-1][0]
    with db.write_batch(transaction=True, sync=True) as batch:
        index.write_private_index(db, batch, blocks, list(deletes), target,
                                  'regtest', GENESIS, activation, base_hash)


def test_real_leveldb_roots_pagination_restart_and_rollback(tmp_path):
    path = str(tmp_path / 'db')
    db = plyvel.DB(path, create_if_missing=True)
    leaves = []
    for height in range(19):
        actions = [action(height, height)] if height else []
        write(db, [(height, bytes([height]) * 32, actions)])
        leaves += [a.cmx for a in actions]
        assert index.read_state(db)['orchard_root'] == orchard().root(leaves).hex()
        for i in range(len(leaves)):
            w = index.read_witness(db, i)
            orchard().verify(leaves[i], i, list(map(bytes.fromhex, w['auth_path'])), bytes.fromhex(w['orchard_root']))
    db.close()
    db = plyvel.DB(path)
    try:
        tip = index.read_state(db)['block_hash']
        page = index.read_compact_range(db, 0, 3, tip)
        assert [b['height'] for b in page['blocks']] == [0, 1, 2]
        assert page['blocks'][0]['actions'] == []
        assert page['next_height'] == 3
        assert index.read_compact_range(db, 18, 10)['next_height'] == 19
        with pytest.raises(ValueError, match='stale'):
            index.read_witness(db, 0, 'ff' * 32)
        before = dict(db)
        with pytest.raises(ValueError):
            write(db, [(19, bytes([19]) * 32, [action(19, 19)]), (21, bytes(32), [])])
        assert dict(db) == before
        for height in range(18, 0, -1):
            write(db, [], [height], height - 1)
            leaves.pop()
            assert index.read_state(db)['orchard_root'] == orchard().root(leaves).hex()
            nf = action(height, height).nullifier
            assert not index.read_nullifiers(db, [nf])['nullifiers'][nf.hex()]['spent']
        write(db, [(1, bytes([99]) * 32, [action(1, 44)])])
        assert index.read_witness(db, 0)['cmx'] == action(1, 44).cmx.hex()
        assert index.read_state(db)['orchard_root'] == orchard().root([action(1, 44).cmx]).hex()
    finally:
        db.close()


def test_compact_restore_can_start_at_activation_and_page(tmp_path):
    activation = 2
    with plyvel.DB(str(tmp_path / 'db'), create_if_missing=True) as db:
        base_hash = bytes([1]) * 32
        index.initialize_index(db, activation, base_hash, 'regtest', GENESIS)
        write(db, [
            (activation, bytes([2]) * 32, [action(activation, 7)]),
            (3, bytes([3]) * 32, []),
        ], activation=activation)
        assert index.read_state(db)['activation_height'] == activation
        with pytest.raises(ValueError, match='precedes Orchard activation'):
            index.read_compact_range(db, activation - 1, 1)
        first = index.read_compact_range(db, activation, 1)
        assert [block['height'] for block in first['blocks']] == [activation]
        assert len(first['blocks'][0]['actions']) == 1
        assert first['next_height'] == 3
        second = index.read_compact_range(db, first['next_height'], 1)
        assert [block['height'] for block in second['blocks']] == [3]
        assert second['next_height'] == 4


def test_empty_activation_checkpoint_needs_no_genesis_replay(tmp_path):
    activation = 5
    base_hash = bytes([4]) * 32
    with plyvel.DB(str(tmp_path / 'db'), create_if_missing=True) as db:
        with db.write_batch(transaction=True, sync=True) as batch:
            index.write_private_index(
                db, batch, [], [], activation - 1, 'regtest', GENESIS,
                activation, base_hash)
        state = index.read_state(db)
        assert state['height'] == activation - 1
        assert state['block_hash'] == base_hash[::-1].hex()
        assert state['action_count'] == 0
        assert not list(db.iterator(prefix=index.ACTION_PREFIX))


def test_pending_activation_checkpoint_is_bound_without_replay(tmp_path):
    activation = 5
    base_hash = bytes([4]) * 32
    with plyvel.DB(str(tmp_path / 'db'), create_if_missing=True) as db:
        index.initialize_index(db, activation, None, 'regtest', GENESIS)
        assert index.read_state(db)['height'] == activation - 1
        assert index.read_state(db)['block_hash'] is None
        with db.write_batch(transaction=True, sync=True) as batch:
            index.write_private_index(
                db, batch, [], [], activation - 1, 'regtest', GENESIS,
                activation, base_hash)
        state = index.read_state(db)
        assert state['block_hash'] == base_hash[::-1].hex()
        assert state['action_count'] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(('daemon_height', 'synced'), ((3, True), (4, False)))
async def test_pending_activation_checkpoint_sync_status(daemon_height, synced):
    session = object.__new__(ElectrumX)
    session.bump_cost = Mock()
    session.db = SimpleNamespace(nito_private_state=AsyncMock(return_value={
        'height': 4,
        'block_hash': None,
        'activation_height': 5,
    }))
    session.session_mgr = SimpleNamespace(
        daemon=SimpleNamespace(cached_height=Mock(return_value=daemon_height)))

    state = await session.nito_private_get_state()

    assert state['daemon_height'] == daemon_height
    assert state['synced'] is synced


def test_migration_and_no_gaps(tmp_path):
    with plyvel.DB(str(tmp_path / 'db'), create_if_missing=True) as db:
        assert index.check_schema(db, 100) is False
        with pytest.raises(ValueError, match='contiguous'):
            write(db, [(5, bytes(32), [])])
        assert not index.has_index_data(db)
        write(db, [(0, bytes(32), [])])
        with pytest.raises(ValueError, match='network'):
            with db.write_batch(transaction=True) as batch:
                index.write_private_index(db, batch, [(1, bytes(32), [])], [], 1, 'mainnet', GENESIS)


def test_orchard_only_reset_preserves_transparent_keys_and_resumes(tmp_path):
    path = str(tmp_path / 'db')
    with plyvel.DB(path, create_if_missing=True) as db:
        transparent = {b'state': b'transparent-state', b'u-wallet': b'utxo', b'h-tx': b'hashx'}
        for key, value in transparent.items():
            db.put(key, value)
        db.put(index.SCHEMA_KEY, b'1')
        db.put(b'QB-old', b'legacy-action')
        with pytest.raises(ValueError, match='Orchard-only repair'):
            index.check_schema(db, 50)
        with db.write_batch(transaction=True, sync=True) as batch:
            index.delete_index(db, batch)
        assert {key: db.get(key) for key in transparent} == transparent
        activation = 5
        base_hash = bytes([4]) * 32
        index.initialize_index(db, activation, base_hash, 'regtest', GENESIS)
        write(db, [(5, bytes([5]) * 32, [action(5, 5)]),
                   (6, bytes([6]) * 32, [])], activation=activation)
    with plyvel.DB(path) as db:
        assert index.read_state(db)['height'] == 6
        write(db, [(7, bytes([7]) * 32, [action(7, 7)])], activation=5)
        assert index.read_state(db)['height'] == 7
        assert index.read_state(db)['action_count'] == 2
        assert {key: db.get(key) for key in transparent} == transparent


def test_multi_block_batch_and_empty_reorg(tmp_path):
    with plyvel.DB(str(tmp_path / 'db'), create_if_missing=True) as db:
        a = action(1, 7)
        write(db, [(0, bytes(32), []), (1, bytes([1])*32, [a]), (2, bytes([2])*32, [])])
        assert index.read_state(db)['action_count'] == 1
        write(db, [], [2], 1)
        assert index.read_witness(db, a.cmx)['commitment_index'] == 0
        with pytest.raises(ValueError, match='suffix'):
            write(db, [], [0], 0)


def test_limits_duplicate_cmx_and_lagged_nullifier_state(tmp_path):
    with plyvel.DB(str(tmp_path / 'db'), create_if_missing=True) as db:
        a = action(1, 7)
        b = replace(action(2, 8), cmx=a.cmx)
        write(db, [(0, bytes(32), []), (1, bytes([1])*32, [a])])
        lagged = index.read_nullifiers(db, [b.nullifier])
        assert lagged['height'] == 1 and not lagged['nullifiers'][b.nullifier.hex()]['spent']
        write(db, [(2, bytes([2])*32, [b])])
        assert index.read_witness(db, 0)['cmx'] == index.read_witness(db, 1)['cmx']
        with pytest.raises(ValueError, match='ambiguous'):
            index.read_witness(db, a.cmx)
        write(db, [], [2], 1)
        assert index.read_witness(db, a.cmx)['commitment_index'] == 0
        for start, count in ((0, 1001), (0, 0), (-1, 1), (True, 1), (0, 1.5), (3, 1)):
            with pytest.raises(ValueError):
                index.read_compact_range(db, start, count)
        with pytest.raises(ValueError):
            index.read_nullifiers(db, [bytes(32)]*4097)
        with pytest.raises(ValueError):
            index.read_witness(db, True)
