# Nito v4 compatibility baseline

This document defines the public compatibility baseline for this repository. It is not a release announcement, an uptime promise, or a claim that every downstream deployment has the same configuration.

## Pinned public sources

| Component | Public reference |
| --- | --- |
| Nito Core v4 | [`NitoNetwork/Nito-core@1d81bbd5f79d6b857c80420d5c81915ea326adff`](https://github.com/NitoNetwork/Nito-core/commit/1d81bbd5f79d6b857c80420d5c81915ea326adff) |
| Nito ElectrumX | [`NitoNetwork/electrumx-NITO@150995da1b3c4daa66f3c2394a5022c5ac6c944f`](https://github.com/NitoNetwork/electrumx-NITO/commit/150995da1b3c4daa66f3c2394a5022c5ac6c944f) |
| Explorer | the commit containing this document |

The imported ElectrumX tree and every imported file hash are recorded in `electrumx-provenance.json`. `python3 scripts/vendor-electrumx.py --check` must pass before a build.

The public Core `build-release` workflow runs `mempool_private_activation_reorg.py` on Linux x86_64 at full build scope. At the reference above, that test covers private admission at H-1, confirmation at H, a reorganization to H-2, eviction of the private transaction and its dependent child, retention of an independent transparent transaction, rejection before activation, and a valid block template. The Linux x86_64 archive exercised for explorer integration has SHA-256 `596949096164cb0f68d4e7b2b5f934aea3f3b995fba3fdb2686f10d0ce3fc6d9`.

## Explorer contracts

The compatibility checks cover these product contracts:

- Orchard wording and controls appear only after a coherent Core activation announcement for the displayed network, height, and hash.
- Candidate-block admission at H-1 remains separate from activation visibility at the current tip.
- Reorganizations invalidate stale blocks, SQL canonical aggregates, HTTP caches, WebSocket snapshots, and tracked transaction confirmations, including a replacement branch at the same height.
- Private transactions disclose only public envelope data, public cross-pool balance, and public nullifiers. No private recipient, note value, wallet balance, key, or viewing key is indexed.
- Transaction, address, UTXO, block, pool, cumulative, and statistic money fields use canonical decimal strings. Values around `2^53` nitoshis and valid values up to Nito's monetary bounds must round-trip exactly.
- Confirmed pool totals are collected at one verified tip and are never combined with mempool transfers.
- Core and Electrum failures expire shared state and return unavailable data instead of stale authoritative values.
- Common public reads are cached and coalesced on the server. Address history remains an on-demand indexed query and is not promised to be instantaneous when cold.

The delivered stack is checked with its real Compose definitions, TLS HTTP/WebSocket connections, desktop and mobile layouts, transaction and address search, network-error recovery, SQL migration/reconstruction/rollback, and the bundled ElectrumX source. These checks qualify the stated versions and scenarios; they do not transfer automatically to a modified image or configuration.

## Known boundaries

- No historical production SQL dump was available. Historical reconstruction is qualified from archival chain data and an isolated SQL fixture, not from an undisclosed production database.
- Default Signet does not have a supplied signed history for a full end-to-end qualification.
- Pure Orchard replacement relationships cannot be inferred without public mempool nullifier relationships. The UI does not invent them.
- A short controlled workload is not sustained production-load certification.
- External clients, Lightning, acceleration, Stratum, account services, and inherited block-audit/CPFP services are outside this baseline and stay disabled unless separately qualified. The direct Coinpaprika NITO/USD current and historical price feed is qualified; estimated or inherited Bitcoin/FX prices remain disabled.
- A public operator must still validate its own TLS, backups, resource limits, monitoring, network exposure, data-retention policy, and rollback procedure.

## Required pre-publication checks

Before publishing a changed explorer snapshot:

1. verify the pinned ElectrumX import;
2. run affected backend, SQL, frontend, and browser tests;
3. build the qualified English/French public frontend and the delivered containers;
4. scan the final Git tree for credentials, keys, wallet/node data, private evidence, generated artifacts, and stale private repository links;
5. verify documentation links and strict UTF-8 decoding;
6. record the exact Core, ElectrumX, explorer, image, and artifact hashes used by the final checks.

See [Nito v4 / Orchard integration](nito-v4-orchard.md) for the protocol and operational details.
