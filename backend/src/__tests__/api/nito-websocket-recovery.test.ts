describe('Nito WebSocket recovery snapshots', () => {
  let handler: any;
  let activation: any;
  let state: any;
  let publishActivation: (value: any) => void;
  let messages: any[];
  const unknown = { status: 'unknown', activated: null, privateTxActivationHeight: null,
    chain: null, blocks: null, bestblockhash: null, source: 'core', reason: 'core-unavailable' };
  const active = { status: 'active', activated: true, privateTxActivationHeight: 110,
    chain: 'regtest', blocks: 110, bestblockhash: 'ab'.repeat(32), source: 'core' };
  const inactive = { ...active, status: 'inactive', activated: false };
  const poolSnapshot = (activation = active) => ({
    status: 'confirmed', source: 'core', includes_mempool: false,
    activated: activation.activated, privateTxActivationHeight: activation.privateTxActivationHeight,
    chain: activation.chain, blocks: activation.blocks, bestblockhash: activation.bestblockhash,
    transparent: { monitored: true, chainValueNitoshi: '9007199254740993', chainValue: '90071992.54740993' },
    orchard: { monitored: true, chainValueNitoshi: '1', chainValue: '0.00000001' },
    total: { monitored: true, chainValueNitoshi: '9007199254740994', chainValue: '90071992.54740994' },
  });

  beforeEach(() => {
    jest.resetModules(); state = unknown; messages = [];
    for (const path of [
      '../../api/blocks', '../../api/mempool', '../../api/backend-info', '../../api/mempool-blocks',
      '../../api/loading-indicators', '../../api/transaction-utils', '../../api/rbf-cache',
      '../../api/difficulty-adjustment', '../../api/fee-api', '../../api/audit',
      '../../repositories/BlocksAuditsRepository', '../../repositories/BlocksSummariesRepository',
      '../../tasks/price-updater', '../../api/services/acceleration', '../../api/statistics/statistics',
      '../../repositories/AccelerationRepository', '../../api/bitcoin/bitcoin-api-factory',
      '../../api/services/wallets', '../../api/bitcoin/bitcoin-second-client', '../../api/services/stratum',
      '../../api/shared-response-cache', '../../api/nito-pools-instance', '../../api/cpfp',
    ]) { jest.doMock(path, () => ({ __esModule: true, default: {} })); }
    jest.doMock('../../api/common', () => ({ Common: {} }));
    jest.doMock('../../config', () => ({ __esModule: true, default: { MEMPOOL: { BACKEND: 'electrum', NETWORK: 'regtest' } } }));
    jest.doMock('../../logger', () => ({ __esModule: true, default: { debug: jest.fn() } }));
    activation = {
      subscribe: jest.fn(callback => { publishActivation = callback; callback(state); }),
      snapshot: jest.fn(() => state),
      invalidate: jest.fn(() => { state = unknown; publishActivation(state); }),
    };
    jest.doMock('../../api/nito-activation-instance', () => ({ __esModule: true, default: activation }));
    handler = require('../../api/websocket-handler').default;
    handler.addWebsocketServer({ clients: new Set([{ readyState: 1, send: raw => messages.push(JSON.parse(raw)) }]) });
  });

  test('replays live data computed before recovery in the same packet as available=true', () => {
    handler.publishNitoStatus(false);
    state = active; publishActivation(state);
    const pools = poolSnapshot();
    const fees = { fastestFee: 1, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 };
    const projected = [{ blockSize: 100, blockVSize: 100, nTx: 1, totalFees: '9007199254740993' }];
    handler.publishNitoPools(pools);
    handler.setExtraInitData('fees', fees);
    handler.setExtraInitData('mempool-blocks', projected);
    handler.publishNitoStatus(true);

    expect(messages.map(message => message.nitoStatus?.available).filter(value => value != null)).toEqual([false, true]);
    expect(messages[messages.length - 1]).toEqual({ nitoStatus: { available: true },
      nitoActivation: active, nitoPools: pools, fees, 'mempool-blocks': projected });
    expect(JSON.parse(handler.getSerializedInitData())).toMatchObject(messages[messages.length - 1]);
    expect(activation.snapshot).toHaveBeenCalledTimes(2);
    const count = messages.length;
    handler.publishNitoStatus(true);
    expect(messages).toHaveLength(count);
  });

  test('uses the current activation snapshot when an earlier active value has expired', () => {
    handler.publishNitoStatus(false);
    state = active; publishActivation(state);
    // Expiration must not be replaced by an earlier serialized active packet.
    state = { ...unknown, reason: 'stale-snapshot' };
    handler.publishNitoStatus(true);
    expect(messages[messages.length - 1]).toEqual({ nitoStatus: { available: true },
      nitoActivation: state, nitoPools: null, fees: null, 'mempool-blocks': [] });
    expect(JSON.parse(handler.getSerializedInitData()).nitoActivation).toEqual(state);
  });

  test('never publishes Orchard accounting before activation and adds it once active', () => {
    state = inactive; publishActivation(state);
    handler.publishNitoPools(poolSnapshot(inactive));
    const inactiveMessage = messages[messages.length - 1];
    expect(inactiveMessage.nitoPools).not.toHaveProperty('orchard');
    expect(JSON.stringify(inactiveMessage)).not.toMatch(/orchard/i);
    expect(JSON.stringify(JSON.parse(handler.getSerializedInitData()).nitoPools)).not.toMatch(/orchard/i);

    state = active; publishActivation(state);
    handler.publishNitoPools(poolSnapshot(active));
    expect(messages[messages.length - 1].nitoPools.orchard.chainValueNitoshi).toBe('1');
    expect(JSON.parse(handler.getSerializedInitData()).nitoPools.orchard.chainValueNitoshi).toBe('1');
  });

  test('lease expiry clears both connected clients and reconnect data while the next RPC is pending', async () => {
    jest.useFakeTimers();
    const { NitoActivation } = jest.requireActual('../../api/nito-activation');
    const rpc = {
      getBlockchainInfo: jest.fn().mockResolvedValue({ ...active, initialblockdownload: false }),
      getBestBlockHash: jest.fn().mockResolvedValue(active.bestblockhash),
    };
    const service = new NitoActivation(rpc, 'regtest');
    const secondClient: any[] = [];
    handler.addWebsocketServer({ clients: new Set([{ readyState: 1, send: raw => secondClient.push(JSON.parse(raw)) }]) });
    const unsubscribe = service.subscribe(value => handler.publishNitoActivation(value));
    let finish!: (value: any) => void;
    try {
      state = await service.refresh();
      handler.publishNitoStatus(true);
      handler.publishNitoPools(poolSnapshot());
      rpc.getBlockchainInfo.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
      const pending = service.refresh();
      jest.advanceTimersByTime(30000);
      const expired = { nitoActivation: expect.objectContaining({ status: 'unknown', activated: null, reason: 'stale' }), nitoPools: null };
      expect(messages[messages.length - 1]).toEqual(expired);
      expect(secondClient[secondClient.length - 1]).toEqual(expired);
      expect(JSON.parse(handler.getSerializedInitData())).toMatchObject(expired);
      expect(rpc.getBlockchainInfo).toHaveBeenCalledTimes(2);
      // A successful answer begun before expiry must not restore the pools.
      finish({ ...active, initialblockdownload: false });
      await pending;
      expect(JSON.parse(handler.getSerializedInitData())).toMatchObject(expired);
    } finally {
      unsubscribe(); service.invalidate(); jest.useRealTimers();
    }
  });
});
