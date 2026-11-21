# Security policy

## Supported code

Security fixes are applied to the current `main` branch. This repository does not promise support for unpublished snapshots, downstream images, or modified deployments.

## Reporting a vulnerability

Do not open a public issue with exploit details, credentials, wallet data, addresses tied to you, or private node logs.

Use GitHub's private vulnerability reporting flow from the repository **Security** tab. If private reporting is temporarily unavailable, contact the Nito Network team through [nito.network](https://nito.network/) only to request a private channel; do not include the vulnerability details in the initial public message.

Include the affected commit, component, reproduction prerequisites, expected impact, and a minimal proof of concept with all secrets removed. Allow the maintainers time to reproduce and coordinate a fix before public disclosure.

## Deployment boundary

The explorer is read-only public infrastructure. It must never receive seed phrases, spending keys, full viewing keys, wallet files, RPC cookies, or wallet RPC credentials. Keep Nito Core RPC, MariaDB, ElectrumX administrative RPC, and TLS private keys on trusted interfaces with least-privilege service accounts.
