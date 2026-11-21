import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const renderer = path.join(here, 'render-config.mjs');
const template = path.join(here, 'mempool-config.json');

function render(directory, overrides = {}) {
  const output = path.join(directory, `config-${randomUUID()}.json`);
  const environment = {
    ...process.env,
    CORE_RPC_USERNAME: 'nito-rpc',
    CORE_RPC_PASSWORD: 'rpc!&\\"line\nnext',
    DATABASE_DATABASE: 'mempool_nito',
    DATABASE_PID_DIR: '/app/backend/cache',
    DATABASE_USERNAME: 'nito-db',
    DATABASE_PASSWORD: 'db!&\\"line\nnext',
    ...overrides,
  };
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete environment[name];
  }
  const result = spawnSync(process.execPath, [renderer, template, output], {
    cwd: here,
    env: environment,
    encoding: 'utf8',
  });
  return { output, result };
}

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'nito-config-render-'));
try {
  const success = render(temporaryDirectory);
  assert.equal(success.result.status, 0, success.result.stderr);
  const config = JSON.parse(await readFile(success.output, 'utf8'));
  assert.equal(config.CORE_RPC.PASSWORD, 'rpc!&\\"line\nnext');
  assert.equal(config.DATABASE.PASSWORD, 'db!&\\"line\nnext');
  assert.equal(config.DATABASE.PID_DIR, '/app/backend/cache');
  assert.equal(config.MAXMIND.ENABLED, false);
  assert.equal(config.MEMPOOL.POOLS_JSON_URL, '');
  assert.equal(config.EXTERNAL_DATA_SERVER.MEMPOOL_API, '');
  assert.equal(config.EXTERNAL_DATA_SERVER.MEMPOOL_ONION, '');
  assert.equal(config.EXTERNAL_DATA_SERVER.LIQUID_API, '');
  assert.equal(config.EXTERNAL_DATA_SERVER.LIQUID_ONION, '');
  assert.equal(config.MEMPOOL_SERVICES.API, '');
  assert.equal(config.SOCKS5PROXY.USE_ONION, false);
  if (process.platform !== 'win32') {
    assert.equal((await stat(success.output)).mode & 0o777, 0o600);
  }

  const compose = await readFile(path.join(here, '..', '..', 'docker-compose.yml'), 'utf8');
  assert.match(compose, /^\s{6}DATABASE_PID_DIR: "\/app\/backend\/cache"$/m);
  assert.match(compose, /^\s{6}- backend_cache:\/app\/backend\/cache$/m);
  assert.match(compose, /^\s{8}MEMPOOL_COMMIT_HASH: "\$\{MEMPOOL_COMMIT_HASH:-\}"$/m);
  assert.match(compose, /^\s{8}DOCKER_COMMIT_HASH: "\$\{MEMPOOL_COMMIT_HASH:-\}"$/m);

  const backendDockerfile = await readFile(path.join(here, 'Dockerfile'), 'utf8');
  const frontendDockerfile = await readFile(path.join(here, '..', 'frontend', 'Dockerfile'), 'utf8');
  assert.match(backendDockerfile, /^ARG MEMPOOL_COMMIT_HASH$/m);
  assert.match(frontendDockerfile, /^ARG DOCKER_COMMIT_HASH$/m);

  const missingSecret = render(temporaryDirectory, { CORE_RPC_PASSWORD: undefined });
  assert.notEqual(missingSecret.result.status, 0);
  assert.match(missingSecret.result.stderr, /CORE_RPC_USERNAME and CORE_RPC_PASSWORD are required/);
  assert.doesNotMatch(missingSecret.result.stderr, /rpc!|db!/);

  const invalidArray = render(temporaryDirectory, { MEMPOOL_EXTERNAL_ASSETS: 'not-json' });
  assert.notEqual(invalidArray.result.status, 0);
  assert.match(invalidArray.result.stderr, /MEMPOOL_EXTERNAL_ASSETS must be a JSON array/);

  console.log('Secure backend config rendering passed');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
