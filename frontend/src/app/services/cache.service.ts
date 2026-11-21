import { Injectable } from '@angular/core';
import { firstValueFrom, Subject, Subscription} from 'rxjs';
import { Transaction } from '@interfaces/electrs.interface';
import { BlockExtended } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';

const BLOCK_CACHE_SIZE = 500;
const KEEP_RECENT_BLOCKS = 50;
const TX_CACHE_SIZE = 500;

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  loadedBlocks$ = new Subject<BlockExtended>();
  tip: number = 0;

  txCache: { [txid: string]: Transaction } = {};
  private txCachedAt = new Map<string, number>();
  private generation = 0;
  private latestTip = '';
  private latestTipHeight = -1;
  private connectionAvailable = true;
  private backendAvailable = true;

  network: string;
  blockHashCache: { [hash: string]: BlockExtended } = {};
  blockCache: { [height: number]: BlockExtended } = {};
  blockLoading: { [height: number]: boolean } = {};
  copiesInBlockQueue: { [height: number]: number } = {};
  blockPriorities: number[] = [];

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
  ) {
    this.stateService.blocks$.subscribe((blocks) => {
      if (!this.connectionAvailable || !this.backendAvailable) { return; }
      const tipBlock = blocks[0];
      const tip = tipBlock?.id;
      const reorg = (!tip && !!this.latestTip) || !!tipBlock && (
        (this.latestTipHeight >= 0 && tipBlock.height < this.latestTipHeight) ||
        (tipBlock.height === this.latestTipHeight && !!this.latestTip && tipBlock.id !== this.latestTip) ||
        blocks.some(block => this.blockCache[block.height] && this.blockCache[block.height].id !== block.id)
      );
      if (reorg) {
        this.invalidate(); this.latestTip = tip || ''; this.latestTipHeight = tipBlock?.height ?? -1;
      } else if (tip && tip !== this.latestTip) {
        this.generation++; this.blockLoading = {};
        this.clearUnconfirmedTransactions(); this.latestTip = tip; this.latestTipHeight = tipBlock.height;
      }
      for (const block of blocks) {
        this.addBlockToCache(block);
      }
      this.clearBlocks();
    });
    this.stateService.chainTip$.subscribe((height) => {
      this.tip = height;
    });
    this.stateService.networkChanged$.subscribe((network) => {
      this.network = network;
      this.latestTip = '';
      this.latestTipHeight = -1;
      this.resetBlockCache();
      this.txCache = {};
      this.txCachedAt.clear();
    });
    this.stateService.connectionState$.subscribe(state => {
      this.connectionAvailable = state === 2;
      if (!this.connectionAvailable) { this.invalidate(); }
    });
    this.stateService.nitoStatus$.subscribe(status => {
      this.backendAvailable = status?.available !== false;
      if (!this.backendAvailable) { this.invalidate(); }
    });
  }

  private invalidate(): void {
    this.resetBlockCache(); this.txCache = {}; this.txCachedAt.clear();
  }

  private clearUnconfirmedTransactions(): void {
    for (const [txid, transaction] of Object.entries(this.txCache)) {
      if (!transaction.status?.confirmed) {
        delete this.txCache[txid];
        this.txCachedAt.delete(txid);
      }
    }
  }

  setTxCache(transactions) {
    if (!this.connectionAvailable || !this.backendAvailable) { return; }
    transactions.forEach(tx => {
      this.txCache[tx.txid] = tx;
      this.txCachedAt.delete(tx.txid); this.txCachedAt.set(tx.txid, Date.now());
    });
    while (this.txCachedAt.size > TX_CACHE_SIZE) {
      const oldest = this.txCachedAt.keys().next().value;
      delete this.txCache[oldest]; this.txCachedAt.delete(oldest);
    }
  }

  getTxFromCache(txid) {
    if (!this.connectionAvailable || !this.backendAvailable) { return null; }
    const tx = this.txCache[txid];
    if (tx && Date.now() - (this.txCachedAt.get(txid) || 0) < (tx.status?.confirmed ? 30000 : 2000)) {
      return this.txCache[txid];
    } else {
      return null;
    }
  }

  addBlockToCache(block: BlockExtended) {
    if (!this.connectionAvailable || !this.backendAvailable) { return; }
    if (!this.blockHashCache[block.id]) {
      this.blockHashCache[block.id] = block;
      this.blockCache[block.height] = block;
      this.bumpBlockPriority(block.height);
    }
  }

  async loadBlock(height) {
    if (!this.connectionAvailable || !this.backendAvailable) { return; }
    if (!this.blockCache[height] && !this.blockLoading[height]) {
      const generation = this.generation;
      const chunkSize = 10;
      const maxHeight = Math.ceil(height / chunkSize) * chunkSize;
      for (let i = 0; i < chunkSize; i++) {
        this.blockLoading[maxHeight - i] = true;
      }
      let result;
      try {
        result = await firstValueFrom(this.apiService.getBlocks$(maxHeight));
      } catch (e) {
        console.log('failed to load blocks: ', e.message);
      }
      // A previous response must not repopulate caches or clear a newer request.
      if (generation !== this.generation) { return; }
      if (result && result.length) {
        result.forEach(block => {
          if (this.blockLoading[block.height]) {
            this.addBlockToCache(block);
            this.loadedBlocks$.next(block);
          }
        });
      }
      for (let i = 0; i < chunkSize; i++) {
        delete this.blockLoading[maxHeight - i];
      }
      this.clearBlocks();
    } else {
      this.bumpBlockPriority(height);
    }
  }

  // increase the priority of a block, to delay removal
  bumpBlockPriority(height) {
    this.blockPriorities.push(height);
    this.copiesInBlockQueue[height] = (this.copiesInBlockQueue[height] || 0) + 1;
  }

  // remove lowest priority blocks from the cache
  clearBlocks() {
    while (Object.keys(this.blockCache).length > (BLOCK_CACHE_SIZE + KEEP_RECENT_BLOCKS) && this.blockPriorities.length > KEEP_RECENT_BLOCKS) {
      const height = this.blockPriorities.shift();
      if (this.copiesInBlockQueue[height] > 1) {
        this.copiesInBlockQueue[height]--;
      } else if ((this.tip - height) < KEEP_RECENT_BLOCKS) {
        this.bumpBlockPriority(height);
      } else {
        const block = this.blockCache[height];
        delete this.blockCache[height];
        delete this.blockHashCache[block.id];
        delete this.copiesInBlockQueue[height];
      }
    }
  }

  // remove all blocks from the cache
  resetBlockCache() {
    this.generation++;
    this.blockHashCache = {};
    this.blockCache = {};
    this.apiService.blockAuditLoaded = {};
    this.blockLoading = {};
    this.copiesInBlockQueue = {};
    this.blockPriorities = [];
  }

  getCachedBlock(height) {
    if (!this.connectionAvailable || !this.backendAvailable) { return undefined; }
    return this.blockCache[height];
  }
}
