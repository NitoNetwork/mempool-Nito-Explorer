export interface NitoActivationSnapshot {
  status: 'active' | 'inactive' | 'unknown';
  activated: boolean | null;
  privateTxActivationHeight: number | null;
  chain: string | null;
  blocks: number | null;
  bestblockhash: string | null;
  source: 'core';
  reason?: string;
}

export interface NitoCoreChainInfo {
  chain: string;
  blocks: number;
  bestblockhash: string;
  initialblockdownload: false;
  privateTxActivationHeight: number;
  activated: boolean;
}

interface ActivationRpc {
  getBlockchainInfo(): Promise<unknown>;
  getBestBlockHash(): Promise<string>;
}

const CHAINS: Record<string, string> = { mainnet: 'main', testnet: 'test', signet: 'signet', regtest: 'regtest' };
class InvalidActivation extends Error {}

function unknown(reason: string): NitoActivationSnapshot {
  return { status: 'unknown', activated: null, privateTxActivationHeight: null,
    chain: null, blocks: null, bestblockhash: null, source: 'core', reason };
}

/** Validate Core's explicit announcement; height alone never enables Orchard. */
export function checkedActivationInfo(raw: unknown, network: string): NitoCoreChainInfo {
  const info = raw as NitoCoreChainInfo | null;
  if (!info || !CHAINS[network] || info.chain !== CHAINS[network]) { throw new InvalidActivation('network-mismatch'); }
  if (info.initialblockdownload !== false) { throw new InvalidActivation('core-synchronizing'); }
  if (!Number.isSafeInteger(info.blocks) || info.blocks < 0 || typeof info.bestblockhash !== 'string' || !/^[a-f0-9]{64}$/.test(info.bestblockhash)) {
    throw new InvalidActivation('invalid-core-tip');
  }
  if (!Number.isSafeInteger(info.privateTxActivationHeight) || info.privateTxActivationHeight < -1 || typeof info.activated !== 'boolean') {
    throw new InvalidActivation('missing-or-invalid-activation');
  }
  if (info.activated !== (info.privateTxActivationHeight >= 0 && info.blocks >= info.privateTxActivationHeight)) {
    throw new InvalidActivation('inconsistent-core-activation');
  }
  return { chain: info.chain, blocks: info.blocks, bestblockhash: info.bestblockhash,
    initialblockdownload: false, privateTxActivationHeight: info.privateTxActivationHeight, activated: info.activated };
}

/** One shared, expiring Core announcement. This never controls mempool admission. */
export class NitoActivation {
  private state: NitoActivationSnapshot = Object.freeze(unknown('not-yet-checked'));
  private chainInfo: NitoCoreChainInfo | undefined;
  private pending: Promise<NitoActivationSnapshot> | undefined;
  private generation = 0;
  private checkedAt = 0;
  private expiry: NodeJS.Timeout | undefined;
  private listeners = new Set<(state: NitoActivationSnapshot) => void>();

  constructor(private rpc: ActivationRpc, private network: string, private maxAgeMs = 30000) {}

  subscribe(listener: (state: NitoActivationSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private publish(state: NitoActivationSnapshot): void {
    if (JSON.stringify(state) === JSON.stringify(this.state)) { return; }
    this.state = Object.freeze(state);
    for (const listener of this.listeners) { listener(this.state); }
  }

  private clearState(reason: string): void {
    clearTimeout(this.expiry); this.expiry = undefined;
    this.chainInfo = undefined; this.checkedAt = 0;
    this.publish(unknown(reason));
  }

  invalidate(reason = 'chain-changed'): void {
    this.generation++;
    this.pending = undefined;
    this.clearState(reason);
  }

  snapshot(): NitoActivationSnapshot {
    if (this.state.status !== 'unknown' && Date.now() - this.checkedAt >= this.maxAgeMs) { this.invalidate('stale'); }
    return this.state;
  }

  /** Reuse the same checked chain state in the confirmed-pool collector. */
  getChainInfo(): NitoCoreChainInfo {
    if (this.snapshot().status === 'unknown' || !this.chainInfo) { throw new Error('Core activation snapshot unavailable'); }
    return { ...this.chainInfo };
  }

  /** @asyncSafe RPC failures produce explicit unknown state. */
  async refresh(): Promise<NitoActivationSnapshot> {
    if (this.pending) { return this.pending; }
    const generation = this.generation;
    const work = (async () => {
      try {
        const raw = await this.rpc.getBlockchainInfo();
        if (generation !== this.generation) { return this.snapshot(); }
        const info = checkedActivationInfo(raw, this.network);
        const tip = await this.rpc.getBestBlockHash();
        if (generation !== this.generation) { return this.snapshot(); }
        if (tip !== info.bestblockhash) { throw new InvalidActivation('chain-changed'); }
        this.chainInfo = info; this.checkedAt = Date.now();
        clearTimeout(this.expiry);
        this.expiry = setTimeout(() => this.invalidate('stale'), this.maxAgeMs);
        this.expiry.unref();
        this.publish({ status: info.activated ? 'active' : 'inactive', activated: info.activated,
          privateTxActivationHeight: info.privateTxActivationHeight, chain: info.chain,
          blocks: info.blocks, bestblockhash: info.bestblockhash, source: 'core' });
        return this.state;
      } catch (error) {
        if (generation === this.generation) { this.invalidate(error instanceof InvalidActivation ? error.message : 'core-unavailable'); }
        return this.snapshot();
      }
    })();
    this.pending = work;
    try { return await work; }
    finally { if (this.pending === work) { this.pending = undefined; } }
  }
}
