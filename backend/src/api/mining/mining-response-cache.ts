export interface MiningCachePolicy {
  /** How long a completed value is returned without starting a refresh. */
  freshMs: number;
  /** How long the last completed value may be served while it refreshes. */
  staleMs: number;
  /** A new canonical tip makes this moving aggregate stale immediately. */
  tipSensitive?: boolean;
}

interface MiningCacheEntry<T> {
  value: T;
  freshUntil: number;
  staleUntil: number;
  bytes: number;
  tipSensitive: boolean;
}

const systemClock = (): number => Date.now();

/**
 * Process-wide cache for expensive, public mining aggregates.
 *
 * A cold key is coalesced and awaited once. Once populated, an expired value is
 * returned immediately while exactly one refresh runs in the background. This
 * keeps every visitor on the same completed snapshot instead of exposing an
 * empty dashboard during each SQL refresh.
 */
export class MiningResponseCache {
  private generation = 0;
  private unsafeGeneration = 0;
  private enabled = true;
  private entries = new Map<string, MiningCacheEntry<unknown>>();
  private pending = new Map<string, Promise<unknown>>();
  private pendingTipEpoch = new Map<string, number>();
  private bytes = 0;
  private tip = '';
  private tipEpoch = 0;

  public hits = 0;
  public staleHits = 0;
  public coalesced = 0;
  public loads = 0;

  constructor(
    private maxEntries = 128,
    private maxBytes = 64 * 1024 * 1024,
    private now: () => number = systemClock,
  ) {}

  public async get<T>(key: string, policy: MiningCachePolicy, load: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      throw new Error('Mining snapshots are unavailable; retry');
    }
    const entry = this.entries.get(key) as MiningCacheEntry<T> | undefined;
    const now = this.now();
    if (entry && entry.freshUntil > now) {
      this.touch(key, entry);
      this.hits++;
      return entry.value;
    }

    if (entry && entry.staleUntil > now) {
      this.touch(key, entry);
      this.staleHits++;
      this.refresh(key, policy, load).catch(() => undefined);
      return entry.value;
    }

    const pending = this.pending.get(key) as Promise<T> | undefined;
    if (pending) {
      this.coalesced++;
      return pending;
    }
    return this.refresh(key, policy, load);
  }

  /** Hard fence used for reorgs and backend outages. */
  public invalidate(): void {
    this.generation++;
    this.unsafeGeneration = this.generation;
    this.entries.clear();
    this.pending.clear();
    this.pendingTipEpoch.clear();
    this.bytes = 0;
  }

  public suspend(): void {
    this.enabled = false;
    this.tip = '';
    this.invalidate();
  }

  public resume(): boolean {
    const recovered = !this.enabled;
    this.enabled = true;
    return recovered;
  }

  public get available(): boolean {
    return this.enabled;
  }

  public get size(): number {
    return this.entries.size;
  }

  /** Keep completed moving aggregates visible, but refresh them after a new block. */
  public observeTip(tip: string): boolean {
    const changed = !!this.tip && !!tip && this.tip !== tip;
    this.tip = tip;
    if (changed) {
      this.tipEpoch++;
      const now = this.now();
      for (const entry of this.entries.values()) {
        if (entry.tipSensitive) {
          entry.freshUntil = Math.min(entry.freshUntil, now);
        }
      }
      // Detach work started for the previous tip. It may finish, but it cannot
      // publish and must not coalesce the new tip's refresh.
      for (const [key, epoch] of this.pendingTipEpoch) {
        if (epoch !== this.tipEpoch) {
          this.pending.delete(key);
          this.pendingTipEpoch.delete(key);
        }
      }
    }
    return changed;
  }

  private refresh<T>(key: string, policy: MiningCachePolicy, load: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key) as Promise<T> | undefined;
    if (existing) {
      this.coalesced++;
      return existing;
    }

    const generation = this.generation;
    const tipEpoch = this.tipEpoch;
    this.loads++;
    const work = Promise.resolve().then(load).then(value => {
      if (policy.tipSensitive === true && tipEpoch !== this.tipEpoch) {
        throw new Error('Mining tip changed; retry');
      }
      if (generation !== this.generation) {
        if (generation < this.unsafeGeneration) {
          throw new Error('Mining snapshot changed; retry');
        }
        return value;
      }
      this.store(key, value, policy);
      return value;
    }).finally(() => {
      if (this.pending.get(key) === work) {
        this.pending.delete(key);
        this.pendingTipEpoch.delete(key);
      }
    });
    if (this.pending.size < this.maxEntries) {
      this.pending.set(key, work);
      if (policy.tipSensitive === true) {
        this.pendingTipEpoch.set(key, tipEpoch);
      }
    }
    return work;
  }

  private store<T>(key: string, value: T, policy: MiningCachePolicy): void {
    let serialized: string | undefined;
    try {
      serialized = JSON.stringify(value);
    } catch (e) {
      return;
    }
    const bytes = serialized === undefined ? 0 : Buffer.byteLength(serialized);
    if (bytes > this.maxBytes) {
      return;
    }

    const previous = this.entries.get(key);
    if (previous) {
      this.bytes -= previous.bytes;
      this.entries.delete(key);
    }
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      const oldest = this.entries.get(oldestKey);
      if (oldest) {
        this.bytes -= oldest.bytes;
      }
      this.entries.delete(oldestKey);
    }

    const now = this.now();
    this.entries.set(key, {
      value,
      bytes,
      tipSensitive: policy.tipSensitive === true,
      freshUntil: now + policy.freshMs,
      staleUntil: now + policy.freshMs + policy.staleMs,
    });
    this.bytes += bytes;
  }

  private touch<T>(key: string, entry: MiningCacheEntry<T>): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }
}

export const MINING_CACHE_POLICY = {
  liveAggregate: { freshMs: 60_000, staleMs: 10 * 60_000, tipSensitive: true },
  historical: { freshMs: 5 * 60_000, staleMs: 30 * 60_000 },
  poolList: { freshMs: 5 * 60_000, staleMs: 30 * 60_000 },
  immutablePage: { freshMs: 24 * 60 * 60_000, staleMs: 7 * 24 * 60 * 60_000 },
} satisfies Record<string, MiningCachePolicy>;

export function miningHistoryPolicy(interval: string): MiningCachePolicy {
  return ['24h', '3d', '1w', 'all'].includes(interval)
    ? MINING_CACHE_POLICY.liveAggregate
    : MINING_CACHE_POLICY.historical;
}

export default new MiningResponseCache();
