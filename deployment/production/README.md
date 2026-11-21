# Native production examples

The files in this directory are hardened examples for operators who run the
backend and ElectrumX directly under systemd instead of using the delivered
Compose stack. They are not an automated installer.

## Accounts and files

Create dedicated, non-login `nito-mempool` and `nito-electrumx` system users.
Do not run either service as root. Install the Node version pinned by `.nvmrc`
system-wide so that `/usr/bin/node` resolves to that version. Keep the source and
built application root-owned and read-only to the service users; grant the
backend write access only to `/var/mempool-nito/backend/cache`.

Install `docker/electrumx/start.py` as
`/var/mempool-nito/bin/nito-electrumx-start.py`. It constructs ElectrumX's daemon
URL in memory and URL-encodes the RPC credentials, so passwords containing URL
metacharacters remain valid.

Store `/etc/mempool-nito/electrumx.env` and the backend configuration with mode
`0640`, owned by `root` and the corresponding service group. Replace every
`CHANGE_ME` value. Never commit those live files, TLS private keys, Core cookies,
wallets or database dumps.

After installing the example units, run `systemd-analyze verify` against both
files, reload systemd and inspect the journal before enabling them. Adjust paths
and resource limits explicitly for the host; do not weaken the sandbox merely to
hide a permissions error.
