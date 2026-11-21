"""Version 2 public index. All writes share the transparent UTXO batch.

Only complete Orchard subtrees are persisted. Appends and witnesses use at
most 32 hashes; rollback deletes a suffix, without rebuilding chain history.
Readers must hold the DB private lock for the duration of a response.
"""
import json
from dataclasses import replace

from electrumx.lib.hash import hash_to_hex_str
from electrumx.lib.orchard import orchard
from electrumx.server.nito_private import (
    ACTION_PREFIX, NULLIFIER_PREFIX, COMMITMENT_PREFIX, STATE_KEY,
    action_key, action_to_rpc, serialize_action, deserialize_action,
    pack_u32, pack_u64, unpack_u32,
)

SCHEMA_KEY = b'OV'
STATE = b'OS'
BLOCK = b'OB'
NODE = b'ON'
REPAIR_ACTIVE = b'OR'
REPAIR_DONE = b'OD'
SCHEMA = b'2'
MAX_BLOCKS = 1000
MAX_ACTIONS = 2000
INDEX_PREFIXES = (ACTION_PREFIX, NULLIFIER_PREFIX, COMMITMENT_PREFIX, BLOCK, NODE)


def encode(value):
    return json.dumps(value, separators=(',', ':')).encode('ascii')


def node_key(level, index):
    return NODE + bytes([level]) + pack_u64(index)


def has_index_data(storage):
    if any(storage.get(key) is not None for key in (SCHEMA_KEY, STATE_KEY, STATE)):
        return True
    return any(next(storage.iterator(prefix=prefix), None) is not None
               for prefix in INDEX_PREFIXES)


def check_schema(storage, db_height=-1):
    version = storage.get(SCHEMA_KEY)
    if version != SCHEMA and has_index_data(storage):
        raise ValueError('Orchard index schema 2 requires an Orchard-only repair')
    return version == SCHEMA


def delete_index(storage, batch):
    '''Delete only Orchard-owned keys, preserving transparent history/UTXOs.'''
    for key in (SCHEMA_KEY, STATE_KEY, STATE, REPAIR_ACTIVE):
        batch.delete(key)
    for prefix in INDEX_PREFIXES:
        for key, _value in storage.iterator(prefix=prefix):
            batch.delete(key)


def base_state(activation_height, block_hash, network, genesis_hash):
    base_height = activation_height - 1
    if base_height >= 0:
        if block_hash is not None and (
                not isinstance(block_hash, bytes) or len(block_hash) != 32):
            raise ValueError('Orchard activation checkpoint hash is required')
        block_hash = hash_to_hex_str(block_hash) if block_hash is not None else None
    else:
        block_hash = None
    return {
        'height': base_height,
        'block_hash': block_hash,
        'previous_block_hash': None,
        'action_count': 0,
        'orchard_root': orchard().root([]).hex(),
        'api_version': 2,
        'network': network,
        'genesis_hash': genesis_hash,
        'tree': 'orchard',
        'hash': 'sinsemilla',
        'depth': 32,
        'commitment_encoding': 'raw-le',
        'available': True,
        'activation_height': activation_height,
    }


def initialize_index(storage, activation_height, block_hash, network, genesis_hash):
    '''Create the empty activation checkpoint in its own durable batch.'''
    if has_index_data(storage):
        raise ValueError('Orchard index is not empty')
    state = base_state(activation_height, block_hash, network, genesis_hash)
    with storage.write_batch(transaction=True, sync=True) as batch:
        batch.put(SCHEMA_KEY, SCHEMA)
        batch.put(STATE, encode(state))
        if state['height'] >= 0:
            batch.put(BLOCK + pack_u32(state['height']), encode({
                key: state[key] for key in (
                    'height', 'block_hash', 'previous_block_hash',
                    'action_count', 'orchard_root')
            }))
    return state


def read_state(storage):
    check_schema(storage)
    raw = storage.get(STATE)
    if raw is None:
        raise ValueError('private index unavailable: initial block not indexed')
    return json.loads(raw)


def subtree(get, level, index, count):
    start = index << level
    if start >= count:
        return orchard().empty(level)
    if start + (1 << level) <= count:
        value = get(node_key(level, index))
        if value is None or len(value) != 32:
            raise ValueError('missing Orchard subtree; rebuild index')
        return value
    return orchard().combine(level - 1,
                             subtree(get, level - 1, index * 2, count),
                             subtree(get, level - 1, index * 2 + 1, count))


