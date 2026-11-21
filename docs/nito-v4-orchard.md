# Nito Core V4 / Orchard integration

## Qualification and provenance

The public runtime compatibility reference is Nito Core
`1d81bbd5f79d6b857c80420d5c81915ea326adff` on the public `v4.0` branch.
The exact ElectrumX revision is recorded in `electrumx-provenance.json`; the
imported reference is `150995da1b3c4daa66f3c2394a5022c5ac6c944f`.
The vendor manifest retains the exact upstream compatibility metadata imported
with ElectrumX. The explorer's native-library helper independently pins the
qualified public Core revision above and verifies its Orchard crate tree before
building.
A pending manifest means integration is NOT qualified and deliberately blocks
its Docker build. Never substitute the latest branch tip for a validated SHA.

Obtain an independent validation receipt containing `revision` (40-character
ElectrumX SHA), the manifest's `core_revision`, and `status: validated`, then
use Python 3.12+:

```bash
python3 scripts/vendor-electrumx.py --source /path/to/electrumx-NITO --receipt /path/to/validation-receipt.json
python3 scripts/vendor-electrumx.py --check
```

The importer archives the exact commit, refuses local vendor edits, records
SHA-256 for every file and restores the tree and manifest if replacement fails.
It does not certify tests itself. Import upstream tests, dependencies and crypto
components together. Do not maintain a separate Orchard fork in this repository.
Keep receipts, credentials, node data, and test evidence outside Git.

Docker requires the native library as a separate untracked build context. On its
target Linux architecture, run the following and set `NITO_ORCHARD_BUILD_DIR`
to that directory:

```bash
python3 scripts/build-orchard.py CORE_CHECKOUT EXTERNAL_BUILD_DIRECTORY
```
Install the Core-pinned toolchain first with `rustup toolchain install 1.97.0`.
The helper exports the qualified public Core crate and follows the upstream
`cargo --locked --release` recipe, with two build jobs and only the required
`cdylib` crate-type change. It verifies the audited crate tree
`19f63b4fa2b293671e6e395233e6179e03a21fcf` at public Core commit
`1d81bbd5f79d6b857c80420d5c81915ea326adff`. A fresh public V4 checkout is
sufficient. The output source directory must be new; its Cargo target cache may
be reused.
The image checks the public reference, audited tree, Rust 1.97.0 provenance, library hash,
loadability and vendor file hashes. BuildKit and Compose additional build contexts
are required. Python runtime constraints live outside the exact vendor subtree.

## Sources and privacy

Keep `MEMPOOL.BACKEND="electrum"`. Core supplies decoded transactions, admission,
fees, policy sizes, block templates and confirmed pool accounting. ElectrumX
supplies the transparent script index. Address/UTXO/Merkle reads compare network,
height and header before and after reading; lag, reorg, IBD or RPC failure makes
inconsistent data unavailable.

API, WebSocket, summaries and graphics preserve `wtxid`, `private_bundle`,
`has_private_bundle`, and `private_metadata_status` (`transparent`, `complete`,
`incomplete`). Missing private metadata is **incomplete**, never transparent.
Only the envelope flag is inspected to detect absent metadata; Orchard parsing
and hashing remain in Core/indexer.

Public transparent inputs and outputs stay visible, including change in mixed
transactions. Private markers disclose no private recipient or transfer amount.
`value_balance` is net flow FROM Orchard: positive releases value to transparent
outputs/fees, negative deposits into Orchard. It is not private transfer volume.
Zero does not imply no private activity. The private flow diagram is replaced
with an explanation.

On-chain nullifiers are public; wallet ownership, decrypted notes and private
balances remain private. Seeds, spending keys, FVKs and wallet RPC credentials
must never enter this explorer. Bech32x receivers have no public script balance
or history page. Search explains this and Core validation rejects requests for
addresses without a public script.

## Activation and interface visibility

`GET /api/v1/nito/activation` and the shared WebSocket `nitoActivation` field
report Core's current `getblockchaininfo` activation state. The collector checks
the chain, height, hash, activation height, explicit boolean `activated` and IBD
state, then confirms the tip. It does not require `coinstatsindex` or calculate
pool balances. Status is `active`, `inactive` or `unknown`; an expired snapshot,
RPC failure or chain transition clears the previous authoritative state.

