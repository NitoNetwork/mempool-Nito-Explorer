import { MiningResponseCache, miningHistoryPolicy, MINING_CACHE_POLICY } from '../../api/mining/mining-response-cache';

const policy = { freshMs: 100, staleMs: 1000 };

describe('shared mining response cache', () => {
  test('coalesces a cold aggregate for all visitors and preserves exact values', async () => {
    const cache = new MiningResponseCache();
    const load = jest.fn(async () => ({ rewardNitoshi: '128456589000000000' }));
    const replies = await Promise.all(Array.from({ length: 50 }, () => cache.get('reward', policy, load)));

    expect(load).toHaveBeenCalledTimes(1);
    expect(replies.every(reply => reply.rewardNitoshi === '128456589000000000')).toBe(true);
    expect(cache.coalesced).toBe(49);
  });

  test('serves the completed snapshot immediately while one background refresh runs', async () => {
    let now = 0;
    const cache = new MiningResponseCache(128, 1024 * 1024, () => now);
    await cache.get('pools', policy, async () => ({ snapshot: 'old' }));
    now = 101;

    let finish!: (value: { snapshot: string }) => void;
    const refresh = jest.fn(() => new Promise<{ snapshot: string }>(resolve => { finish = resolve; }));
    const stale = await cache.get('pools', policy, refresh);
    const secondVisitor = await cache.get('pools', policy, refresh);

    expect(stale).toEqual({ snapshot: 'old' });
    expect(secondVisitor).toEqual({ snapshot: 'old' });
    expect(refresh).toHaveBeenCalledTimes(1);
    finish({ snapshot: 'new' });
    await new Promise(resolve => setImmediate(resolve));
    expect(await cache.get('pools', policy, refresh)).toEqual({ snapshot: 'new' });
  });

  test('a hard reorg fence clears stale data and blocks prewarm until recovery', async () => {
    const cache = new MiningResponseCache();
    await cache.get('hashrate', policy, async () => ({ tip: 'old', amount: '9007199254740993' }));

    cache.suspend();
    const load = jest.fn(async () => ({ tip: 'new', amount: '9007199254740994' }));
    await expect(cache.get('hashrate', policy, load)).rejects.toThrow('unavailable');
    expect(load).not.toHaveBeenCalled();

    cache.resume();
    await expect(cache.get('hashrate', policy, load)).resolves.toEqual({
      tip: 'new',
      amount: '9007199254740994',
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  test('rejects an in-flight pre-reorg load instead of publishing it after recovery', async () => {
    const cache = new MiningResponseCache();
    let finish!: (value: { tip: string }) => void;
    const old = cache.get('fees', policy, () => new Promise(resolve => { finish = resolve; }));
    await Promise.resolve();

    cache.suspend();
    cache.resume();
    finish({ tip: 'old' });
    await expect(old).rejects.toThrow('snapshot changed');
    await expect(cache.get('fees', policy, async () => ({ tip: 'new' }))).resolves.toEqual({ tip: 'new' });
  });

  test('uses shorter freshness for moving windows than for long histories', () => {
    expect(miningHistoryPolicy('24h')).toBe(MINING_CACHE_POLICY.liveAggregate);
    expect(miningHistoryPolicy('1w')).toBe(MINING_CACHE_POLICY.liveAggregate);
    expect(miningHistoryPolicy('1m')).toBe(MINING_CACHE_POLICY.historical);
    expect(miningHistoryPolicy('all')).toBe(MINING_CACHE_POLICY.liveAggregate);
  });

  test('keeps the last moving aggregate visible and refreshes it once on a new tip', async () => {
    let now = 1;
    const cache = new MiningResponseCache(128, 1024 * 1024, () => now);
    cache.observeTip('tip-a');
    await cache.get('moving', MINING_CACHE_POLICY.liveAggregate, async () => ({ tip: 'tip-a' }));
    await cache.get('historical', MINING_CACHE_POLICY.historical, async () => ({ tip: 'tip-a' }));

    expect(cache.observeTip('tip-b')).toBe(true);
    let finish!: (value: { tip: string }) => void;
    const refresh = jest.fn(() => new Promise<{ tip: string }>(resolve => { finish = resolve; }));
    await expect(cache.get('moving', MINING_CACHE_POLICY.liveAggregate, refresh)).resolves.toEqual({ tip: 'tip-a' });
    await expect(cache.get('moving', MINING_CACHE_POLICY.liveAggregate, refresh)).resolves.toEqual({ tip: 'tip-a' });
    expect(refresh).toHaveBeenCalledTimes(1);

    const historicalLoad = jest.fn(async () => ({ tip: 'tip-b' }));
    await expect(cache.get('historical', MINING_CACHE_POLICY.historical, historicalLoad)).resolves.toEqual({ tip: 'tip-a' });
    expect(historicalLoad).not.toHaveBeenCalled();

    finish({ tip: 'tip-b' });
    await new Promise(resolve => setImmediate(resolve));
    await expect(cache.get('moving', MINING_CACHE_POLICY.liveAggregate, refresh)).resolves.toEqual({ tip: 'tip-b' });
  });

  test('never publishes an in-flight moving aggregate from the previous tip', async () => {
    const cache = new MiningResponseCache();
    cache.observeTip('tip-a');
    let finishA!: (value: { tip: string }) => void;
    const loadA = cache.get('moving', MINING_CACHE_POLICY.liveAggregate,
      () => new Promise(resolve => { finishA = resolve; }));
    await Promise.resolve();

    cache.observeTip('tip-b');
    const loadB = cache.get('moving', MINING_CACHE_POLICY.liveAggregate, async () => ({ tip: 'tip-b' }));
    finishA({ tip: 'tip-a' });

    await expect(loadA).rejects.toThrow('tip changed');
    await expect(loadB).resolves.toEqual({ tip: 'tip-b' });
    await expect(cache.get('moving', MINING_CACHE_POLICY.liveAggregate,
      async () => ({ tip: 'unexpected' }))).resolves.toEqual({ tip: 'tip-b' });
  });
});
