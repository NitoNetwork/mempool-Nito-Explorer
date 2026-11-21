import { Request, Response, NextFunction } from 'express';

type Reply = { body: string; status: number; type: string };

/** Bounded process-wide memoization with soft refresh and hard failure fences. */
export class SharedSnapshotCache<T> {
  private generation = 0;
  private unsafeGeneration = 0;
  private entries = new Map<string, { value: T; expires: number; bytes: number }>();
  private pending = new Map<string, Promise<T>>();
  private bytes = 0;
  public hits = 0;
  public coalesced = 0;
  constructor(private maxEntries = 256, private maxBytes = 16 * 1024 * 1024,
    private ttl = 4000, private size = (value: T) => Buffer.byteLength(JSON.stringify(value))) {}

  invalidate(refuseInFlight = true): void {
    this.generation++;
    if (refuseInFlight) { this.unsafeGeneration = this.generation; }
    this.entries.clear(); this.pending.clear(); this.bytes = 0;
  }

  peek(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) { return undefined; }
    this.entries.delete(key); this.entries.set(key, entry); this.hits++;
    return entry.value;
  }

  async get(key: string, load: () => Promise<T>, cacheable = (_value: T) => true): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.expires > Date.now()) {
      this.entries.delete(key); this.entries.set(key, entry); this.hits++;
      return entry.value;
    }
    const existing = this.pending.get(key);
    if (existing) { this.coalesced++; return existing; }
    const generation = this.generation;
    const work = Promise.resolve().then(load).then(value => {
      if (generation !== this.generation) {
        // A completed public snapshot remains safe to return across a normal
        // refresh, but must never be retained in the new generation. Reorgs
        // and provider failures use a hard invalidation and reject it.
        if (generation < this.unsafeGeneration) { throw new Error('Public chain snapshot changed; retry'); }
        return value;
      }
      const bytes = this.size(value);
      if (cacheable(value) && bytes <= this.maxBytes) {
        const previous = this.entries.get(key);
        if (previous) { this.bytes -= previous.bytes; this.entries.delete(key); }
        while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
          const first = this.entries.keys().next().value;
          if (first === undefined) { break; }
          this.bytes -= this.entries.get(first)!.bytes; this.entries.delete(first);
        }
        this.entries.set(key, { value, bytes, expires: Date.now() + this.ttl }); this.bytes += bytes;
      }
      return value;
    }).finally(() => { if (this.pending.get(key) === work) { this.pending.delete(key); } });
    // Do not retain unbounded unique requests while a provider is slow.
    if (this.pending.size < this.maxEntries) { this.pending.set(key, work); }
    return work;
  }
}

class PublicResponses {
  private chain = new SharedSnapshotCache<Reply>();
  private live = new SharedSnapshotCache<Reply>();
  private tip = '';
  private txids = new Set<string>();
  private healthy = false;
  private chainChanging = false;
  private liveChanging = false;

  observe(tip: string, txids: string[]): void {
    if (!this.healthy || this.tip !== tip) { this.chain.invalidate(false); this.live.invalidate(false); }
    else if (txids.length !== this.txids.size || txids.some(id => !this.txids.has(id))) { this.live.invalidate(false); }
    this.tip = tip; this.txids = new Set(txids); this.healthy = !!tip;
    this.chainChanging = false; this.liveChanging = false;
  }

  unavailable(): void {
    this.healthy = false; this.chainChanging = false; this.liveChanging = false;
    this.chain.invalidate(); this.live.invalidate();
  }

  changingMempool(txids: string[]): void {
    // Keep the last completed shared snapshot readable while the in-memory
    // mempool is updated. observe() softly invalidates live responses after
    // the new set is complete.
    if (txids.length !== this.txids.size || txids.some(id => !this.txids.has(id))) { this.liveChanging = true; }
  }

  changingChain(): void {
    // A normal new block is stale-while-refresh, not an outage. The last
    // completed public snapshot stays readable until observe() atomically
    // moves the cache to the new tip. Reorgs still call unavailable().
    this.chainChanging = true; this.liveChanging = true;
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path.replace(/^\/api\/v1\//, '');
    // No address, wallet, auth, arbitrary query or write is shared across users.
    const block = /^(?:block\/[a-f0-9]{64}(?:\/(?:txs(?:\/\d+)?|summary|header|status|txids|txid\/\d+))?|blocks(?:\/\d+)?|block-height\/\d+)$/.test(path);
    const tx = /^tx\/[a-f0-9]{64}(?:\/(?:hex|status|outspends))?$/.test(path);
    const mining = /^mining\/(?:pools(?:\/[a-z0-9]+)?|pool\/[a-z0-9_-]+(?:\/(?:hashrate|blocks(?:\/\d+)?))?|hashrate\/(?:pools\/)?[a-z0-9]+|difficulty-adjustments(?:\/[a-z0-9]+)?|reward-stats\/\d+|blocks\/(?:fees|rewards|fee-rates|sizes-weights)(?:\/[a-z0-9]+)?)$/.test(path);
    const statistics = /^statistics\/(?:2h|24h|1w|1m|3m|6m|1y|2y|3y|4y|all)$/.test(path);
    if (req.method !== 'GET' || req.url.includes('?') || req.headers.authorization || (!block && !tx && !mining && !statistics)) {
      next(); return;
    }
    if (!this.healthy) {
      res.status(503).setHeader('Retry-After', '1');
      res.send('Public chain snapshot unavailable; retry'); return;
    }
    const send = res.send.bind(res);
    const cache = block || mining ? this.chain : this.live;
    const changing = block || mining ? this.chainChanging : this.liveChanging;
    if (changing) {
      const stale = cache.peek(req.path);
      if (stale) {
        res.status(stale.status).type(stale.type).setHeader('Cache-Control', 'no-store');
        send(stale.body); return;
      }
    }
    cache.get(req.path, () => new Promise<Reply>((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => { done = true; reject(new Error('Public request timed out')); }, 30000);
      res.send = ((body: any) => {
        if (done) { return res; }
        done = true; clearTimeout(timer);
        resolve({ body: typeof body === 'string' ? body : JSON.stringify(body), status: res.statusCode,
          type: String(res.getHeader('Content-Type') || 'application/json; charset=utf-8') });
        return res;
      }) as Response['send'];
      next();
    }), reply => reply.status === 200).then(reply => {
      if (res.destroyed || res.writableEnded) { return; }
      res.status(reply.status).type(reply.type).setHeader('Cache-Control', 'no-store');
      send(reply.body);
    }).catch(() => {
      if (!res.destroyed && !res.writableEnded) { res.status(503).setHeader('Retry-After', '1'); send('Public chain snapshot unavailable; retry'); }
    });
  };
}

export default new PublicResponses();
