# Docker Deployment

This directory contains the Docker assets for running the Nito Network Explorer stack.

The supported stack is:

- `mariadb`: persistent explorer database;
- `electrumx`: Nito ElectrumX built from the bundled `electrumx/` source;
- `backend`: explorer API and websocket server;
- `frontend`: nginx-served static frontend.

Nito Core is expected to run outside the compose stack. The containers reach it through the RPC settings defined in `.env`.

## Configure

From the repository root:

```bash
cp .env.sample .env
```

Edit `.env`:

```env
MARIADB_ROOT_PASSWORD=change_me_root
MARIADB_DATABASE=mempool_nito
MARIADB_USER=mempool
MARIADB_PASSWORD=change_me_db

CORE_RPC_HOST=host.docker.internal
CORE_RPC_PORT=8825
CORE_RPC_USERNAME=change_me_rpc_user
CORE_RPC_PASSWORD=change_me_rpc_password

ELECTRUMX_PORT=51001
ELECTRUMX_CACHE_MB=512
ELECTRUMX_LOG_LEVEL=info
```

The compose file maps `host.docker.internal` to Docker's host gateway so the containers can reach a local Nito Core daemon on Linux hosts.

## Start

```bash
docker compose up --build
```

The backend is configured with `MEMPOOL_BACKEND=electrum` and connects to the `electrumx` service on port `51001`.
Its `mempool-config.json` is generated at container startup from environment variables. The repository does not require a second, manually maintained configuration file.

The Nito defaults used by the stack are:

- block weight: `800000`;
- explorer statistics horizon: `11000` blocks;
- ElectrumX chain index: complete chain;
- Esplora/Electrs: disabled and unused.

Check the fully rendered configuration before starting:

```bash
docker compose config
```

For a traceable release build, set `MEMPOOL_COMMIT_HASH` to the exact public
40-character commit SHA. Compose injects it into both the backend version
metadata and the frontend runtime configuration without copying `.git` into an
image.

The Nito Core RPC endpoint must be reachable from the Docker bridge while remaining firewalled from public networks. `host.docker.internal` cannot reach a daemon that is bound exclusively to host loopback.

## Nginx Routing

`docker/nginx/nito-explorer.conf` serves the qualified English frontend files and routes:

- `/api/v1/` to the explorer backend;
- `/api/` to the same backend API with an `/api/v1/` compatibility prefix;
- `/api/v1/ws` as the websocket endpoint.

## Persistent Data

Compose volumes:

- `mariadb_data`;
- `electrumx_data`;
- `backend_cache`, the backend's writable location for its generated configuration,
  runtime caches, and PID lock while the container root filesystem stays read-only.

Back these volumes up before deleting a deployment.