The interface names Orchard only when Core explicitly reports activation at
the displayed network and tip. Capability support, an index's presence,
`monitored`, a configured activation height or a previously observed activation
do not enable that wording. The dashboard pool column, fee explanation, filters,
transaction labels, search messages and API documentation follow this same
state. Before activation, private transaction envelopes retain neutral private
labels and their confidentiality protections. Missing activation data never
turns private data into transparent data.

Activation visibility is separate from transaction admission. At height H-1,
Core can accept a private transaction for candidate block H while the current
tip still reports `activated=false`. Decode, admission and broadcast preserve
that Core result. A reorganization below H removes Orchard wording again;
reconnection restores it only after a coherent fresh Core snapshot.

## Fees, sizes and selection

For a non-coinbase transaction with complete public data:

```
fee = transparent inputs + value_balance - transparent outputs
```

Live fees and `policy_vsize` come from Core `getmempoolentry`. Zero is a valid
fee. Unknown fees use the string `"-1"` sentinel and display as
unknown; `fee_source` identifies core, public-balance, coinbase or unknown.

`serialized_vsize` and `weight` describe serialization. `policy_vsize` includes
Nito's Orchard proof floor (5,000 + 1,000 per action at the pinned revision) and
sigops. Confirmed private transactions without policy size have an unknown
policy fee rate. Treemap area/block fullness use serialized weight; rates use
policy size. A tooltip's transparent output total is not private volume/supply.
Historical block fee statistics retain Core's serialized-vsize denominator;
they are not Orchard policy fee rates. Keep optional CPFP historical indexing,
block audit and acceleration features disabled until separately qualified.

Electrum mode uses one Core `getblocktemplate` selection, retaining ordering and
checking tip and wtxids against its mempool. Missing data invalidates projection.
Polling refreshes selection every five seconds even without mempool changes,
because Core briefly caches templates after transaction arrival.
It does not invent later blocks or eligibility from fee bands. Core applies the
800,000 weight and 555,000 Orchard resource budgets. A template is a snapshot,
not a promise of confirmation.

Recommendations use Core `estimatesmartfee` targets 2/30/60/144 and mempool
minimum. Insufficient estimates return HTTP 503 / WebSocket null. These are not
wall-clock guarantees. Mobile uses responsive details instead of the Bitcoin
tracker; private ETA and Bitcoin CoinJoin/batch/consolidation guesses are hidden.
Raw Orchard preview uses Core decode and `testmempoolaccept`, including rejection
reasons. Offline Orchard decoding is unavailable. Broadcasting uses Core
`sendrawtransaction`. Transparent RBF history does not describe every private
nullifier conflict; disappearance alone does not prove replacement or expiry.

## Confirmed totals and precision

`GET /api/v1/nito/pools` returns transparent, Orchard and total pools at the same
network, height and bestblockhash. `chainValueNitoshi` is a decimal STRING and
`chainValue` an exact eight-decimal string. Consumers must not use Number.

```
BigInt(transparent.chainValueNitoshi) + BigInt(orchard.chainValueNitoshi)
  === BigInt(total.chainValueNitoshi)
```

This is confirmed accounting, not theoretical emission, maximum supply or an
estimate of circulating coins. Mempool transfers are never added. The collector
requires synced `coinstatsindex`, coalesces requests and caches per block, checking
the tip after collection. Unavailable/inconsistent data returns 503 and clears
the dashboard values. No user request triggers a UTXO scan or proof calculation.

All integer monetary API and WebSocket fields use canonical decimal **strings**,
including transaction inputs/outputs/fees, address funded/spent sums, balances,
UTXOs, block rewards/subsidies/fees, summaries and statistics. This is a breaking
contract for consumers expecting numeric JSON money. Counts, heights, sizes,
timestamps and fee rates remain numbers. Parse money with `BigInt`, never
`Number` or `parseFloat`. Core/Electrum monetary tokens are preserved before JSON
floating-point parsing; caches retain the same strings. Chart coordinates and
rates may approximate, while displayed amounts and tooltips retain exact values.

Individual outputs obey Nito's `MAX_MONEY = 128456589000000000` nitoshis;
cumulative historical turnover is not limited to maximum supply. Values around
`9007199254740992` are valid and are returned exactly. SQL uses `DECIMAL(65,0)`
with string reads. Legacy block aggregates are reconstructed from archival Core
and marked persistently; concurrent readers share the reconstruction. An old
floating-point statistic outside the exact integer range cannot be recovered
by casting: it becomes `null` with its precision marker, not an invented value.

## Shared data and availability

