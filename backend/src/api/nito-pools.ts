import { checkedActivationInfo } from './nito-activation';

/** One in-flight collection, bounded cache, no wallet RPC and no UTXO scan. */
export class NitoPools {
  private cached: any;
  private pending: Promise<any> | undefined;
  private retryAfter = 0;
  private checkedAt = 0;
  private generation = 0;

  constructor(private rpc: any, private network: string, private readChainInfo?: () => unknown) {}

  invalidate(): void { this.generation++; this.cached = undefined; this.pending = undefined; this.checkedAt = 0; }

  snapshot(): any {
    if (!this.cached || Date.now() - this.checkedAt > 10000) {
      throw new Error('Confirmed pool snapshot unavailable or stale');
    }
    return this.cached;
  }

  async get(): Promise<any> {
    if (this.pending) { return this.pending; }
    if (Date.now() < this.retryAfter) { throw new Error('Pool accounting temporarily unavailable'); }
    const generation = this.generation;
    const work = (async () => {
      try {
        const result = await this.collect();
        if (generation !== this.generation) { throw new Error('Confirmed pool snapshot changed; retry'); }
        this.cached = result; this.checkedAt = Date.now(); return result;
      } catch (e) {
        if (generation === this.generation) { this.cached = undefined; this.checkedAt = 0; this.retryAfter = Date.now() + 5000; }
        throw e;
      }
    })();
    this.pending = work;
    try { return await work; }
    finally { if (this.pending === work) { this.pending = undefined; } }
  }

  /** @asyncUnsafe RPC and consistency failures are propagated to get(). */
  private async collect(): Promise<any> {
    const chain = checkedActivationInfo(this.readChainInfo ? this.readChainInfo() : await this.rpc.getBlockchainInfo(), this.network);
    if (this.cached?.bestblockhash === chain.bestblockhash && this.cached?.blocks === chain.blocks
      && this.cached?.activated === chain.activated && this.cached?.privateTxActivationHeight === chain.privateTxActivationHeight) { return this.cached; }
    const indexes = await this.rpc.getIndexInfo();
    if (!indexes.coinstatsindex?.synced || indexes.coinstatsindex.best_block_height < chain.blocks) {
      throw new Error('Synchronized coinstatsindex is required for pool accounting');
    }
    const pools = await this.rpc.getOrchardPools();
    const tip = await this.rpc.getBestBlockHash();
    if (pools.chain !== chain.chain || pools.blocks !== chain.blocks || pools.bestblockhash !== chain.bestblockhash || tip !== chain.bestblockhash) {
      throw new Error('Chain tip changed during pool accounting');
    }
    if (pools.activated !== chain.activated || pools.privateTxActivationHeight !== chain.privateTxActivationHeight) {
      throw new Error('Core activation changed during pool accounting');
    }
    for (const key of ['transparent', 'orchard', 'total']) {
      const pool = pools[key];
      if (!pool?.monitored || !/^\d+$/.test(String(pool.chainValueNitoshi)) ||
          (typeof pool.chainValueNitoshi === 'number' && !Number.isSafeInteger(pool.chainValueNitoshi))) {
        throw new Error('Incomplete or inexact confirmed pool accounting');
      }
      const value = BigInt(pool.chainValueNitoshi);
      pools[key] = { monitored: true, chainValueNitoshi: value.toString(), chainValue: `${value / 100000000n}.${(value % 100000000n).toString().padStart(8, '0')}` };
    }
    if (BigInt(pools.transparent.chainValueNitoshi) + BigInt(pools.orchard.chainValueNitoshi) !== BigInt(pools.total.chainValueNitoshi)) {
      throw new Error('Confirmed pool accounting invariant failed');
    }
    return { ...pools, status: 'confirmed', source: 'core', includes_mempool: false };
  }
}
