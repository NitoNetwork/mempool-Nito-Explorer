# Nito ElectrumX

Public ElectrumX server package for the NITO network.

This repository contains the ElectrumX codebase with the NITO coin definition,
the Nito v4 transaction parser, and deployment examples for running public TCP,
SSL, and WSS Electrum services. It can be installed and operated independently
with a synced Nito Core node.

## Public Endpoints

- TCP: electrum1.nito.network:50001
- SSL: electrum1.nito.network:50003
- WSS: electrum1.nito.network:50005

## Features

- NITO mainnet coin definition
- Nito v4 Orchard transaction deserialization
- Compact public Bech32x action index for light wallets
- Nito private compact-range, nullifier, witness and pool-state RPCs
- Public TCP, SSL, and WSS service examples
- Systemd service examples
- Optional maintenance and healthcheck timer examples
- Optional static monitor example

## Nito v4 Orchard Indexing

ElectrumX indexes transparent scripts and the public compact data from
Bech32x Orchard actions. The compact private index contains block height,
transaction id, transaction/action position, nullifier, commitment, ephemeral
key, compact ciphertext, view tag, anchor and depth-32 Orchard tree state (API v2).

ElectrumX never receives or stores a seed, spending key, full viewing key,
decrypted note, decrypted private amount, wallet identifier or ownership
association. Wallet implementations download compact action ranges and perform
address handling, decryption, balance calculation, proof creation and signing.

Bech32x Orchard addresses (`nito1x...`) are not transparent script history
keys. They must not become public searchable balances or server-side wallet
accounts.

Operational requirements:

- run this fork, not a generic ElectrumX parser;
- keep Nito Core `txindex=1`;
- for Core v4, build the pinned native Orchard library and set `NITO_ORCHARD_LIBRARY`;
- Core v3 is detected by capability absence and continues in transparent-only mode;
- preserve an existing transparent database: schema 2 starts at the Orchard
  activation checkpoint and repairs only the Orchard key spaces;
- keep Core blocks from Orchard activation onward available for an Orchard-only repair;
- enable `coinstatsindex=1` for efficient pool accounting; Core `orchardindex` is independent;
- expose only Electrum protocol ports publicly, never Nito Core RPC.

See [docs/nito-v4-orchard.md](docs/nito-v4-orchard.md) for the parser and
indexing rules used by this ElectrumX fork.

## Nito Private RPCs

- `blockchain.nito.private.v2.get_state`
- `blockchain.nito.private.v2.get_compact_range`
- `blockchain.nito.private.v2.get_nullifiers`
- `blockchain.nito.private.v2.get_witness`
- `blockchain.nito.private.get_pools`
- `blockchain.nito.get_orchard_pools`

These RPCs expose public compact data only. They do not accept or return wallet
secrets and they do not compute private balances. The previous unversioned
`get_witness` endpoint is retired because its double-SHA256 proof was not an
Orchard authentication path. See the protocol guide for migration and remaining
client trust assumptions.

## Requirements

- Linux server, preferably Ubuntu 22.04 or newer
- Python 3.10 or newer
- LevelDB (the qualified storage engine)
- Rust/Cargo and the pinned Core source revision for the native Orchard library
- A fully synced NITO daemon with RPC enabled
- TLS certificate if SSL or WSS endpoints are exposed publicly

## NITO Daemon Example

Add equivalent options to the NITO daemon configuration. Replace every CHANGE_ME value before starting the daemon.

~~~conf
server=1
daemon=1
txindex=1
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcuser=CHANGE_ME_RPC_USER
rpcpassword=CHANGE_ME_RPC_PASSWORD
rpcport=8825
zmqpubrawblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:28333
~~~

## Install

~~~bash
sudo useradd --system --home /var/lib/nito-electrumx --shell /usr/sbin/nologin electrumx
sudo install -d -o electrumx -g electrumx \
  /var/lib/nito-electrumx /var/lib/nito-electrumx/db
sudo git clone https://github.com/NitoNetwork/electrumx-NITO.git /opt/electrumx-NITO
sudo python3 -m venv /opt/electrumx-NITO/venv
sudo /opt/electrumx-NITO/venv/bin/pip install --upgrade pip
sudo /opt/electrumx-NITO/venv/bin/pip install /opt/electrumx-NITO
~~~

Copy the example configuration and edit it for your daemon, database path,
public hostname and TLS certificate paths.

~~~bash
sudo install -m 640 -o root -g electrumx \
  /opt/electrumx-NITO/deployment/config/electrumx.conf.example /etc/electrumx.conf
sudo nano /etc/electrumx.conf
~~~

Install the systemd service example.

~~~bash
sudo install -m 644 /opt/electrumx-NITO/deployment/systemd/electrumx.service.example \
  /etc/systemd/system/electrumx.service
sudo systemctl daemon-reload
sudo systemctl enable --now electrumx
~~~

## Verify

~~~bash
systemctl status electrumx --no-pager
journalctl -u electrumx --since '10 minutes ago' --no-pager
ss -ltnp | grep -E ':(50001|50003|50005)\\b'
~~~

Protocol smoke check:

~~~bash
printf '{"id":1,"method":"server.version","params":["nito-check","1.4"]}\n' | nc 127.0.0.1 50001
~~~

## Optional Monitor

The deployment folder includes a small monitor example. It is intentionally generic and uses placeholder paths so it can be adapted to any server layout.

## Security Notes

- Keep daemon RPC bound to 127.0.0.1.
- Do not publish RPC usernames, passwords, cookie files, private keys, wallet files, or TLS private keys.
- Expose only the public Electrum ports that are required.
- Use a firewall and rate limiting appropriate for your traffic.

## License

This repository follows the license of the upstream ElectrumX codebase.