The server owns Core/Electrum polling, template selection and pool collection.
WebSocket initialization and updates distribute the same pool snapshot to every
visitor. Common public transaction/block HTTP reads use bounded, short-lived
caches with request coalescing. Changes of tip, reorgs and upstream outages
invalidate affected entries; failed requests are not cached. Browser caches
reuse route data and invalidate on network/tip/reconnection changes. Address
accounting is requested on demand, with bounded incremental transaction effects.
This reduces repeated work; a cold or uncached address still requires indexing
and RPC reads and is not guaranteed to load instantly.

Core outages clear live projections, fees and pool snapshots and expose an
unavailable state. Price feeds, Lightning, acceleration, external wallet services,
Stratum, historical CPFP indexing and audits are not qualified Nito services.
Keep their options disabled. Do not enable inherited Bitcoin price feeds for
NITO. Missing fiat data is unavailable, not zero. Mining and supply views use
Nito's actual data and confirmed pool accounting, not Bitcoin's emission curve.

## Networks

Parameters from the pinned Core source:

| Explorer / ElectrumX NET | Core chain | RPC | P2P | HRP | Orchard activation |
| --- | --- | --- | --- | --- | --- |
| mainnet | main | 8825 | 8820 | nito | 1,165,432 |
| testnet | test | 8845 | 8840 | tn | 0 |
| signet | signet | 8865 | 8860 | tn | 1 |
| regtest | regtest | 8885 | 8880 | nrt | 1 |

The delivered validation baseline covers mainnet and isolated local regtest.
Testnet and signet are accepted by the configuration, but operators must qualify
their chosen chain independently before use; no signed default Signet history is
claimed by this repository.

Base58 versions are 0/5 on mainnet and 111/196 elsewhere. The inherited Bitcoin
testnet4 UI is not a supported Nito network. Enable Core `txindex=1` and
`coinstatsindex=1`, and wait for synchronization. Use separate datadirs, SQL/index
volumes and caches per network. Never switch an existing volume's network.

Compose `NITO_NETWORK` selects backend, ElectrumX and frontend build root; set
the matching `CORE_RPC_PORT`. Manual frontend builds use `ROOT_NETWORK=""` for
mainnet, otherwise the network name, enabling only that network. The compatibility
Compose file under docker/ needs Compose `include`; alternatively use root Compose.

## Migration / rollback (isolated copies first)

1. Record running image IDs/digests, revisions, configuration and SQL schema.
   Stop writers in the isolated copy and snapshot the complete ElectrumX database,
   MariaDB dump, configuration and caches together.
   The delivered database baseline is MariaDB 10.11.19. For an existing 10.6 or
   older data directory, test the supported MariaDB upgrade and `mariadb-upgrade`
   procedure against a disposable snapshot first. Never start 10.11 against the
   only copy or expect an upgraded data directory to be safely downgraded in place.
2. Verify the vendor manifest and follow that revision's ElectrumX migration or
   reindex instructions. Never assume compatibility with an older database.
   The pinned revision supports the qualified pre-activation UTXO v8-to-v9
   migration. A compact private index from an incompatible schema still needs
   a NEW empty DB_DIRECTORY and full archival replay; do not conflate these
   migrations. The container runs as UID/GID 10001. Imported volume contents
   must be writable by that account before starting it.
3. Build fresh images using `docker compose build --no-cache electrumx backend frontend`.
   Run `python /opt/nito-explorer/scripts/vendor-electrumx.py --check` inside the
   built indexer image. Recreate isolated containers with `--force-recreate` and
   verify running image IDs. A reused image tag is not version evidence.
4. Explorer SQL advances to schema 110 with exact monetary columns. Legacy
   summaries/templates missing metadata are rejected on read; block monetary
   aggregates rebuild from Core in resumable batches, shared with readers.
   Disk cache is version 5, RBF cache 3, Redis cache 3. Do not restore old caches
   into the candidate. Preserve the original SQL dump before migration: the
   migration can mark irrecoverably rounded historical statistics unavailable.
5. Compare tips, totals, transparent histories, all transaction directions, Core
   admission/fees/template, confirmation/reorg and restart on fresh/migrated copies.
   Repeat desktop/mobile and API checks before approving any production change.
6. Rollback requires stopping the candidate and restoring old images, configuration
   and complete database snapshots together. Never downgrade an index database
   in place. Rebuild expendable caches if needed.

This procedure does not authorize production changes. See
[nito-v4-validation.md](nito-v4-validation.md) for evidence and remaining gates.