def write_private_index(storage, batch, blocks, delete_heights, target_height,
                        network, genesis_hash, activation_height=0,
                        base_hash=None):
    check_schema(storage)
    old = json.loads(storage.get(STATE)) if storage.get(STATE) else None
    initialize = old is None
    if initialize:
        old = base_state(activation_height, base_hash, network, genesis_hash)
    if old and (old['network'] != network or old['genesis_hash'] != genesis_hash):
        raise ValueError('private index network mismatch')
    if old.get('activation_height', activation_height) != activation_height:
        raise ValueError('private index activation height mismatch')
    old_height = old['height'] if old else -1
    count = old['action_count'] if old else 0
    # A bounded overlay is necessary because LevelDB batches cannot read writes.
    overlay = {}

    def put(key, value):
        batch.put(key, value)
        overlay[key] = value

    def delete(key):
        batch.delete(key)
        overlay[key] = None

    def get(key):
        return overlay[key] if key in overlay else storage.get(key)

    if initialize:
        put(SCHEMA_KEY, SCHEMA)
        put(STATE, encode(old))
        if old_height >= 0:
            put(BLOCK + pack_u32(old_height), encode({
                key: old[key] for key in (
                    'height', 'block_hash', 'previous_block_hash',
                    'action_count', 'orchard_root')
            }))
    elif (old_height == activation_height - 1
          and old.get('block_hash') is None and target_height >= old_height):
        if not isinstance(base_hash, bytes) or len(base_hash) != 32:
            raise ValueError('Orchard activation checkpoint hash is required')
        old = dict(old, block_hash=hash_to_hex_str(base_hash))
        put(STATE, encode(old))
        put(BLOCK + pack_u32(old_height), encode({
            key: old[key] for key in (
                'height', 'block_hash', 'previous_block_hash',
                'action_count', 'orchard_root')
        }))

    if delete_heights:
        expected = list(range(old_height, target_height, -1))
        if blocks or sorted(set(delete_heights), reverse=True) != expected:
            raise ValueError('rollback must remove the complete indexed suffix')
        if target_height < 0:
            raise ValueError('cannot roll back genesis')
        previous = storage.get(BLOCK + pack_u32(target_height))
        if previous is None:
            raise ValueError('missing rollback checkpoint')
        checkpoint = json.loads(previous)
        new_count = checkpoint['action_count']
        for height in expected:
            for key, raw in storage.iterator(prefix=ACTION_PREFIX + pack_u32(height)):
                action = deserialize_action(raw)
                delete(key)
                delete(NULLIFIER_PREFIX + action.nullifier)
                delete(COMMITMENT_PREFIX + action.cmx + pack_u64(action.commitment_index))
            delete(BLOCK + pack_u32(height))
        # Delete only nodes that existed: O(removed actions + depth).
        for level in range(33):
            for index in range(new_count >> level, count >> level):
                delete(node_key(level, index))
        count = new_count
        state = dict(old, **checkpoint)
        if subtree(get, 32, 0, count).hex() != state['orchard_root']:
            raise ValueError('rollback root mismatch')
    else:
        state = old
        for height, block_hash, actions in blocks:
            if height != old_height + 1 or len(block_hash) != 32:
                raise ValueError('private blocks must be contiguous, including empty blocks')
            if height < activation_height:
                raise ValueError('private block precedes Orchard activation')
            if height == 0 and hash_to_hex_str(block_hash) != genesis_hash:
                raise ValueError('genesis hash mismatch')
            last_position = (-1, -1)
            for action in actions:
                position = (action.tx_position, action.action_position)
                if action.height != height or position <= last_position:
                    raise ValueError('invalid action order')
                last_position = position
                if count >= 2**32:
                    raise ValueError('Orchard tree full')
                if get(NULLIFIER_PREFIX + action.nullifier) is not None:
                    raise ValueError('duplicate private nullifier')
                action = replace(action, commitment_index=count)
                key = action_key(action)
                put(key, serialize_action(action))
                put(NULLIFIER_PREFIX + action.nullifier, key)
                put(COMMITMENT_PREFIX + action.cmx + pack_u64(count), pack_u64(count))
                node = action.cmx
                index = count
                put(node_key(0, index), node)
                for level in range(32):
                    if not index & 1:
                        break
                    left = get(node_key(level, index - 1))
                    if left is None:
                        raise ValueError('missing left Orchard node')
                    node = orchard().combine(level, left, node)
                    index >>= 1
                    put(node_key(level + 1, index), node)
                count += 1
            checkpoint = {'height': height, 'block_hash': hash_to_hex_str(block_hash),
                          'previous_block_hash': state['block_hash'] if state else None,
                          'action_count': count,
                          'orchard_root': state['orchard_root'] if state and not actions else subtree(get, 32, 0, count).hex()}
            put(BLOCK + pack_u32(height), encode(checkpoint))
            state = dict(checkpoint, api_version=2, network=network, genesis_hash=genesis_hash,
                         tree='orchard', hash='sinsemilla', depth=32,
                         commitment_encoding='raw-le', available=True,
                         activation_height=activation_height)
            old_height = height
        if state is None or state['height'] != target_height:
            raise ValueError('private index target height mismatch')
    put(SCHEMA_KEY, SCHEMA)
    put(STATE, encode(state))
    # The caller clears queues only after the batch commits successfully.


