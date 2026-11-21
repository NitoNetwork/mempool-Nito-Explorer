# Nito Network Explorer

Nito Network Explorer is the block explorer and mempool interface for Nito.network. It indexes transparent chain data through Nito Core and Nito ElectrumX, and displays Nito v4 Orchard transactions without exposing private note data.

## Public compatibility baseline

- Nito Core public `v4.0`: `1d81bbd5f79d6b857c80420d5c81915ea326adff`
- Bundled Nito ElectrumX: `150995da1b3c4daa66f3c2394a5022c5ac6c944f`
- Public repository: <https://github.com/NitoNetwork/mempool-Nito-Explorer>

The interface does not announce Orchard merely because the software supports it.
Orchard wording and controls appear only after a coherent activation state from
Core for the displayed network and tip. See the
[compatibility baseline](docs/nito-v4-validation.md) for qualified behavior and
explicit remaining limits.

## Architecture

```text
Nito Core -- persistent JSON-RPC pool ----> Explorer backend
    |
    +----> Nito ElectrumX -- Electrum ----> Explorer backend
                                             |
                                             v
                                      Explorer frontend
```

The explorer backend uses `MEMPOOL.BACKEND="electrum"` and connects to Nito ElectrumX through the `ELECTRUM` configuration block. Nito ElectrumX is bundled in this repository under `electrumx/` as source code, so this repository can be deployed independently without downloading a second Git repository. Esplora and Electrs are not part of the supported Nito deployment.

Nito Core RPC remains necessary for live mempool data and block statistics. The backend keeps a bounded pool of persistent HTTP connections to Core; it does not open a new TCP connection for every RPC request. The default statistics horizon is 11,000 blocks. ElectrumX independently indexes the complete chain.

## Nito v4 Privacy Model

Nito v4 transactions can contain Orchard private effects while keeping the transparent transaction and block structure readable by existing Nito infrastructure.

The explorer displays:

- transparent inputs and outputs normally;
- transparent-to-private or private-to-transparent cross-pool value when it is public in the transaction balance;
- pure private-to-private movement as private and amount-hidden;
- Orchard sides as private markers, without publishing or inventing Bech32x receivers.

On-chain nullifiers are public. Their wallet ownership, decrypted notes and private balances remain wallet-side data. Seeds, spending keys and full viewing keys must never be sent to the explorer.

Compared with the v3 explorer deployment, the v4 requirements are:

- use the bundled Nito ElectrumX indexer instead of electrs/electrs-style
  parsing for Nito v4 blocks;
- keep transparent address/history behavior unchanged;
- display Orchard sides as private markers instead of public addresses;
- never create public balances for Bech32x wallet receivers.

See [docs/nito-v4-orchard.md](docs/nito-v4-orchard.md) for the transaction display rules.

## Requirements

- Nito Core with RPC enabled and `txindex=1`.
- Nito ElectrumX from the bundled `electrumx/` source.
- Node.js 24.22.3 (the version in `.nvmrc`) and its bundled npm.
- Python 3.12, LevelDB, and the Orchard shared library built from the pinned Core revision.
- MariaDB 10.11 LTS; the delivered Compose image is pinned to 10.11.19.
- A reverse proxy or TLS endpoint for public deployment.

## Nito Core RPC

Example `nito.conf` values:

```ini
server=1
txindex=1
coinstatsindex=1
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcuser=CHANGE_ME_RPC_USER
rpcpassword=CHANGE_ME_RPC_PASSWORD
rpcport=8825
```

Keep RPC bound to trusted interfaces only.

## Nito ElectrumX

First verify `python3 scripts/vendor-electrumx.py --check` from the repository root.
Then follow the pinned ElectrumX build instructions:

```bash
cd electrumx
python3 -m venv venv
. venv/bin/activate
python -m pip install --upgrade pip
python -m pip install .
```

Build the library with `python3 scripts/build-orchard.py /path/to/core /untracked/orchard-build`
on the target Linux architecture, using a public Core checkout containing commit
`1d81bbd5f79d6b857c80420d5c81915ea326adff` and a fresh output source directory.
Install the Core-pinned Rust toolchain with `rustup toolchain install 1.97.0`.
The helper exports that qualified public commit, requires its crate tree to match
the audited tree `19f63b4fa2b293671e6e395233e6179e03a21fcf`, and records every
original source hash, and invokes Rust 1.97.0 explicitly. It leaves the imported ElectrumX files unchanged. Set
`NITO_ORCHARD_LIBRARY` to its absolute
`target/release/libnito_orchard_ffi.so` path. Docker also requires
`NITO_ORCHARD_BUILD_DIR=/untracked/orchard-build` and Compose with BuildKit additional
build contexts. For Docker on Windows, run this helper inside WSL/Linux; the image
requires a Linux shared library.

