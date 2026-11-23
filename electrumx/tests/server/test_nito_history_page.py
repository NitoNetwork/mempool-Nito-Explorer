from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from aiorpcx import RPCError

from electrumx.server.db import DB
from electrumx.server.session import ElectrumX


@pytest.mark.asyncio
async def test_long_history_pages_preserve_order_and_genesis():
    total = 19030
    db = SimpleNamespace(db_tip=b'tip', db_tx_count=total)
    db.history = SimpleNamespace(get_txnums=lambda *_: iter(range(total + 2)))
    db.fs_tx_hash = lambda tx_num: (tx_num.to_bytes(32, 'little'), tx_num // 2)

    async def read_page(hash_x, **kwargs):
        return await DB.history_page(db, hash_x, **kwargs)

    pending = [{'tx_hash': 'fe' * 32, 'height': 0, 'fee': 1}]
    session = SimpleNamespace(session_mgr=SimpleNamespace(db=SimpleNamespace(history_page=read_page)),
                              unconfirmed_history=AsyncMock(return_value=pending), bump_cost=Mock())
    received = []
    cursor = None
    while True:
        page = await ElectrumX.nito_scripthash_get_history_page(session, '00' * 32, cursor, 1000)
        assert page['total'] == total
        assert page['unconfirmed'] == (pending if cursor is None else [])
        received.extend(entry['cursor'] for entry in page['confirmed'])
        if not page['has_more']:
            assert page['cursor'] is None
            assert page['confirmed'][-1] == {'tx_hash': '00' * 32, 'height': 0, 'cursor': 0}
            break
        assert page['cursor'] == received[-1]
        cursor = page['cursor']
    assert received == list(range(total - 1, -1, -1))
    session.unconfirmed_history.assert_awaited_once()


@pytest.mark.asyncio
async def test_history_page_rejects_a_tip_change_and_boolean_cursor():
    db = SimpleNamespace(db_tip=b'tip', db_tx_count=1)
    db.history = SimpleNamespace(get_txnums=lambda *_: iter([0]))

    def read_hash(tx_num):
        db.db_tip = b'new tip'
        return b'\0' * 32, 0

    db.fs_tx_hash = read_hash
    assert await DB.history_page(db, b'script', limit=1) is None
    with pytest.raises(RPCError, match='cursor'):
        await ElectrumX.nito_scripthash_get_history_page(None, '00' * 32, True, 1)
