import { SharedSnapshotCache } from '../../api/shared-response-cache';

describe('shared public snapshots', () => {
  test('many visitors share one load and preserve exact strings', async () => {
    const cache = new SharedSnapshotCache<any>();
    const load = jest.fn(async () => ({ value: '128456589000000000' }));
    const replies = await Promise.all(Array.from({ length: 100 }, () => cache.get('tx', load)));
    expect(load).toHaveBeenCalledTimes(1);
    expect(replies.every(reply => reply.value === '128456589000000000')).toBe(true);
    await cache.get('tx', load); expect(load).toHaveBeenCalledTimes(1);
  });
  test('reorg fences a request that began on the previous tip', async () => {
    const cache = new SharedSnapshotCache<string>();
    let finish!: (value: string) => void;
    const result = cache.get('block', () => new Promise(resolve => { finish = resolve; }));
    await Promise.resolve(); cache.invalidate(); finish('old');
    await expect(result).rejects.toThrow('snapshot changed');
    await expect(cache.get('block', async () => 'new')).resolves.toBe('new');
  });
  test('errors are retried and memory remains bounded', async () => {
    const cache = new SharedSnapshotCache<string>(1, 1000);
    await expect(cache.get('a', async () => { throw new Error('RPC down'); })).rejects.toThrow();
    await cache.get('a', async () => 'a'); await cache.get('b', async () => 'b');
    const reload = jest.fn(async () => 'a'); await cache.get('a', reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
