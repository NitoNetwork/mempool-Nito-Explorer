# Nito Mempool Explorer frontend

This Angular application is the browser interface for Nito Mempool Explorer. It consumes the explorer's HTTP and WebSocket APIs; it does not connect to wallets or hold private keys.

The public build ships English plus the original 32 community translation choices. Each exposed locale is built and route-checked, and automated terminology checks reject Nito-to-Bitcoin unit regressions. Missing current strings intentionally fall back to English; the community catalog is not presented as a native-speaker review of every translated sentence.

## Development

Use the Node.js version from the repository `.nvmrc`:

```bash
npm ci --no-install-links
cp mempool-frontend-config.sample.json mempool-frontend-config.json
npm run start
```

The development server expects the explorer backend described by the root [README](../README.md).

## Checks

```bash
npm run test:money
npm run test:features
npm run test:locales
npm run test:shared-cache
npm run build:public
```

Money crossing the API, WebSocket, cache, and component boundaries is represented as canonical decimal strings and `bigint`. Do not convert nitoshi values to JavaScript `number`.

General setup, Docker deployment, security boundaries, licensing, and Nito v4 behavior are documented at the repository root and in [`docs/nito-v4-orchard.md`](../docs/nito-v4-orchard.md).
