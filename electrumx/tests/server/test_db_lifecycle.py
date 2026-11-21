from threading import RLock
import logging
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

import pytest

from electrumx.server.db import DB
from electrumx.server import nito_orchard_index


def _legacy_utxo_state(version):
    return repr({
        'genesis': '00' * 32,
        'height': 123,
        'tx_count': 456,
        'tip': b'\x11' * 32,
        'utxo_flush_count': 7,
        'wall_time': 8,
        'first_sync': False,
        'db_version': version,
    }).encode()


def test_version_8_transparent_db_is_upgraded_in_place():
    db = object.__new__(DB)
    db.utxo_db = MagicMock()
    db.utxo_db.get.return_value = _legacy_utxo_state(8)
    db.utxo_db.for_sync = False
    db.coin = SimpleNamespace(GENESIS_HASH='00' * 32, NAME='Nito', NET='mainnet')
    db.logger = Mock()
    db.upgrade_db = Mock()

    db.read_utxo_state()

    assert db.db_height == 123
    assert db.db_tip == b'\x11' * 32
    db.upgrade_db.assert_called_once_with()


def test_unsupported_transparent_db_version_is_still_rejected():
    db = object.__new__(DB)
    db.utxo_db = Mock()
    db.utxo_db.get.return_value = _legacy_utxo_state(5)
    db.coin = SimpleNamespace(GENESIS_HASH='00' * 32)

    with pytest.raises(DB.DBError, match='version is 5'):
        db.read_utxo_state()


def test_version_8_upgrade_only_bumps_state_metadata():
    db = object.__new__(DB)
    db.db_version = 8
    db.logger = Mock()
    db.utxo_db = MagicMock()
    batch = db.utxo_db.write_batch.return_value.__enter__.return_value
    db.write_utxo_state = Mock()

    db.upgrade_db()

    assert db.db_version == 9
    db.write_utxo_state.assert_called_once_with(batch)
    db.utxo_db.iterator.assert_not_called()


def test_partial_open_releases_utxo_handle_even_if_history_close_fails():
    db = object.__new__(DB)
    db.private_lock = RLock()
    db.history = Mock()
    db.history.close_db.side_effect = OSError('history close failed')
    utxo = db.utxo_db = Mock()
    with pytest.raises(OSError, match='history close failed'):
        db.close()
    utxo.close.assert_called_once_with()
    assert db.utxo_db is None


def test_close_after_failed_open_without_utxo():
    db = object.__new__(DB)
    db.private_lock = RLock()
    db.history = Mock()
    db.utxo_db = None
    db.close()
    db.history.close_db.assert_called_once_with()


def test_core_v3_transparent_mode_does_not_load_orchard(monkeypatch):
    db = object.__new__(DB)
    db.coin = SimpleNamespace(NAME='Nito')
    db.logger = logging.getLogger('test')
    db.private_capability = {
        'mode': 'transparent', 'available': False,
        'reason': 'daemon exposes no Orchard capability fields'}
    db.private_needs_repair = True
    monkeypatch.setattr(nito_orchard_index, 'orchard',
                        Mock(side_effect=AssertionError('must not load Rust')))
    db._prepare_private_index()
    assert not db.private_enabled
    assert not db.private_needs_repair
