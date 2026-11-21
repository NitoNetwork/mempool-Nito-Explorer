import pytest
from electrumx.lib.tx import DeserializerNitoV4, SkipTxDeserialize
from electrumx.lib.hash import double_sha256
from electrumx.lib.util import pack_varbytes as vb


def private_tx(flag=6):
    effects = bytes.fromhex('0100000003') + bytes(40) + b'\x01\x01' + bytes(128) + vb(bytes(32)) + vb(bytes(580)) + vb(bytes(80))
    auth = b'\x01' + vb(bytes(64)) + vb(bytes(4992)) + vb(bytes(64))
    return bytes.fromhex('0200000000') + bytes([flag]) + bytes(2) + effects + (auth if flag & 4 else b'') + bytes(4)


def test_every_truncation_and_offset_hashes():
    raw = private_tx()
    for end in range(len(raw)):
        with pytest.raises(SkipTxDeserialize):
            DeserializerNitoV4(raw[:end]).read_tx()
    d = DeserializerNitoV4(b'prefix' + raw + raw, 6)
    tx, size = d.read_tx_and_vsize()
    assert tx.wtxid == double_sha256(raw)
    assert tx.txid == double_sha256(private_tx(2))
    assert size == (len(raw) + 3 * len(private_tx(2)) + 3) // 4
    assert d.cursor == 6 + len(raw)
    assert d.read_tx().txid == tx.txid


@pytest.mark.parametrize('raw', [
    b'\x02\0\0\0\0\x08', b'\x02\0\0\0\0\x04', b'\x02\0\0\0\xfd\x01\0',
    b'\x02\0\0\0\0\x01\0\0' + bytes(4), private_tx()[:8] + b'\x02' + private_tx()[9:],
])
def test_rejects_unknown_noncanonical_and_superfluous(raw):
    with pytest.raises(SkipTxDeserialize):
        DeserializerNitoV4(raw).read_tx()
