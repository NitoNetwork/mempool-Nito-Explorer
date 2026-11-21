# Copyright (c) 2026, the ElectrumX-NITO authors
#
# All rights reserved.
#
# See the file "LICENCE" for information about the copyright
# and warranty status of this software.

'''Compact public index for Nito v4 private actions.

The index stores only public compact action data needed by light clients.
Seeds, spending keys and full viewing keys must stay client-side.
'''

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple, Union

from electrumx.lib.hash import hash_to_hex_str
from electrumx.lib.util import pack_varbytes


ACTION_PREFIX = b'QB'
NULLIFIER_PREFIX = b'QN'
COMMITMENT_PREFIX = b'QC'
STATE_KEY = b'QS'

@dataclass(frozen=True, slots=True)
class PrivateAction:
    height: int
    tx_hash: bytes
    tx_position: int
    action_position: int
    action_version: int
    nullifier: bytes
    cmx: bytes
    ephemeral_key: bytes
    compact_ciphertext: bytes
    view_tag: int
    anchor: bytes
    commitment_index: Optional[int] = None


def pack_u16(value: int) -> bytes:
    return value.to_bytes(2, 'big')


def pack_u32(value: int) -> bytes:
    return value.to_bytes(4, 'big')


def pack_u64(value: int) -> bytes:
    return value.to_bytes(8, 'big')


def unpack_u16(raw: bytes) -> int:
    return int.from_bytes(raw, 'big')


def unpack_u32(raw: bytes) -> int:
    return int.from_bytes(raw, 'big')


def unpack_u64(raw: bytes) -> int:
    return int.from_bytes(raw, 'big')


def _read_varint(raw: bytes, offset: int) -> Tuple[int, int]:
    n = raw[offset]
    offset += 1
    if n < 253:
        return n, offset
    if n == 253:
        return int.from_bytes(raw[offset:offset + 2], 'little'), offset + 2
    if n == 254:
        return int.from_bytes(raw[offset:offset + 4], 'little'), offset + 4
    return int.from_bytes(raw[offset:offset + 8], 'little'), offset + 8


def _read_varbytes(raw: bytes, offset: int) -> Tuple[bytes, int]:
    size, offset = _read_varint(raw, offset)
    end = offset + size
    return raw[offset:end], end


def action_key(action: PrivateAction) -> bytes:
    return (ACTION_PREFIX + pack_u32(action.height) +
            pack_u32(action.tx_position) + pack_u16(action.action_position))


def serialize_action(action: PrivateAction) -> bytes:
    assert action.commitment_index is not None
    header = (
        pack_u32(action.height) +
        pack_u32(action.tx_position) +
        pack_u16(action.action_position) +
        pack_u64(action.commitment_index) +
        bytes([action.action_version, action.view_tag]) +
        action.tx_hash +
        action.nullifier +
        action.cmx +
        action.anchor
    )
    return header + pack_varbytes(action.ephemeral_key) + pack_varbytes(action.compact_ciphertext)


def deserialize_action(raw: bytes) -> PrivateAction:
    if len(raw) != 234:
        raise ValueError('invalid stored Nito action length')
    offset = 0
    height = unpack_u32(raw[offset:offset + 4])
    offset += 4
    tx_position = unpack_u32(raw[offset:offset + 4])
    offset += 4
    action_position = unpack_u16(raw[offset:offset + 2])
    offset += 2
    commitment_index = unpack_u64(raw[offset:offset + 8])
    offset += 8
    action_version = raw[offset]
    view_tag = raw[offset + 1]
    offset += 2
    tx_hash = raw[offset:offset + 32]
    offset += 32
    nullifier = raw[offset:offset + 32]
    offset += 32
    cmx = raw[offset:offset + 32]
    offset += 32
    anchor = raw[offset:offset + 32]
    offset += 32
    ephemeral_key, offset = _read_varbytes(raw, offset)
    compact_ciphertext, offset = _read_varbytes(raw, offset)
    if offset != len(raw) or len(ephemeral_key) != 32 or len(compact_ciphertext) != 52 or action_version != 1:
        raise ValueError('trailing bytes in Nito private action')
    return PrivateAction(
        height=height,
        tx_hash=tx_hash,
        tx_position=tx_position,
        action_position=action_position,
        action_version=action_version,
        nullifier=nullifier,
        cmx=cmx,
        ephemeral_key=ephemeral_key,
        compact_ciphertext=compact_ciphertext,
        view_tag=view_tag,
        anchor=anchor,
        commitment_index=commitment_index,
    )


def action_to_rpc(action: PrivateAction) -> Dict[str, Union[int, str]]:
    return {
        'height': action.height,
        'txid': hash_to_hex_str(action.tx_hash),
        'tx_position': action.tx_position,
        'action_position': action.action_position,
        'commitment_index': action.commitment_index,
        'action_version': action.action_version,
        'nullifier': action.nullifier.hex(),
        'cmx': action.cmx.hex(),
        'ephemeral_key': action.ephemeral_key.hex(),
        'compact_ciphertext': action.compact_ciphertext.hex(),
        'view_tag': action.view_tag,
        'anchor': action.anchor.hex(),
    }


def collect_block_actions(height: int, txs: Sequence) -> List[PrivateAction]:
    actions = []
    for tx_position, tx in enumerate(txs):
        private_effects = getattr(tx, 'private_effects', None)
        if not private_effects:
            continue
        for action_position, action in enumerate(private_effects.actions):
            actions.append(PrivateAction(
                height=height,
                tx_hash=tx.txid,
                tx_position=tx_position,
                action_position=action_position,
                action_version=action.version,
                nullifier=action.nullifier,
                cmx=action.cmx,
                ephemeral_key=action.ephemeral_key,
                compact_ciphertext=action.compact_ciphertext,
                view_tag=action.view_tag,
                anchor=private_effects.anchor,
            ))
    return actions
