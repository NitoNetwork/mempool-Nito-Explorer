# Nito V4 light-client protocol

The native Orchard builder targets Core
`1786d96b8c8d122c38cff570379039934922f7b2`. The Orchard FFI source is unchanged
between that revision and the currently qualified Core line.
Core source, its consensus constants and its locked cryptographic dependencies
define this contract. API version 2 and database schema 2 replace the previous
compact double-SHA256 index. No public service deployment is implied by this
source release.

## Installation and indexes

Use Python 3.12 for the qualified environment, LevelDB, a fully synchronized
archival Nito Core V4 node and a locally built Orchard shared library:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -e '.[test]'
python tools/build_orchard.py /path/to/core /path/to/orchard-build
export NITO_ORCHARD_LIBRARY=/path/to/orchard-build/target/release/libnito_orchard_ffi.so
export PYTHONPATH=src
pytest tests -q --asyncio-mode=auto
```

On Windows the library is `nito_orchard_ffi.dll`; on macOS it is
`libnito_orchard_ffi.dylib`. The builder reads the exact Git revision above,
exports only its Rust crate into a separate directory, changes only the library
output type to `cdylib, rlib`, and builds with `--locked` and two compilation
jobs. It records the input file hashes in `provenance.json`. No Core checkout
file or consensus dependency is changed. Keep this binary out of source Git.
Use an absolute library path because ElectrumX changes its working directory.

| Core setting | Requirement |
| --- | --- |
| `txindex=1` | Required for arbitrary historical raw transaction requests through the existing Electrum API. |
| `orchardindex` | Independent of this index. ElectrumX reconstructs public data from raw blocks. Qualification explicitly uses `orchardindex=0`. Core wallet recovery can require its own index. |
| `coinstatsindex=1` | Recommended for public pool accounting. Core can fall back to a UTXO scan without it; that fallback is expensive. |
| `prune=0` | Required for this supported configuration. Initial replay and deep recovery need historical blocks. Pruned operation is not qualified or advertised. |

Set `COIN=Nito`, `NET=mainnet`, `testnet`, `signet` or `regtest` and the
corresponding daemon. Genesis hashes distinguish networks; testnet and Signet
share the transparent address HRP but are different chains. Default Signet is
covered by the network definition; a custom challenge requires separate trust
configuration. Do not expose Core RPC or ElectrumX administrative RPC publicly.

Suggested bounded configuration: `CACHE_MB=256`, `MAX_SEND=2000000`,
`MAX_RECV=1000000`, `INITIAL_CONCURRENT=4`, `REQUEST_TIMEOUT=30`,
`RAYON_NUM_THREADS=2`, `ANON_LOGS=1`. Apply connection and bandwidth quotas at
the listener/reverse proxy. The server never generates Orchard proofs.

## Wire format and byte order

Transparent transactions retain their V3 format. Extended transactions use
`00` followed by flags: `01` transparent witness, `02` private effects,
`04` private authorization. Effects precede transparent witness; authorization
follows it; locktime is last. Private-only transactions may have empty vin and
vout. Effects have version 1, flags masked by 3, anchor, signed 64-bit value
balance and 1–50 actions. Each action has version 1, four 32-byte fields
`cv/nullifier/rk/cmx`, and CompactSize-prefixed 32/580/80-byte ciphertext fields.
Authorization has one 64-byte signature per action, a proof of
`2720 + 2272 * action_count` bytes, and a 64-byte binding signature.

The txid hashes serialization including effects and flag `02`, excluding both
kinds of authorization. The wtxid hashes all transaction bytes. Virtual size
is `ceil((3 * stripped_size + total_size) / 4)`. Canonical CompactSize,
truncation, unsupported versions/flags, superfluous witness records and size
inconsistencies are checked before indexing. This parser does not replace
Core's consensus, curve-point, proof or signature validation.

Block hashes and txids use conventional reversed display hex. Orchard fields
(`cmx`, nullifier, anchor and path elements) use raw 32-byte hex in the native
Orchard little-endian encoding. Do not reverse them as if they were RPC uint256
display strings. Compact ciphertext is the first 52 encrypted bytes; view tag
is its first byte XOR `02`. Action order is block transaction order followed
by action order; `commitment_index` is zero-based across the active chain.

## Version 2 RPC contract

All parameters are positional JSON-RPC parameters. No method takes an address,
seed, spending key or viewing key. Amounts are integer nitoshi, never binary
floating-point calculations; JavaScript clients must decode large JSON integers
without loss (for example, into BigInt using a lossless parser).

| Method | Parameters | Result |
| --- | --- | --- |
| `blockchain.nito.private.v2.get_state` | none | Index state plus observed daemon height and height-based `synced` indicator. |
| `blockchain.nito.private.v2.get_compact_range` | `start_height, count, expected_tip?` | Complete block records, including empty blocks, and `next_height`. |
| `blockchain.nito.private.v2.get_nullifiers` | `nullifiers, expected_tip?` | Public active-chain inclusion status keyed by raw nullifier hex. |
| `blockchain.nito.private.v2.get_witness` | `position_or_cmx, expected_tip?` | A real 32-level Orchard authentication path at the indexed tip. |
| `blockchain.nito.private.get_pools` | none | Core `getorchardpools` result. |
| `blockchain.nito.get_orchard_pools` | none | Alias of the same pool endpoint. |

Every private v2 result includes `api_version=2`, `network`, `genesis_hash`,
`height`, `block_hash`, `previous_block_hash`, `action_count`, `orchard_root`,
`tree="orchard"`, `hash="sinsemilla"`, `depth=32`,
`commitment_encoding="raw-le"`, and `available=true`. These identify one
committed database snapshot; the root is defined even for an empty tree.
Before initial synchronization an unavailable index produces an error, never a
fabricated empty history. `synced` compares heights only and is not proof of
network freshness or agreement with another node.

Ranges require non-negative integer height and integer `count` in 1–1000.
They return at most 2000 actions, stopping at a block boundary. If a single
block exceeds the cap the request fails explicitly; no partial block is
returned. Advance using `next_height`, not the requested count. `count` in the
response is the actual number of returned blocks; `more` indicates whether the
indexed snapshot contains further heights. At `height+1` a range is empty;
beyond that it is an error. Each block contains its hash, predecessor hash,
end-of-block root/count and ordered `actions`.

Nullifier queries accept at most 4096 fixed-length values. `spent=false` means
absent **through the response height**, not globally unspent. The mempool is
excluded. Wallet ownership of a public nullifier remains private.

A witness adds `commitment_index`, `cmx`, `auth_path` (leaf level first), and
`spend_compatible=true`. An ambiguous cmx lookup fails; use the position.
The witness root must equal the client's locally reconstructed tree at that
same block. The server offers current-tip witnesses, not arbitrary historical
anchors. A previously valid anchor can become invalid after a reorganization.

Pass the `block_hash` from `get_state` as `expected_tip` across a scan. Any tip
change, including normal growth, then returns a stale-tip error; obtain a new
state, check the saved height/hash against the active chain and resume or rewind.
This conservative token avoids mixing snapshots. RPC code 1 reports invalid,
unavailable or stale private requests; code 2 reports daemon failures. Existing
Electrum transport limits/rate accounting still apply. Errors never imply an
empty successful page. There are no private-state subscriptions in v2; clients
can use header subscriptions as a trigger to request state again.

The unversioned state/range/nullifier names are transitional aliases returning
v2 results. The old `private.get_witness` explicitly errors. The obsolete
`electrumx-compact-cmx-v1` / double-SHA256 proofs are neither served nor accepted
as Orchard witnesses.

## Persistence and migration

Schema 2 stores all block checkpoints, actions, nullifiers and complete Orchard
subtrees in the same atomic LevelDB batch as transparent UTXO state. Readers
hold the same lock across each response. Pending private queues are cleared
only after commit. Appends and witnesses use bounded tree-depth work instead
of loading the entire commitment history. Rollback removes the indexed suffix,
including empty-block checkpoints, nullifiers, cmx positions and subtrees.
An equal-height or shorter daemon tip is also checked without waiting for a
forward block. Uncommitted data is replayed after a restart.

Core capability is negotiated at startup, never inferred only from its version
string. ElectrumX first consumes `privateTxActivationHeight` and `activated`
from the lightweight `getblockchaininfo` response when present. Only when those
fields are both absent does it make one `getorchardpools` fallback request. A
daemon exposing neither capability is treated as Core v3. Core v3 opens the
existing database in transparent-only mode, does not load the Rust Orchard
library, and leaves all Orchard keys alone.

For Core v4, schema 2 can be added to an existing transparent database. The
empty Orchard tree is anchored at `activation_height - 1`. If the transparent
tip is still below that checkpoint, the schema is initialized immediately with
a pending null block hash and is reported synchronized; no transparent block is
replayed. At the checkpoint height it is temporarily unsynchronized until the
real active-chain hash is bound atomically, before any activation block is
indexed. Existing ElectrumX UTXO database version 8 is upgraded to version 9 by
an atomic metadata update only; live transparent `u`/`h` keys and history are
not rewritten.

If the transparent
tip is already beyond activation, ElectrumX fetches and parses only blocks from
activation through that tip, writing Orchard checkpoints in durable 50-block
batches. Transparent history, UTXOs, metadata and transaction files are not
rebuilt. A restart resumes from the last committed Orchard checkpoint.

An obsolete or incomplete Orchard schema triggers the same Orchard-only repair.
For an explicit operator reset, stop the service and start it once with a unique
non-empty `NITO_ORCHARD_REPAIR` token. Only `OV`, `OS`, `OR`, `QS` and the
`QB`/`QN`/`QC`/`OB`/`ON` Orchard key spaces are deleted; a completed token is
recorded so reopening the database does not repeat the reset. Keep the same token
after an interruption to resume from the last durable checkpoint, then remove
the environment variable after success.

Repair requires Core to retain every block from activation through the current
transparent tip. A missing historical block produces an explicit pruned/missing
block error and leaves the transparent database usable and unchanged. Point the
server at an archival Core or restore the missing block data, then restart.
Deleting the full ElectrumX database and replaying from genesis is a last-resort
corruption recovery procedure, not the normal V3-to-V4 migration path. LevelDB
is the qualified storage engine; RocksDB is not claimed as qualified.

## Client responsibilities and trust

The 80-byte Nito header contains the transaction Merkle root; it has no
dedicated Orchard root field. A transaction inclusion proof authenticates its
effects through txid, but does not by itself prove that a compact server has
provided every Orchard action in the chain. A consistently fabricated compact
history/root cannot be ruled out by checking only server-provided witnesses.

A client checks network/genesis, contiguous heights and positions, parent
hashes, local note commitments, local nullifiers, tree roots, path depth/order,
amount conservation and fees. It must validate headers/PoW against a trusted
checkpoint and verify relevant transaction inclusion proofs. To establish
history completeness independently it needs full relevant blocks/transaction
lists tied to those headers and replay of every action, or a separate trusted
checkpoint/source. Cross-checking independent servers detects some omissions
but is not a cryptographic completeness proof. Pool amounts are accounting
from the daemon, not wallet balances or header-authenticated supply proofs.

The external qualification clients perform local scanning, decryption, tree
replay, witness checks, transaction construction and reorg replay. They are not
part of this server repository. Their qualification uses a trusted local Core
and checks real transaction inclusion. A production wallet still needs its own
SPV/checkpoint and freshness policy.

Prefer downloading whole compact ranges and tracking their nullifiers locally
over querying only wallet-owned nullifiers or notes. Such selective queries,
timing and transaction broadcast can correlate users. Nito defaults to anonymous
connection logs; anonymous mode also omits broadcast txids/errors from session
logs. Do not enable request-body/access logging in a reverse proxy. Encryption
protects transport, not the server's observations.

## Server-only boundary

ElectrumX parses the public Orchard action encoding and stores only the public
fields required for compact synchronization, nullifier tracking, checkpoints
and witnesses. It never accepts or stores a seed, spending key, full viewing
key, decrypted note, decrypted private amount, wallet identifier, or ownership
association. Address encoding, trial decryption, balance calculation, note
selection, proof creation and signing belong to wallet implementations.

The server uses Core's pinned `nito_orchard_ffi` only for public Orchard tree
operations: Sinsemilla roots, subtree nodes and witness paths. No wallet
cryptographic API or browser artifact is part of this repository.

## Public accounting

Both pool aliases relay `getorchardpools` with a shared 10-second cache and
single-flight requests. Compare `blocks` **and** `bestblockhash` before combining
values with an index snapshot; retry after the cache expires if they differ.
The server checks integer types and the equation:

```text
transparent.chainValueNitoshi + orchard.chainValueNitoshi = total.chainValueNitoshi
```

This is confirmed live value, not necessarily theoretical cumulative issuance.
Unspendable genesis value, destroyed outputs and unclaimed rewards explain
differences. Mempool balances are separate.

## Reproducible server qualification

Run the focused parser, index, schema and reorganization tests before the full
suite. `tools/qualify_core_compat.py` exercises one transparent database across
real Core v3 and v4 processes. `tools/qualify_operations.py` compares an
Orchard-only schema migration and interrupted repair with a fresh Orchard index.
`tools/qualify_disk_full.py` and `tools/qualify_disk_service.py` exercise bounded
ENOSPC recovery. These tools contain no wallet keys, decryption or proof logic.

Transaction-level qualification uses externally produced, Core-accepted raw
fixtures. For a mixed transaction, verify both the unchanged standard Electrum
script history and the Orchard compact action/checkpoint written by the same
atomic block batch. Keep all runtime data and evidence outside source Git.
