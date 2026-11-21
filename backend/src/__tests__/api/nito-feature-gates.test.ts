/* Exercise real route registration and socket handlers without optional external services. */
const dependencies = [
  '../../logger', '../../repositories/BlocksAuditsRepository', '../../repositories/BlocksRepository',
  '../../repositories/DifficultyAdjustmentsRepository', '../../repositories/HashratesRepository',
  '../../repositories/PricesRepository', '../../repositories/AccelerationRepository',
  '../../repositories/BlocksSummariesRepository', '../../tasks/price-updater',
  '../../api/bitcoin/bitcoin-client', '../../api/bitcoin/bitcoin-second-client', '../../api/bitcoin/bitcoin-api-factory',
  '../../api/mining/mining', '../../api/blocks', '../../api/backend-info', '../../api/mempool-blocks',
  '../../api/loading-indicators', '../../api/transaction-utils', '../../api/rbf-cache',
  '../../api/difficulty-adjustment', '../../api/fee-api', '../../api/audit',
  '../../api/statistics/statistics', '../../api/services/wallets', '../../api/services/stratum', '../../api/cpfp',
];

describe('qualified Nito optional features', () => {
  let config: any;
  let externalGet: jest.Mock;
  let mempool: any;
  let logger: any;

  beforeEach(() => {
    jest.resetModules();
    config = { MEMPOOL: { API_URL_PREFIX: '/api/v1/', OFFICIAL: false }, FIAT_PRICE: { ENABLED: false },
      MEMPOOL_SERVICES: { ACCELERATIONS: false, API: 'https://not-configured.invalid' },
      EXTERNAL_DATA_SERVER: { MEMPOOL_API: 'https://not-configured.invalid' },
      WALLETS: { ENABLED: false }, STRATUM: { ENABLED: false } };
    jest.doMock('../../config', () => ({ __esModule: true, default: config }));
    for (const dependency of dependencies) {
      jest.doMock(dependency, () => ({ __esModule: true, default: {} }));
    }
    logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn() };
    jest.doMock('../../logger', () => ({ __esModule: true, default: logger }));
    jest.doMock('../../api/common', () => ({ Common: { isLiquid: () => false } }));
    mempool = { getAccelerations: jest.fn(() => ({})) };
    jest.doMock('../../api/mempool', () => ({ __esModule: true, default: mempool }));
    externalGet = jest.fn();
    jest.doMock('axios', () => ({ __esModule: true, default: { get: externalGet } }));
    jest.doMock('../../api/websocket-handler', () => ({ __esModule: true, default: {} }));
  });

  function registeredRoutes(): string[] {
    const paths: string[] = [];
    const app: any = {};
    app.get = app.post = (path: string) => { paths.push(path); return app; };
    require('../../api/mining/mining-routes').default.initRoutes(app);
    require('../../api/prices/prices.routes').default.initRoutes(app);
    return paths;
  }

  test('disabled optional prices and acceleration have no HTTP endpoints', () => {
    const paths = registeredRoutes();
    expect(paths.some(path => /price|acceleration/.test(path))).toBe(false);
    expect(paths).toContain('/api/v1/mining/blocks/fees/:interval');
    expect(paths).toContain('/api/v1/mining/blocks/rewards/:interval');
    expect(externalGet).not.toHaveBeenCalled();
  });

  test('explicitly enabled optional services register their HTTP endpoints', () => {
    config.FIAT_PRICE.ENABLED = true;
    config.MEMPOOL_SERVICES.ACCELERATIONS = true;
    const paths = registeredRoutes();
    expect(paths).toContain('/api/v1/prices');
    expect(paths).toContain('/api/v1/historical-price');
    expect(paths).toContain('/api/v1/acceleration/request/:txid');
    expect(paths).toContain('/api/v1/accelerations');
  });

  test('a disabled acceleration service never polls even after a request', async () => {
    const acceleration = require('../../api/services/acceleration').default;
    acceleration.accelerationRequested('ab'.repeat(32));
    acceleration.accelerationConfirmed();
    expect(acceleration.countMyAccelerationsWithStatus('requested')).toBe(0);
    expect(await acceleration.$updateAccelerations()).toEqual({});
    expect(acceleration.getAccelerations()).toEqual({});
    expect(externalGet).not.toHaveBeenCalled();
  });

  function socketClient() {
    const handler = jest.requireActual('../../api/websocket-handler').default;
    const serverCallbacks: any = {}, clientCallbacks: any = {};
    const server = { clients: new Set(), on: (event: string, callback: any) => { serverCallbacks[event] = callback; } };
    const client: any = { send: jest.fn(), close: jest.fn(), on: (event: string, callback: any) => { clientCallbacks[event] = callback; } };
    handler.addWebsocketServer(server);
    handler.setupConnectionHandling();
    serverCallbacks.connection(client, { headers: {} });
    return { client, receive: (message: object) => clientCallbacks.message(JSON.stringify(message)) };
  }

  test('disabled wallet, acceleration, stratum and Liquid subscriptions are refused', async () => {
    const { client, receive } = socketClient();
    await receive({ 'track-wallet': 'example', 'track-accelerations': true, 'track-stratum': 'all', 'track-asset': 'ab'.repeat(32) });
    expect(client['track-wallet']).toBeNull();
    expect(client['track-asset']).toBeNull();
    expect(client['track-accelerations']).toBe(false);
    expect(client['track-stratum']).toBe(false);
    expect(client.send).not.toHaveBeenCalled();
    expect(client.close).not.toHaveBeenCalled();
    expect(mempool.getAccelerations).not.toHaveBeenCalled();
    expect(externalGet).not.toHaveBeenCalled();
  });

  test('configured socket subscriptions remain functional', async () => {
    config.WALLETS.ENABLED = config.STRATUM.ENABLED = config.MEMPOOL_SERVICES.ACCELERATIONS = true;
    const { client, receive } = socketClient();
    await receive({ 'track-wallet': 'example', 'track-accelerations': true, 'track-stratum': 'all' });
    expect(client['track-wallet']).toBe('example');
    expect(client['track-accelerations']).toBe(true);
    expect(client['track-stratum']).toBe('all');
    expect(mempool.getAccelerations).toHaveBeenCalledTimes(1);
    expect(JSON.parse(client.send.mock.calls[0][0]).accelerations).toEqual({ accelerations: [] });
    expect(client.close).not.toHaveBeenCalled();
    await receive({ 'track-wallet': 'stop', 'track-accelerations': false, 'track-stratum': false });
    expect(client['track-wallet']).toBeNull();
    expect(client['track-accelerations']).toBe(false);
    expect(client['track-stratum']).toBe(false);
  });
});
