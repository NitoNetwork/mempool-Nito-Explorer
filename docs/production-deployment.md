# Production deployment

This is the supported non-Docker layout for a host that already runs Nito Core and other strategic services. The explorer is isolated under `/var/mempool-nito`; the only units managed by this procedure are `nito-electrumx.service`, `mempool-nito.service`, and, after a successful migration, the obsolete explorer-specific Electrs unit.

Do not restart Nito Core, Miningcore, PostgreSQL, MariaDB, nginx, or another coin's Electrum service during an explorer release. Existing nginx routing can keep serving the same backend port and frontend directory, so an nginx reload is normally unnecessary.

## Paths and ports

| Component | Path or listener |
| --- | --- |
| Bundled source | `/var/mempool-nito/source` |
| Backend | `/var/mempool-nito/backend` |
| Frontend | `/var/mempool-nito/frontend/dist/mempool/browser` |
| ElectrumX virtual environment | `/var/mempool-nito/electrumx-venv` |
| ElectrumX database | `/var/mempool-nito/electrumx-data` |
| ElectrumX configuration | `/etc/mempool-nito/electrumx.env` |
| Electrum protocol | `127.0.0.1:51001` |
| ElectrumX administration RPC | `127.0.0.1:8001` |
| Explorer backend | `127.0.0.1:8999` |

Port `8001` is intentional: it avoids colliding with another ElectrumX instance that may already use `8000` on a shared host.

## Install Nito ElectrumX

Create a dedicated, non-login account and keep the RPC credential file readable only by that account. Install the package from this repository, not from a second ElectrumX checkout:

```bash
python3 -m venv /var/mempool-nito/electrumx-venv
/var/mempool-nito/electrumx-venv/bin/python -m pip install --upgrade pip
/var/mempool-nito/electrumx-venv/bin/python -m pip install /var/mempool-nito/source/electrumx
install -d -o nito-electrumx -g nito-electrumx /var/mempool-nito/electrumx-data
install -d -m 0750 /etc/mempool-nito
```

Copy `deployment/production/electrumx.env.example` to `/etc/mempool-nito/electrumx.env`, insert URL-encoded RPC credentials, set ownership to `nito-electrumx`, and mode `0600`. Install `deployment/production/nito-electrumx.service.example` as `/etc/systemd/system/nito-electrumx.service`.

Start this new unit while the old explorer remains online. Do not switch the backend until both the Electrum header subscription and the ElectrumX administration RPC report the same height as Nito Core.

ElectrumX boolean variables use an empty string for false. Keep `PEER_ANNOUNCE=` and `REPORT_SERVICES=` empty for this loopback-only service; the literal text `false` is non-empty and would enable announcement.

The versioned unit deliberately gives the initial indexer a lower scheduling priority and caps it at two CPU cores and 4 GiB of memory. This protects unrelated workloads on a shared strategic host; synchronization may take longer as a result.

## Backend configuration

Start from `mempool-config.json.sample`. These settings are mandatory:

```json
{
  "MEMPOOL": {
    "BACKEND": "electrum",
    "BLOCK_WEIGHT_UNITS": 800000,
    "INDEXING_BLOCKS_AMOUNT": 11000
  },
  "ELECTRUM": {
    "HOST": "127.0.0.1",
    "PORT": 51001,
    "TLS_ENABLED": false
  }
}
```

The backend still uses Nito Core RPC for live mempool data and block statistics. Its JSON-RPC transport reuses a bounded keep-alive pool, so initial statistics indexing does not create thousands of short-lived TCP sockets. ElectrumX provides address/history access; there is no Esplora URL in the supported data path.

## Safe migration order

1. Record the current explorer unit states, listeners, API health, and deployed commit.
2. Back up only the explorer configuration, backend, frontend, and explorer unit files.
3. Build the new backend and frontend without changing any running service.
4. Start `nito-electrumx.service` on `127.0.0.1:51001` and `127.0.0.1:8001` while the old Electrs unit remains active.
5. Wait until Nito ElectrumX reaches the exact Nito Core tip. Validate `server.version`, `blockchain.headers.subscribe`, and a known transaction/history query.
6. Replace the explorer backend/frontend files and restart only `mempool-nito.service`.
7. Validate the local API, websocket, public HTTPS pages, mobile transaction tracker, service logs, RPC connection count, and socket `TIME_WAIT` trend.
8. Only after those checks pass, stop and disable the obsolete explorer-specific Electrs unit. Keep its database for rollback until a later, separately approved cleanup.

Rollback consists of restoring the backed-up explorer files and configuration, restarting only `mempool-nito.service`, and re-enabling the old explorer Electrs unit if it had already been disabled.

## Release checks

```bash
cd backend
npm ci --no-install-links
npm test -- --runInBand
npm run build

cd ../frontend
npm ci --no-install-links
npm run build

cd ../electrumx
python -m pytest tests/server/test_nito_private.py
```

After deployment, verify at least `/api/v1/blocks/tip/height`, `/api/v1/fees/recommended`, a transparent transaction, a Nito v4 private transaction, and a mobile tracker URL.
