import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const defaults = Object.freeze({
  CLIGHTNING_SOCKET: '',
  CORE_RPC_COOKIE: false,
  CORE_RPC_COOKIE_PATH: '',
  CORE_RPC_DEBUG_LOG_PATH: '',
  CORE_RPC_HOST: '127.0.0.1',
  CORE_RPC_PASSWORD: '',
  CORE_RPC_PORT: 8332,
  CORE_RPC_TIMEOUT: 60000,
  CORE_RPC_USERNAME: '',
  DATABASE_DATABASE: 'mempool',
  DATABASE_ENABLED: true,
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PASSWORD: '',
  DATABASE_PID_DIR: '',
  DATABASE_POOL_SIZE: 100,
  DATABASE_PORT: 3306,
  DATABASE_SOCKET: '',
  DATABASE_TIMEOUT: 180000,
  DATABASE_USERNAME: '',
  ELECTRUM_HOST: '127.0.0.1',
  ELECTRUM_PORT: 50002,
  ELECTRUM_TLS_ENABLED: false,
  ESPLORA_BATCH_QUERY_BASE_SIZE: 1000,
  ESPLORA_FALLBACK: [],
  ESPLORA_FALLBACK_TIMEOUT: 5000,
  ESPLORA_MAX_BEHIND_TIP: 2,
  ESPLORA_REQUEST_TIMEOUT: 5000,
  ESPLORA_REST_API_URL: '',
  ESPLORA_RETRY_UNIX_SOCKET_AFTER: 30000,
  ESPLORA_UNIX_SOCKET_PATH: '',
  EXTERNAL_DATA_SERVER_LIQUID_API: '',
  EXTERNAL_DATA_SERVER_LIQUID_ONION: '',
  EXTERNAL_DATA_SERVER_MEMPOOL_API: '',
  EXTERNAL_DATA_SERVER_MEMPOOL_ONION: '',
  FIAT_PRICE_API_KEY: '',
  FIAT_PRICE_ENABLED: false,
  FIAT_PRICE_PAID: false,
  LIGHTNING_BACKEND: 'lnd',
  LIGHTNING_ENABLED: false,
  LIGHTNING_FORENSICS_INTERVAL: 43200,
  LIGHTNING_FORENSICS_RATE_LIMIT: 20,
  LIGHTNING_GRAPH_REFRESH_INTERVAL: 600,
  LIGHTNING_LOGGER_UPDATE_INTERVAL: 30,
  LIGHTNING_STATS_REFRESH_INTERVAL: 600,
  LIGHTNING_TOPOLOGY_FOLDER: '',
  LND_MACAROON_PATH: '',
  LND_REST_API_URL: '',
  LND_TIMEOUT: 10000,
  LND_TLS_CERT_PATH: '',
  MAXMIND_ENABLED: false,
  MAXMIND_GEOIP2_ISP: '',
  MAXMIND_GEOLITE2_ASN: '',
  MAXMIND_GEOLITE2_CITY: '',
  MEMPOOL_ALLOW_UNREACHABLE: false,
  MEMPOOL_API_URL_PREFIX: '/api/v1/',
  MEMPOOL_AUDIT: false,
  MEMPOOL_AUTOMATIC_POOLS_UPDATE: false,
  MEMPOOL_BACKEND: 'electrum',
  MEMPOOL_BLOCK_WEIGHT_UNITS: 800000,
  MEMPOOL_BLOCKS_SUMMARIES_INDEXING: false,
  MEMPOOL_CACHE_DIR: './cache',
  MEMPOOL_CACHE_ENABLED: true,
  MEMPOOL_CLEAR_PROTECTION_MINUTES: 20,
  MEMPOOL_CPFP_INDEXING: false,
  MEMPOOL_DISK_CACHE_BLOCK_INTERVAL: 6,
  MEMPOOL_ENABLED: true,
  MEMPOOL_EXTERNAL_ASSETS: [],
  MEMPOOL_EXTERNAL_MAX_RETRY: 1,
  MEMPOOL_EXTERNAL_RETRY_INTERVAL: 0,
  MEMPOOL_GOGGLES_INDEXING: false,
  MEMPOOL_HTTP_PORT: 8999,
  MEMPOOL_INDEXING_BLOCKS_AMOUNT: 11000,
  MEMPOOL_INITIAL_BLOCKS_AMOUNT: 8,
  MEMPOOL_LIMIT_GBT: false,
  MEMPOOL_MAX_BLOCKS_BULK_QUERY: 0,
  MEMPOOL_MAX_PUSH_TX_SIZE_WEIGHT: 4000000,
  MEMPOOL_MAX_TRACKED_ADDRESSES: 1,
  MEMPOOL_MEMPOOL_BLOCKS_AMOUNT: 8,
  MEMPOOL_NETWORK: 'mainnet',
  MEMPOOL_OFFICIAL: false,
  MEMPOOL_POLL_RATE_MS: 2000,
  MEMPOOL_POOLS_JSON_TREE_URL: '',
  MEMPOOL_POOLS_JSON_URL: '',
  MEMPOOL_POOLS_UPDATE_DELAY: 604800,
  MEMPOOL_PRICE_UPDATES_PER_HOUR: 1,
  MEMPOOL_RECOMMENDED_FEE_PERCENTILE: 50,
  MEMPOOL_RUST_GBT: false,
  MEMPOOL_SERVICES_ACCELERATIONS: false,
  MEMPOOL_SERVICES_API: '',
  MEMPOOL_SPAWN_CLUSTER_PROCS: 0,
  MEMPOOL_STDOUT_LOG_MIN_PRIORITY: 'info',
  MEMPOOL_UNIX_SOCKET_PATH: '',
  MEMPOOL_USE_SECOND_NODE_FOR_MINFEE: false,
  MEMPOOL_USER_AGENT: 'nito-mempool-explorer',
  REDIS_BATCH_QUERY_BASE_SIZE: 5000,
  REDIS_ENABLED: false,
  REDIS_UNIX_SOCKET_PATH: '',
  REPLICATION_AUDIT: false,
  REPLICATION_AUDIT_START_HEIGHT: 774000,
  REPLICATION_ENABLED: false,
  REPLICATION_SERVERS: [],
  REPLICATION_STATISTICS: false,
  REPLICATION_STATISTICS_START_TIME: 1481932800,
  SECOND_CORE_RPC_COOKIE: false,
  SECOND_CORE_RPC_COOKIE_PATH: '',
  SECOND_CORE_RPC_HOST: '127.0.0.1',
  SECOND_CORE_RPC_PASSWORD: '',
  SECOND_CORE_RPC_PORT: 8332,
  SECOND_CORE_RPC_TIMEOUT: 60000,
  SECOND_CORE_RPC_USERNAME: '',
  SOCKS5PROXY_ENABLED: false,
  SOCKS5PROXY_HOST: 'localhost',
  SOCKS5PROXY_PASSWORD: '',
  SOCKS5PROXY_PORT: '9050',
  SOCKS5PROXY_USE_ONION: false,
  SOCKS5PROXY_USERNAME: '',
  STATISTICS_ENABLED: true,
  STATISTICS_TX_PER_SECOND_SAMPLE_PERIOD: 150,
  STRATUM_API: '',
  STRATUM_ENABLED: false,
  SYSLOG_ENABLED: false,
  SYSLOG_FACILITY: 'local7',
  SYSLOG_HOST: '127.0.0.1',
  SYSLOG_MIN_PRIORITY: 'info',
  SYSLOG_PORT: 514,
});