def context(storage, expected_tip=None):
    state = read_state(storage)
    if expected_tip is not None and expected_tip != state['block_hash']:
        raise ValueError('stale index tip; restart request from get_state')
    return state


def read_compact_range(storage, start_height, count, expected_tip=None):
    if type(start_height) is not int or type(count) is not int or start_height < 0 or not 1 <= count <= MAX_BLOCKS:
        raise ValueError('start_height must be non-negative and count must be 1..1000')
    state = context(storage, expected_tip)
    activation = state.get('activation_height', 0)
    if start_height < activation:
        raise ValueError(f'start height precedes Orchard activation at {activation}')
    if start_height > state['height'] + 1:
        raise ValueError('start height exceeds indexed tip')
    end = min(start_height + count, state['height'] + 1)
    blocks, used = [], 0
    next_height = start_height
    for height in range(start_height, end):
        raw = storage.get(BLOCK + pack_u32(height))
        if raw is None:
            raise ValueError('missing private block checkpoint')
        actions = []
        for _, value in storage.iterator(prefix=ACTION_PREFIX + pack_u32(height)):
            actions.append(action_to_rpc(deserialize_action(value)))
            if len(actions) > MAX_ACTIONS:
                raise ValueError('block exceeds response limit; fetch and verify raw block')
        if blocks and used + len(actions) > MAX_ACTIONS:
            break
        blocks.append(dict(json.loads(raw), actions=actions))
        used += len(actions)
        next_height = height + 1
    return dict(state, start_height=start_height, count=len(blocks), next_height=next_height,
                more=next_height <= state['height'], blocks=blocks)


def read_nullifiers(storage, nullifiers, expected_tip=None):
    if len(nullifiers) > 4096 or any(len(nf) != 32 for nf in nullifiers):
        raise ValueError('invalid nullifier query')
    state = context(storage, expected_tip)
    result = {}
    for nf in nullifiers:
        key = storage.get(NULLIFIER_PREFIX + nf)
        if key is None:
            result[nf.hex()] = {'spent': False}
        else:
            raw = storage.get(key)
            if raw is None:
                raise ValueError('missing nullifier action')
            a = deserialize_action(raw)
            result[nf.hex()] = {'spent': True, 'height': a.height, 'txid': hash_to_hex_str(a.tx_hash)}
    return dict(state, nullifiers=result)


def read_witness(storage, commitment, expected_tip=None):
    state = context(storage, expected_tip)
    if isinstance(commitment, bytes):
        if len(commitment) != 32:
            raise ValueError('invalid cmx')
        matches = iter(storage.iterator(prefix=COMMITMENT_PREFIX + commitment))
        first = next(matches, None)
        second = next(matches, None)
        if first is None:
            raise ValueError('unknown commitment')
        if second is not None:
            raise ValueError('ambiguous commitment; request its position')
        commitment = int.from_bytes(first[1], 'big')
    if type(commitment) is not int or not 0 <= commitment < state['action_count']:
        raise ValueError('commitment index out of range')
    path = [subtree(storage.get, level, (commitment >> level) ^ 1, state['action_count']) for level in range(32)]
    cmx = subtree(storage.get, 0, commitment, state['action_count'])
    orchard().verify(cmx, commitment, path, bytes.fromhex(state['orchard_root']))
    return dict(state, commitment_index=commitment, cmx=cmx.hex(),
                auth_path=[node.hex() for node in path], spend_compatible=True)
