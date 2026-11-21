# Contributing to Nito Mempool Explorer

Thank you for helping improve the Nito Network explorer.

## Before opening a change

- Open an issue for large behavioral or protocol changes so the scope can be reviewed first.
- Never include credentials, wallet files, TLS private keys, database dumps, node data, or private test evidence.
- Keep Nito Core and ElectrumX compatibility claims tied to public source revisions.
- Keep Orchard wallet data private. The explorer may expose only public transaction-envelope data and public chain state.
- Use English for source code, identifiers, comments, documentation, and shipped interface copy until another locale has its own qualification.

## Local checks

Install the Node.js version from `.nvmrc`, then run the checks relevant to your change:

```bash
python3 scripts/vendor-electrumx.py --check

cd backend
npm ci --no-install-links
npm run build

cd ../frontend
npm ci --no-install-links
npm run test:money
npm run test:features
npm run test:shared-cache
npm run build:public
```

Backend, database, Docker, and browser changes require their affected tests in addition to this baseline. Do not weaken a gate or replace exact decimal monetary values with JavaScript numbers.

## Pull requests

Describe the behavior changed, the exact checks run, and any remaining limitation. A pull request does not need a separate contributor-agreement file. Contributions are accepted under the repository's existing AGPL licensing terms and retain applicable third-party notices.

Security vulnerabilities must follow [SECURITY.md](SECURITY.md), not a public issue.
