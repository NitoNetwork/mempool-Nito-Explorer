# Nito Explorer Backend

The backend provides the REST API, websocket feed, block indexing tasks and MariaDB-backed statistics used by the Nito Network Explorer frontend.

## Runtime Dependencies

- Nito Core with RPC enabled and `txindex=1`.
- Nito ElectrumX reachable through the Electrum protocol.
- MariaDB 10.11 LTS; the delivered Compose image is pinned to 10.11.19.
- Node.js 24.22.3 and its bundled npm, as pinned by the repository `.nvmrc`.

## Configure

From the repository root:

```bash
cp mempool-config.json.sample mempool-config.json
```

Required backend values:

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
  },
  "DATABASE": {
    "ENABLED": true,
    "HOST": "127.0.0.1",
    "PORT": 3306,
    "DATABASE": "mempool_nito",
    "USERNAME": "mempool",
    "PASSWORD": "CHANGE_ME"
  }
}
```

`MEMPOOL.BACKEND` must be `electrum` for Nito deployments. Address lookup, script history, merkle proofs and confirmed transaction indexing come from Nito ElectrumX.

## Build

```bash
npm ci --no-install-links
npm run build
```

## Run

```bash
MEMPOOL_CONFIG_FILE=../mempool-config.json npm run start
```

## Reindexing

Use `--reindex` to truncate selected backend tables on startup:

```bash
npm run start -- --reindex=blocks,hashrates
```

Use this only when the target database can be rebuilt from Nito Core and ElectrumX.

## Pool Metadata

Mining pool metadata can be refreshed manually:

```bash
npm run start -- --update-pools
```

Automatic pool updates remain controlled by `MEMPOOL.AUTOMATIC_POOLS_UPDATE`.
