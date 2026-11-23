import { MempoolBlock } from '../mempool.interfaces';
import { IBitcoinApi } from './bitcoin/bitcoin-api.interface';
import config from '../config';
import mempool from './mempool';
import projectedBlocks from './mempool-blocks';
import bitcoinClient from './bitcoin/bitcoin-client';
import { coinToNitoshi } from './nito-values';

const isLiquid = config.MEMPOOL.NETWORK === 'liquid' || config.MEMPOOL.NETWORK === 'liquidtestnet';

interface RecommendedFees {
  fastestFee: number,
  halfHourFee: number,
  hourFee: number,
  economyFee: number,
  minimumFee: number,
}

type FeePriority = Exclude<keyof RecommendedFees, 'minimumFee'>;
type CoreRecommendedFees = Record<FeePriority, number | null> & {
  minimumFee: number;
  targetBlocks: Record<FeePriority, number | null>;
};

const coreTargets = [
  ['fastestFee', 2], ['halfHourFee', 30], ['hourFee', 60], ['economyFee', 144],
] as const;

function coreFeeRate(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') { return null; }
  try {
    const rate = Number(coinToNitoshi(value));
    return Number.isSafeInteger(rate) && rate >= 0 ? rate / 1000 : null;
  } catch {
    return null;
  }
}

class FeeApi {
  private nitoFees: CoreRecommendedFees | null = null;
  private refreshAfter = 0;
  private validUntil = 0;
  private generation = 0;

  public invalidate(): void {
    this.generation++;
    this.nitoFees = null;
    this.refreshAfter = 0;
    this.validUntil = 0;
  }

  private getCoreFees(): CoreRecommendedFees | null {
    if (Date.now() >= this.refreshAfter) {
      this.refreshAfter = Date.now() + 30000;
      const generation = this.generation;
      Promise.allSettled([bitcoinClient.getMempoolInfo(), ...coreTargets.map(([, target]) => bitcoinClient.estimateSmartFee(target))])
        .then(([mempoolInfo, ...results]) => {
          if (generation !== this.generation || mempoolInfo.status !== 'fulfilled') { return; }
          const admissionFee = coreFeeRate(mempoolInfo.value.mempoolminfee);
          const relayFee = coreFeeRate(mempoolInfo.value.minrelaytxfee);
          if (admissionFee === null || relayFee === null) { return; }
          const fees: CoreRecommendedFees = {
            fastestFee: null, halfHourFee: null, hourFee: null, economyFee: null,
            minimumFee: Math.max(admissionFee, relayFee),
            targetBlocks: { fastestFee: null, halfHourFee: null, hourFee: null, economyFee: null },
          };
          for (const [index, [priority]] of coreTargets.entries()) {
            const result = results[index];
            if (result.status !== 'fulfilled') { continue; }
            const rate = coreFeeRate(result.value?.feerate);
            const blocks = result.value?.blocks;
            if (rate === null || !Number.isSafeInteger(blocks) || blocks < 1) { continue; }
            fees[priority] = rate;
            fees.targetBlocks[priority] = blocks;
          }
          this.nitoFees = fees;
          this.validUntil = Date.now() + 120_000;
        }).catch(() => { /* An explicit Core outage invalidates immediately. Otherwise the lease expires. */ });
    }
    return Date.now() < this.validUntil ? this.nitoFees : null;
  }
  constructor() { }

  minimumIncrement = isLiquid ? 0.1 : 1;
  minFastestFee = isLiquid ? 0.1 : 1;
  minHalfHourFee = isLiquid ? 0.1 : 0.5;
  priorityFactor = isLiquid ? 0 : 0.5;

  public getRecommendedFee(): RecommendedFees | CoreRecommendedFees | null {
    if (config.MEMPOOL.BACKEND === 'electrum') { return this.getCoreFees(); }
    const pBlocks = projectedBlocks.getMempoolBlocks();
    const mPool = mempool.getMempoolInfo();

    return this.calculateRecommendedFee(pBlocks, mPool);
  }