function parseOverride(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;

  if (typeof fallback === 'string') return raw;
  if (typeof fallback === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error(`${name} must be true or false`);
  }
  if (typeof fallback === 'number') {
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(raw)) {
      throw new Error(`${name} must be a JSON number`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
    return value;
  }
  if (Array.isArray(fallback)) {
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error(`${name} must be a JSON array`);
    }
    if (!Array.isArray(value)) throw new Error(`${name} must be a JSON array`);
    return value;
  }
  throw new Error(`Unsupported config type for ${name}`);
}

function validate(config) {
  if (!config.CORE_RPC.COOKIE && (!config.CORE_RPC.USERNAME || !config.CORE_RPC.PASSWORD)) {
    throw new Error('CORE_RPC_USERNAME and CORE_RPC_PASSWORD are required unless CORE_RPC_COOKIE=true');
  }
  if (config.DATABASE.ENABLED &&
      (!config.DATABASE.DATABASE || !config.DATABASE.USERNAME || !config.DATABASE.PASSWORD)) {
    throw new Error('DATABASE_DATABASE, DATABASE_USERNAME and DATABASE_PASSWORD are required when the database is enabled');
  }
  if (config.MAXMIND.ENABLED &&
      (!config.MAXMIND.GEOLITE2_CITY || !config.MAXMIND.GEOLITE2_ASN)) {
    throw new Error('MAXMIND_GEOLITE2_CITY and MAXMIND_GEOLITE2_ASN are required when MaxMind is enabled');
  }
}

async function main() {
  const [templatePath, outputPath] = process.argv.slice(2);
  if (!templatePath || !outputPath) {
    throw new Error('Usage: render-config.mjs <template> <output>');
  }

  const template = await readFile(templatePath, 'utf8');
  const used = new Set();
  const rendered = template.replace(/"__([A-Z0-9_]+)__"|__([A-Z0-9_]+)__/g,
    (match, quotedName, rawName) => {
      const name = quotedName || rawName;
      if (!Object.hasOwn(defaults, name)) throw new Error(`No default declared for ${name}`);
      const value = parseOverride(name, defaults[name]);
      if (quotedName && typeof value !== 'string') {
        throw new Error(`${name} must remain a string in the config template`);
      }
      if (rawName && typeof value === 'string') {
        throw new Error(`${name} must remain a JSON value in the config template`);
      }
      used.add(name);
      return JSON.stringify(value);
    });

  for (const name of Object.keys(defaults)) {
    if (!used.has(name)) throw new Error(`Config template does not contain ${name}`);
  }

  const config = JSON.parse(rendered);
  validate(config);

  process.umask(0o077);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(`Configuration error: ${error.message}`);
  process.exitCode = 1;
});
