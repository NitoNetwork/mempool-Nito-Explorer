import { NitoActivation, NitoActivationSnapshot } from '../../api/nito-activation';
import { NitoPools } from '../../api/nito-pools';

const info = (height = 100, activated = height >= 100, chain = 'regtest') => ({
  chain, blocks: height, bestblockhash: height.toString(16).padStart(64, '0'),
  initialblockdownload: false, privateTxActivationHeight: 100, activated,
});

function fixture() {
  let current: any = info();
  const rpc = { getBlockchainInfo: jest.fn(async () => current), getBestBlockHash: jest.fn(async () => current.bestblockhash) };
  const service = new NitoActivation(rpc, 'regtest');
  return { rpc, service, set: (next: any) => { current = next; } };
}

describe('Core-authoritative Orchard activation', () => {
  const services: NitoActivation[] = [];
  const tracked = () => { const test = fixture(); services.push(test.service); return test; };
  afterEach(() => { for (const service of services.splice(0)) { service.invalidate(); } jest.useRealTimers(); });

  test('follows H-2, H-1, H and reorg reversals without enabling from the next-block height', async () => {
    const { service, set } = tracked();
    const changes: NitoActivationSnapshot[] = [];
    service.subscribe(state => changes.push(state));
    for (const height of [98, 99, 100, 101, 99, 98, 100]) {
      set(info(height));
      const state = await service.refresh();
      expect(state).toMatchObject({ status: height >= 100 ? 'active' : 'inactive', activated: height >= 100,
        blocks: height, bestblockhash: info(height).bestblockhash, privateTxActivationHeight: 100, source: 'core' });
    }
    // Ordinary tip changes, including a verified lower tip, are replaced only
    // after both Core reads agree. They do not create a transient unknown gap.
    expect(changes.filter(state => state.reason === 'chain-changed')).toHaveLength(0);
  });

  test('keeps the last verified state while the next ordinary tip is being checked', async () => {
    const { service, rpc, set } = tracked();
    set(info(99));
    const previous = await service.refresh();
    let finish!: (value: any) => void;
    set(info(100));
    rpc.getBlockchainInfo.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const pending = service.refresh();
    expect(service.snapshot()).toBe(previous);
    expect(service.snapshot()).toMatchObject({ status: 'inactive', blocks: 99 });
    finish(info(100));
    await expect(pending).resolves.toMatchObject({ status: 'active', blocks: 100 });
  });

  test.each([
    ['missing flag', { activated: undefined }], ['missing height', { privateTxActivationHeight: undefined }],
    ['nonboolean flag', { activated: 'true' }], ['fractional height', { privateTxActivationHeight: 99.5 }],
    ['active before H', { blocks: 99, activated: true }], ['inactive at H', { activated: false }],
    ['IBD', { initialblockdownload: true }], ['missing sync status', { initialblockdownload: undefined }],
    ['other network', { chain: 'main' }], ['invalid hash', { bestblockhash: 'short' }],
  ])('fails closed for %s', async (_label, patch) => {
    const { service, set } = tracked();
    await service.refresh();
    set({ ...info(), ...patch });
    expect(await service.refresh()).toMatchObject({ status: 'unknown', activated: null, privateTxActivationHeight: null });
    expect(() => service.getChainInfo()).toThrow('unavailable');
  });

  test('supports Core explicitly disabling the feature', async () => {
    const { service, set } = tracked();
    set({ ...info(), activated: false, privateTxActivationHeight: -1 });
    expect(await service.refresh()).toMatchObject({ status: 'inactive', activated: false, privateTxActivationHeight: -1 });
  });

  test.each([['mainnet', 'main'], ['testnet', 'test'], ['signet', 'signet'], ['regtest', 'regtest']])('checks the %s Core network name', async (network, chain) => {
    const rpc = { getBlockchainInfo: async () => info(100, true, chain), getBestBlockHash: async () => info().bestblockhash };
    const service = new NitoActivation(rpc, network); services.push(service);
    expect(await service.refresh()).toMatchObject({ status: 'active', chain });
  });

  test('shares one collection among visitors and uses no RPC for snapshot reads', async () => {
    const { service, rpc } = tracked();
    const states = await Promise.all(Array.from({ length: 20 }, () => service.refresh()));
    for (let index = 0; index < 100; index++) { expect(service.snapshot()).toBe(states[0]); }
    expect(rpc.getBlockchainInfo).toHaveBeenCalledTimes(1);
    expect(rpc.getBestBlockHash).toHaveBeenCalledTimes(1);
  });

  test('activation remains available without coinstatsindex and pool collection reuses the same chain read', async () => {
    const { service, rpc } = tracked();
    await service.refresh();
    const pools = new NitoPools({ ...rpc, getIndexInfo: async () => ({}) }, 'regtest', () => service.getChainInfo());
    await expect(pools.get()).rejects.toThrow('coinstatsindex');
    expect(service.snapshot().activated).toBe(true);
    expect(rpc.getBlockchainInfo).toHaveBeenCalledTimes(1);
  });

  test('retries a transient tip race during collection', async () => {
    const { service, rpc } = tracked();
    rpc.getBestBlockHash.mockResolvedValueOnce('f'.repeat(64));
    expect(await service.refresh()).toMatchObject({ status: 'active', activated: true });
    expect(rpc.getBlockchainInfo).toHaveBeenCalledTimes(2);
  });

  test('rejects a tip that remains inconsistent after retry', async () => {
    const { service, rpc } = tracked();
    rpc.getBestBlockHash.mockResolvedValue('f'.repeat(64));
    expect(await service.refresh()).toMatchObject({ status: 'unknown', activated: null, reason: 'chain-changed' });
  });

  test('publishes unknown on an outage and recovers only after a fresh Core answer', async () => {
    const { service, rpc } = tracked();
    const listener = jest.fn(); service.subscribe(listener);
    await service.refresh();
    rpc.getBlockchainInfo.mockRejectedValueOnce(new Error('Core offline'));
    expect(await service.refresh()).toMatchObject({ status: 'unknown', activated: null, reason: 'core-unavailable' });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'unknown' }));
    expect(await service.refresh()).toMatchObject({ status: 'active', activated: true });
  });

  test('invalidates old coalesced work without overwriting a newer inactive snapshot', async () => {
    const { service, rpc, set } = tracked();
    let finish!: (value: any) => void;
    rpc.getBlockchainInfo.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const first = service.refresh(); const coalesced = service.refresh();
    service.invalidate('chain-changed');
    set(info(99));
    const fresh = await service.refresh();
    finish(info(100));
    await Promise.all([first, coalesced]);
    expect(service.snapshot()).toBe(fresh);
    expect(fresh).toMatchObject({ activated: false, blocks: 99 });
  });

  test('expires and notifies connected clients without any visitor or RPC request', async () => {
    jest.useFakeTimers();
    const { service, rpc } = tracked();
    const listener = jest.fn(); service.subscribe(listener);
    await service.refresh();
    jest.advanceTimersByTime(30000);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'unknown', activated: null, reason: 'stale' }));
    expect(service.snapshot().activated).toBeNull();
    expect(rpc.getBlockchainInfo).toHaveBeenCalledTimes(1);
    expect(() => service.getChainInfo()).toThrow('unavailable');
  });

  test('the production pool instance invalidates a recently refreshed API snapshot on activation expiry', async () => {
    jest.useFakeTimers();
    const { service, rpc } = tracked();
    await service.refresh();
    const poolRpc = { ...rpc,
      getIndexInfo: jest.fn(async () => ({ coinstatsindex: { synced: true, best_block_height: 100 } })),
      getOrchardPools: jest.fn(async () => ({ ...info(),
        transparent: { monitored: true, chainValueNitoshi: '9007199254740993' },
        orchard: { monitored: true, chainValueNitoshi: '1' },
        total: { monitored: true, chainValueNitoshi: '9007199254740994' },
      })),
    };
    jest.doMock('../../api/bitcoin/bitcoin-client', () => ({ __esModule: true, default: poolRpc }));
    jest.doMock('../../api/nito-activation-instance', () => ({ __esModule: true, default: service }));
    jest.doMock('../../config', () => ({ __esModule: true, default: { MEMPOOL: { NETWORK: 'regtest' } } }));
    let pools: NitoPools;
    jest.isolateModules(() => { pools = require('../../api/nito-pools-instance').default; });
    await pools!.get();
    jest.advanceTimersByTime(29000);
    await pools!.get();
    expect(pools!.snapshot().total.chainValueNitoshi).toBe('9007199254740994');
    jest.advanceTimersByTime(1000);
    // Pool freshness alone still had nine seconds left; the shared activation
    // listener must invalidate it immediately, including the API snapshot.
    expect(() => pools!.snapshot()).toThrow('unavailable');
    await expect(pools!.get()).rejects.toThrow('activation snapshot unavailable');
    expect(poolRpc.getOrchardPools).toHaveBeenCalledTimes(1);
    expect(rpc.getBlockchainInfo).toHaveBeenCalledTimes(1);
  });
});