Minimal service environment:

```bash
export COIN=Nito
export NET=mainnet
export DB_DIRECTORY=/var/lib/nito-electrumx
export DB_ENGINE=leveldb
export DAEMON_URL=http://CHANGE_ME_RPC_USER:CHANGE_ME_RPC_PASSWORD@127.0.0.1:8825/
export SERVICES=tcp://127.0.0.1:51001,rpc://127.0.0.1:8000
export REPORT_SERVICES=
export PEER_DISCOVERY=off
export PEER_ANNOUNCE=
export CACHE_MB=512
electrumx_server
```

For a public Electrum service, use the examples in `electrumx/deployment/` and expose only the intended Electrum ports.

## Backend Configuration

Copy the sample configuration and edit credentials:

```bash
cp mempool-config.json.sample mempool-config.json
```

Required Nito settings:

```json
{
  "MEMPOOL": {
    "NETWORK": "mainnet",
    "BACKEND": "electrum"
  },
  "CORE_RPC": {
    "HOST": "127.0.0.1",
    "PORT": 8825,
    "USERNAME": "CHANGE_ME",
    "PASSWORD": "CHANGE_ME"
  },
  "ELECTRUM": {
    "HOST": "127.0.0.1",
    "PORT": 51001,
    "TLS_ENABLED": false
  }
}
```

## Docker Deployment

Copy `.env.sample` to `.env`, fill in the RPC and database credentials, then start the stack:

```bash
cp .env.sample .env
docker compose up --build
```

Before building, pin the validated ElectrumX commit using the provenance procedure in
[the V4 integration guide](docs/nito-v4-orchard.md). A missing validation receipt fails
the ElectrumX image build. Recreate containers after rebuilding; do not reuse an old
image tag as evidence of the running indexer version. The delivered qualification
covers `mainnet` and isolated local `regtest`. The images also accept `testnet` and
`signet`, but operators must validate those networks independently before use. The
Core RPC port and frontend root network must match. Keep a separate Compose project
and data volumes for each network.

The backend configuration is generated inside its container from `.env`; do not create or mount a separate `mempool-config.json` for the Compose deployment. The generated configuration always selects the bundled `electrumx` service.

The default stack builds:

- MariaDB;
- Nito ElectrumX from `electrumx/`;
- explorer backend;
- explorer frontend served by nginx.

The Docker stack expects an already running Nito Core daemon reachable from the containers through the `CORE_RPC_*` values in `.env`.

On Linux, `host.docker.internal` resolves to Docker's host gateway. If Nito Core listens only on `127.0.0.1`, it is intentionally unreachable from bridge containers; bind RPC to a trusted host interface and allow only the Docker subnet, or use the manual systemd deployment. Never expose the RPC port publicly.

## Manual Backend

```bash
cd backend
npm ci --no-install-links
npm run build
MEMPOOL_CONFIG_FILE=../mempool-config.json npm run start
```

## Manual Frontend

```bash
cd frontend
cp mempool-frontend-config.sample.json mempool-frontend-config.json
npm ci --no-install-links
npm run build:public
```

Serve the generated frontend with nginx or another static web server, and proxy `/api/v1/` and `/api/` to the backend.
The public build ships English only. Translation source files remain available for
future review but are not distributed until their Nito-specific copy and layouts
have been independently qualified.

## Development Checks

Recommended local checks before pushing explorer changes:

```bash
cd backend
npm run build

cd ../frontend
npm run test:money
npm run test:features
npm run test:shared-cache
npm run build:public

cd ../electrumx
python -m pytest tests/lib/test_tx.py
```

## Public Deployment Checklist

- Fill `.env` or `mempool-config.json` from the samples; never commit edited secrets.
- Start from an empty ElectrumX database when moving a v3 instance to v4.
- Verify `/api/v1/blocks/tip/height`, `/api/v1/fees/recommended`, a transparent
  transaction page, and a Nito v4 private transaction page.
- Keep Nito Core RPC, MariaDB and ElectrumX RPC bound to trusted interfaces.
- Confirm the ElectrumX height matches Nito Core before directing the backend to it.
- During a migration, start Nito ElectrumX on unused local ports, validate it, then restart only the explorer backend. Stop the old Electrs service only after the explorer passes its checks.

The production-oriented systemd examples and the safe Electrs-to-ElectrumX migration sequence are documented in [docs/production-deployment.md](docs/production-deployment.md).

## Security Notes

- Do not publish RPC credentials, cookies, wallet files, private keys or TLS private keys.
- Keep Nito Core RPC on a trusted interface.
- Treat Bech32x private wallet state as wallet data, not explorer data.
- Do not expose internal ElectrumX RPC unless it is protected.

See [SECURITY.md](SECURITY.md) for vulnerability reporting and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for upstream attribution and
licensing boundaries.