  public getPreciseRecommendedFee(): RecommendedFees | CoreRecommendedFees | null {
    if (config.MEMPOOL.BACKEND === 'electrum') { return this.getCoreFees(); }
    const pBlocks = projectedBlocks.getMempoolBlocks();
    const mPool = mempool.getMempoolInfo();

    // minimum non-zero minrelaytxfee / incrementalrelayfee is 1 sat/kvB = 0.001 sat/vB
    const recommendations = this.calculateRecommendedFee(pBlocks, mPool, 0.001);
    // enforce floor & offset for highest priority recommendations while <100% hashrate accepts sub-sat fees
    recommendations.fastestFee = Math.max(recommendations.fastestFee + this.priorityFactor, this.minFastestFee);
    recommendations.halfHourFee = Math.max(recommendations.halfHourFee + (this.priorityFactor / 2), this.minHalfHourFee);
    return {
      'fastestFee': Math.round(recommendations.fastestFee * 1000) / 1000,
      'halfHourFee': Math.round(recommendations.halfHourFee * 1000) / 1000,
      'hourFee': Math.round(recommendations.hourFee * 1000) / 1000,
      'economyFee': Math.round(recommendations.economyFee * 1000) / 1000,
      'minimumFee': Math.round(recommendations.minimumFee * 1000) / 1000,
    };
  }

  public calculateRecommendedFee(pBlocks: MempoolBlock[], mPool: IBitcoinApi.MempoolInfo, minIncrement: number = this.minimumIncrement): RecommendedFees {
    const purgeRate = this.roundUpToNearest(mPool.mempoolminfee * 100000, minIncrement);
    const minimumFee = Math.max(purgeRate, minIncrement);

    if (!pBlocks.length) {
      return {
        'fastestFee': minimumFee,
        'halfHourFee': minimumFee,
        'hourFee': minimumFee,
        'economyFee': minimumFee,
        'minimumFee': minimumFee,
      };
    }

    const firstMedianFee = this.optimizeMedianFee(pBlocks[0], pBlocks[1], undefined, minimumFee, minIncrement);
    const secondMedianFee = pBlocks[1] ? this.optimizeMedianFee(pBlocks[1], pBlocks[2], firstMedianFee, minimumFee, minIncrement) : minimumFee;
    const thirdMedianFee = pBlocks[2] ? this.optimizeMedianFee(pBlocks[2], pBlocks[3], secondMedianFee, minimumFee, minIncrement) : minimumFee;

    // explicitly enforce a minimum of ceil(mempoolminfee) on all recommendations.
    // simply rounding up recommended rates is insufficient, as the purging rate
    // can exceed the median rate of projected blocks in some extreme scenarios
    // (see https://bitcoin.stackexchange.com/a/120024)
    let fastestFee = Math.max(minimumFee, firstMedianFee);
    let halfHourFee = Math.max(minimumFee, secondMedianFee);
    let hourFee = Math.max(minimumFee, thirdMedianFee);
    const economyFee = Math.max(minimumFee, Math.min(2 * minimumFee, thirdMedianFee));

    // ensure recommendations always increase w/ priority
    fastestFee = Math.max(fastestFee, halfHourFee, hourFee, economyFee);
    halfHourFee = Math.max(halfHourFee, hourFee, economyFee);
    hourFee = Math.max(hourFee, economyFee);

    return {
      'fastestFee': this.roundToNearest(fastestFee, minIncrement),
      'halfHourFee': this.roundToNearest(halfHourFee, minIncrement),
      'hourFee': this.roundToNearest(hourFee, minIncrement),
      'economyFee': this.roundToNearest(economyFee, minIncrement),
      'minimumFee': this.roundToNearest(minimumFee, minIncrement),
    };
  }

  private optimizeMedianFee(pBlock: MempoolBlock, nextBlock: MempoolBlock | undefined, previousFee: number | undefined, minFee: number, minIncrement: number = this.minimumIncrement): number {
    const useFee = previousFee ? (pBlock.medianFee + previousFee) / 2 : pBlock.medianFee;
    if (pBlock.blockVSize <= 500000 || pBlock.medianFee < minFee) {
      return minFee;
    }
    if (pBlock.blockVSize <= 950000 && !nextBlock) {
      const multiplier = (pBlock.blockVSize - 500000) / 500000;
      return Math.max(this.roundToNearest(useFee * multiplier, minIncrement), minFee);
    }
    return Math.max(this.roundUpToNearest(useFee, minIncrement), minFee);
  }

  private roundUpToNearest(value: number, nearest: number): number {
    if (nearest !== 0) {
      return Math.ceil(value / nearest) * nearest;
    }
    return value;
  }

  private roundToNearest(value: number, nearest: number): number {
    if (nearest !== 0) {
      return Math.round(value / nearest) * nearest;
    }
    return value;
  }
}

export default new FeeApi();
