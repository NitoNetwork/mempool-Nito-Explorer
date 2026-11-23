import { Amount, amount, addAmounts, sumAmounts, subtractAmounts, compareAmounts, coinToNitoshi } from './nito-values';
import config from '../config';
import bitcoinApi, { bitcoinCoreApi } from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { BlockExtended, BlockExtension, BlockSummary, PoolTag, TransactionExtended, TransactionMinerInfo, CpfpSummary, MempoolTransactionExtended, TransactionClassified, BlockAudit, TransactionAudit } from '../mempool.interfaces';
import { Common } from './common';
import { nitoshi, privateMetadataState, safeNitoshi } from './nito-values';
import diskCache from './disk-cache';
import transactionUtils from './transaction-utils';
import bitcoinClient from './bitcoin/bitcoin-client';
import { IBitcoinApi } from './bitcoin/bitcoin-api.interface';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import poolsRepository from '../repositories/PoolsRepository';
import blocksRepository from '../repositories/BlocksRepository';
import loadingIndicators from './loading-indicators';
import BitcoinApi from './bitcoin/bitcoin-api';
import BlocksRepository from '../repositories/BlocksRepository';
import HashratesRepository from '../repositories/HashratesRepository';
import indexer from '../indexer';
import poolsParser from './pools-parser';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import BlocksAuditsRepository from '../repositories/BlocksAuditsRepository';
import cpfpRepository from '../repositories/CpfpRepository';
import mining from './mining/mining';
import DifficultyAdjustmentsRepository from '../repositories/DifficultyAdjustmentsRepository';
import PricesRepository from '../repositories/PricesRepository';
import priceUpdater from '../tasks/price-updater';
import chainTips from './chain-tips';
import websocketHandler from './websocket-handler';
import redisCache from './redis-cache';
import rbfCache from './rbf-cache';
import { calcBitsDifference } from './difficulty-adjustment';
import AccelerationRepository from '../repositories/AccelerationRepository';
import { calculateFastBlockCpfp, calculateGoodBlockCpfp } from './cpfp';
import mempool from './mempool';
import CpfpRepository from '../repositories/CpfpRepository';
import { parseDATUMTemplateCreator } from '../utils/bitcoin-script';
import database from '../database';
import { getBlockFirstSeenFromLogs, getOldestLogTimestampFromLogs, scanLogsForBlocksFirstSeen } from '../utils/file-read';
import { calculateStaleBlockStats } from './nito-stale-block-stats';
import { reconstructBlockAmounts } from '../repositories/nito-block-amounts';

const TRUSTED_POOL_DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/i;
const TRUSTED_POOL_MARKER = /\b(?:NitroPool|NitoPool|zpool|ckpool|Miningcore|Mining4People|koinium|yiimp)\b/i;
const NODE_MINING_SOFTWARE_MARKER = /\bMined with (?:RMT|RTS) Node on (?:Umbrel|ZimaOS)\b/i;

class Blocks {
  private blocks: BlockExtended[] = [];
  private blockSummaries: BlockSummary[] = [];
  private currentBlockHeight = 0;
  private currentBits = 0;
  private lastDifficultyAdjustmentTime = 0;
  private previousDifficultyRetarget = 0;
  private quarterEpochBlockTime: number | null = null;
  private newBlockCallbacks: ((block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => void)[] = [];
  private newAsyncBlockCallbacks: ((block: BlockExtended, txIds: string[], transactions: MempoolTransactionExtended[]) => Promise<void>)[] = [];
  private classifyingBlocks: boolean = false;
  private oldestCoreLogTimestamp: number | undefined | null = undefined;

  private mainLoopTimeout: number = 120000;

  constructor() { }

  public getBlocks(): BlockExtended[] {
    return this.blocks;
  }

  public setBlocks(blocks: BlockExtended[]) {
    this.blocks = blocks;
  }

  public getBlockSummaries(): BlockSummary[] {
    return this.blockSummaries;
  }

  public setBlockSummaries(blockSummaries: BlockSummary[]) {
    this.blockSummaries = blockSummaries;
  }

  public setNewBlockCallback(fn: (block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => void) {
    this.newBlockCallbacks.push(fn);
  }

  public setNewAsyncBlockCallback(fn: (block: BlockExtended, txIds: string[], transactions: MempoolTransactionExtended[]) => Promise<void>) {
    this.newAsyncBlockCallbacks.push(fn);
  }

  private startAsyncBlockCallbacks(block: BlockExtended, txIds: string[], transactions: MempoolTransactionExtended[]): Promise<PromiseSettledResult<void>[]> {
    // Observe failures immediately, including synchronous callback throws. The
    // caller may perform other awaited work before collecting these results.
    return Promise.allSettled(this.newAsyncBlockCallbacks.map(callback => Promise.resolve().then(() => callback(block, txIds, transactions))));
  }

  /**
   * Return the list of transaction for a block
   * @param blockHash
   * @param blockHeight
   * @param onlyCoinbase - Set to true if you only need the coinbase transaction
   * @param txIds - optional ordered list of transaction ids if already known
   * @param quiet - don't print non-essential logs
   * @param addMempoolData - calculate sigops etc
   * @returns Promise<TransactionExtended[]>
   *
   * @asyncUnsafe
   */
  private async $getTransactionsExtended(
    blockHash: string,
    blockHeight: number,
    blockTime: number,
    onlyCoinbase: boolean,
    txIds: string[] | null = null,
    quiet: boolean = false,
    addMempoolData: boolean = false,
    stale: boolean = false,
  ): Promise<TransactionExtended[]> {
    const isEsplora = config.MEMPOOL.BACKEND === 'esplora';
    const transactionMap: { [txid: string]: TransactionExtended } = {};

    if (!txIds) {
      txIds = await bitcoinApi.$getTxIdsForBlock(blockHash, stale);
    }

    const mempool = memPool.getMempool();
    let foundInMempool = 0;
    let totalFound = 0;
    const missing = 0;

    // Copy existing transactions from the mempool
    if (!onlyCoinbase) {
      for (const txid of txIds) {
        if (mempool[txid]) {
          mempool[txid].status = {
            confirmed: true,
            block_height: blockHeight,
            block_hash: blockHash,
            block_time: blockTime,
          };
          transactionMap[txid] = mempool[txid];
          foundInMempool++;
          totalFound++;
        }
      }
    }

    if (onlyCoinbase) {
      if (!isEsplora) {
        try {
          const blockTransactions = await bitcoinApi.$getTxsForBlock(blockHash, stale);
          const coinbase = blockTransactions[0] ? (addMempoolData ? transactionUtils.extendMempoolTransaction(blockTransactions[0]) : transactionUtils.extendTransaction(blockTransactions[0])) : null;
          if (coinbase && coinbase.vin[0].is_coinbase) {
            return [coinbase];
          }
        } catch (e) {
          logger.err(`Cannot fetch coinbase tx for block ${blockHash}. Reason: ` + (e instanceof Error ? e.message : e));
          if (!stale) {
            throw e;
          }
        }
      }
      try {
        const coinbase = await transactionUtils.$getTransactionExtendedRetry(txIds[0], false, false, false, addMempoolData);
        if (coinbase && coinbase.vin[0].is_coinbase) {
          return [coinbase];
        } else {
          const msg = `Expected a coinbase tx, but the backend API returned something else`;
          logger.err(msg);
          throw new Error(msg);
        }
      } catch (e) {
        const msg = `Cannot fetch coinbase tx ${txIds[0]}. Reason: ` + (e instanceof Error ? e.message : e);
        logger.err(msg);
        // tolerate this error for stale blocks (the cb transaction won't be accessible via normal RPCs)
        if (!stale) {
          throw new Error(msg);
        }
      }
    }

    // Fetch remaining txs in bulk. Core-backed deployments should use the block
    // hash path so confirmed transactions can be read without requiring txindex.
    if ((!isEsplora && txIds.length - totalFound > 0) || (isEsplora && (txIds.length - totalFound > 500)) || stale) {
      try {
        const rawTransactions = await bitcoinApi.$getTxsForBlock(blockHash, stale);
        for (const tx of rawTransactions) {
          if (!transactionMap[tx.txid]) {
            transactionMap[tx.txid] = addMempoolData ? transactionUtils.extendMempoolTransaction(tx) : transactionUtils.extendTransaction(tx);
            totalFound++;
          }
        }
      } catch (e) {
        logger.err(`Cannot fetch bulk txs for block ${blockHash}. Reason: ` + (e instanceof Error ? e.message : e));
      }
    }

    // Fetch remaining txs individually
    for (const txid of txIds.filter(txid => !transactionMap[txid])) {
      if (!quiet && (totalFound % (Math.round((txIds.length) / 10)) === 0 || totalFound + 1 === txIds.length)) { // Avoid log spam
        logger.debug(`Indexing tx ${totalFound + 1} of ${txIds.length} in block #${blockHeight}`);
      }
      try {
        const tx = await transactionUtils.$getTransactionExtendedRetry(txid, false, false, false, addMempoolData);
        transactionMap[txid] = tx;
        totalFound++;
      } catch (e) {
        const msg = `Cannot fetch tx ${txid}. Reason: ` + (e instanceof Error ? e.message : e);
        logger.err(msg);
        throw new Error(msg);
      }
    }

    if (!quiet) {
      logger.debug(`${foundInMempool} of ${txIds.length} found in mempool. ${totalFound - foundInMempool} fetched through backend service.`);
    }

    // Require the first transaction to be a coinbase
    const coinbase = transactionMap[txIds[0]];
    if (!coinbase || !coinbase.vin[0].is_coinbase) {
      const msg = `Expected first tx in a block to be a coinbase, but found something else`;
      logger.err(msg);
      throw new Error(msg);
    }

    // Require all transactions to be present
    if (txIds.some(txid => !transactionMap[txid])) {
      const msg = `Failed to fetch ${txIds.length - totalFound} transactions from block`;
      logger.err(msg);
      throw new Error(msg);
    }

    // Return list of transactions, preserving block order
    return txIds.map(txid => transactionMap[txid]);
  }

  /**
   * Return a block summary (list of stripped transactions)
   * @param block
   * @returns BlockSummary
   */
  public summarizeBlock(block: IBitcoinApi.VerboseBlock): BlockSummary {
    if (Common.isLiquid()) {
      block = this.convertLiquidFees(block);
    }
    const stripped = block.tx.map((tx: IBitcoinApi.VerboseTransaction) => {
      const value = tx.vout.reduce((sum, output) => sum + nitoshi(output.value), 0n).toString();
      const state = privateMetadataState(tx);
      return {
        txid: tx.txid,
        wtxid: tx.hash,
        weight: tx.weight,
        serialized_vsize: tx.vsize,
        has_private_bundle: state !== 'transparent',
        private_bundle: tx.private_bundle,
        private_metadata_status: state,
        vsize: tx.weight / 4,
        fee: tx.vin[0]?.coinbase ? '0' : tx.fee != null ? safeNitoshi(tx.fee) : '-1',
        rate: state !== 'transparent' ? -1 : undefined,
        value,
        flags: 0,
      };
    });

    return {
      id: block.hash,
      transactions: stripped
    };
  }

  public summarizeBlockTransactions(hash: string, height: number, transactions: TransactionExtended[]): BlockSummary {
    return {
      id: hash,
      transactions: Common.classifyTransactions(transactions, height),
    };
  }

  private convertLiquidFees(block: IBitcoinApi.VerboseBlock): IBitcoinApi.VerboseBlock {
    block.tx.forEach(tx => {
      if (!isFinite(Number(tx.fee))) {
        tx.fee = Object.values(tx.fee || {}).reduce((total, output) => total + output, 0);
      }
    });
    return block;
  }

  /**
   * Return a block with additional data (reward, coinbase, fees...)
   * @param block
   * @param transactions
   * @returns BlockExtended
   *
   * @asyncUnsafe
   */
  private async $getBlockExtended(block: IEsploraApi.Block, transactions: TransactionExtended[]): Promise<BlockExtended> {
    const coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);

    const blk: Partial<BlockExtended> = Object.assign({}, block);
    const extras: Partial<BlockExtension> = {};

    extras.reward = sumAmounts(transactions[0].vout.map(vout => vout.value));
    extras.coinbaseRaw = coinbaseTx.vin[0].scriptsig;
    extras.orphans = chainTips.getOrphanedBlocksAtHeight(blk.height);

    if (block.height === 0) {
      extras.medianFee = 0; // 50th percentiles
      extras.feeRange = [0, 0, 0, 0, 0, 0, 0];
      extras.totalFees = '0';
      extras.avgFee = '0';
      extras.avgFeeRate = 0;
      extras.utxoSetChange = 0;
      extras.avgTxSize = 0;
      extras.totalInputs = 0;
      extras.totalOutputs = 1;
      extras.totalOutputAmt = '0';
      extras.segwitTotalTxs = 0;
      extras.segwitTotalSize = 0;
      extras.segwitTotalWeight = 0;
    } else {
      const stats: IBitcoinApi.BlockStats = await this.$getBlockStats(block, transactions);
      let feeStats = {
        medianFee: stats.feerate_percentiles[2], // 50th percentiles
        feeRange: [stats.minfeerate, stats.feerate_percentiles, stats.maxfeerate].flat(),
      };
        // Core block statistics use serialized weight. Historical Orchard policy
        // sizes are unavailable; do not replace these with unknown policy rates.
        if (config.MEMPOOL.BACKEND !== 'electrum' && transactions?.length > 1) {
        feeStats = Common.calcEffectiveFeeStatistics(transactions);
      }
      extras.medianFee = feeStats.medianFee;
      extras.feeRange = feeStats.feeRange;
      extras.totalFees = amount(stats.totalfee);
      extras.avgFee = amount(stats.avgfee);
      extras.avgFeeRate = stats.avgfeerate;
      extras.utxoSetChange = stats.utxo_increase;
      extras.avgTxSize = Math.round(stats.total_size / stats.txs * 100) * 0.01;
      extras.totalInputs = stats.ins;
      extras.totalOutputs = stats.outs;
      extras.totalOutputAmt = amount(stats.total_out);
      extras.segwitTotalTxs = stats.swtxs;
      extras.segwitTotalSize = stats.swtotal_size;
      extras.segwitTotalWeight = stats.swtotal_weight;
    }

    if (Common.blocksSummariesIndexingEnabled()) {
      extras.feePercentiles = await BlocksSummariesRepository.$getFeePercentilesByBlockId(block.id);
      if (extras.feePercentiles !== null) {
        extras.medianFeeAmt = extras.feePercentiles[3];
      }
    }

    extras.virtualSize = block.weight / 4.0;
    if (coinbaseTx?.vout.length > 0) {
      // Nito: detect miner address (handles direct-pay and normal pools)
      const addrInfo = this.$detectMinerAddress(coinbaseTx.vout);
      if (addrInfo) {
        extras.coinbaseAddress = addrInfo.isDirectPay ? addrInfo.feeAddress : addrInfo.minerAddress;
      } else {
        extras.coinbaseAddress = coinbaseTx.vout[0]?.scriptpubkey_address ?? null;
      }
      extras.coinbaseAddresses = [...new Set<string>(coinbaseTx.vout.map(v => v.scriptpubkey_address).filter(a => a) as string[])];
      extras.coinbaseSignature = coinbaseTx.vout[0].scriptpubkey_asm ?? null;
      extras.coinbaseSignatureAscii = transactionUtils.hex2ascii(coinbaseTx.vin[0].scriptsig) ?? null;
    } else {
      extras.coinbaseAddress = null;
      extras.coinbaseAddresses = null;
      extras.coinbaseSignature = null;
      extras.coinbaseSignatureAscii = null;
    }

    const header = await bitcoinClient.getBlockHeader(block.id, false);
    extras.header = header;

    const coinStatsIndex = indexer.isCoreIndexReady('coinstatsindex');
    if (coinStatsIndex !== null && coinStatsIndex.best_block_height >= block.height) {
      const txoutset = await bitcoinClient.getTxoutSetinfo('none', block.height);
      extras.utxoSetSize = txoutset.txouts,
      extras.totalInputAmt = coinToNitoshi(txoutset.block_info.prevout_spent);
    } else {
      extras.utxoSetSize = null;
      extras.totalInputAmt = null;
    }

    if (config.MEMPOOL.BACKEND === 'electrum') {
      // Turnover within a block may exceed MAX_MONEY (or int64) even though
      // every transaction is valid. Reconstruct public sums with BigInt.
      const complete = transactions.length === block.tx_count;
      const ordinary = complete ? transactions.slice(1) : (await bitcoinClient.getBlock(block.id, 2)).tx.slice(1);
      extras.totalOutputAmt = sumAmounts(ordinary.flatMap(tx => tx.vout.map(output => complete ? output.value : coinToNitoshi(output.value))));
      const metadataComplete = ordinary.every(tx => !tx.has_private_bundle || tx.private_bundle?.value_balance != null);
      extras.totalInputAmt = metadataComplete
        ? subtractAmounts(addAmounts(extras.totalOutputAmt, extras.totalFees || '0'), sumAmounts(ordinary.map(tx => coinToNitoshi(tx.private_bundle?.value_balance ?? '0'))))
        : null;
    }

    if (['mainnet', 'testnet', 'signet', 'testnet4', 'regtest'].includes(config.MEMPOOL.NETWORK)) {
      let pool: PoolTag;
      if (coinbaseTx !== undefined) {
        pool = await this.$findBlockMiner(coinbaseTx, block.height, !block.stale);
      } else {
        if (config.DATABASE.ENABLED === true) {
          pool = await poolsRepository.$getUnknownPool();
        } else {
          pool = poolsParser.unknownPool;
        }
      }

      if (!pool) {
        logger.warn(`Cannot assign pool to block ${blk.height} and 'unknown' pool does not exist. ` +
          `Check your "pools" table entries`);
      } else {
        // $findBlockMiner now handles all identification (coinbase text, address, direct-pay)
        extras.pool = {
          id: pool.uniqueId,
          name: pool.name,
          slug: pool.slug,
          minerNames: null,
        };
      }

      extras.matchRate = null;
      extras.expectedFees = null;
      extras.expectedWeight = null;
      if (config.MEMPOOL.AUDIT) {
        const auditScore = await BlocksAuditsRepository.$getBlockAuditScore(block.id);
        if (auditScore != null) {
          extras.matchRate = auditScore.matchRate;
          extras.expectedFees = auditScore.expectedFees;
          extras.expectedWeight = auditScore.expectedWeight;
        }
      }

      extras.firstSeen = null;
      if (config.CORE_RPC.DEBUG_LOG_PATH) {
        const oldestLog = this.getOldestCoreLogTimestamp();
        if (oldestLog) {
          extras.firstSeen = getBlockFirstSeenFromLogs(block.id, block.timestamp, oldestLog);
        }
      }
    }

    blk.extras = <BlockExtension>extras;
    return <BlockExtended>blk;
  }

  /** @asyncUnsafe */
  private async $getBlockStats(block: IEsploraApi.Block, transactions: TransactionExtended[]): Promise<IBitcoinApi.BlockStats> {
    if (!block.stale) {
      return bitcoinClient.getBlockStats(block.id);
    }
    const reconstructed = await reconstructBlockAmounts(bitcoinClient, block.id, { stale: true });
    if (!reconstructed.transactionFees) {
      throw new Error('Exact stale transaction fees are unavailable');
    }
    return calculateStaleBlockStats(block, transactions, reconstructed.transactionFees);
  }


  /**
   * Extract a meaningful miner name from coinbase hex data.
   * Returns the cleaned name string, or null if nothing exploitable.
   */
  private $extractCoinbaseText(coinbaseHex: string): string | null {
    try {
      let raw = '';
      for (let i = 0; i < coinbaseHex.length; i += 2) {
        const charCode = parseInt(coinbaseHex.substr(i, 2), 16);
        if (charCode >= 32 && charCode <= 126) {
          raw += String.fromCharCode(charCode);
        } else {
          raw += '|';
        }
      }
      const fragments = raw.split(/\|+/).map(s => s.trim()).filter(s => s.length > 2);

      // A domain is stable enough to identify a pool even when the surrounding
      // coinbase text changes between blocks.
      for (const frag of fragments) {
        const domainMatch = frag.match(TRUSTED_POOL_DOMAIN);
        if (domainMatch) {
          return domainMatch[0];
        }
      }

      // Only explicit, known pool/software markers may become an aggregated
      // pool identity. Arbitrary printable coinbase messages remain available
      // in coinbaseSignatureAscii, but must never rename or create a pool.
      for (const frag of fragments) {
        const markerMatch = frag.match(NODE_MINING_SOFTWARE_MARKER) ?? frag.match(TRUSTED_POOL_MARKER);
        if (markerMatch) {
          return markerMatch[0];
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Detect the miner address from coinbase transaction outputs.
   * Handles direct-pay pools (multiple outputs → smallest = fee address, largest = miner)
   * and normal pools (single output).
   * Returns { minerAddress, feeAddress, isDirectPay }.
   */
  private $detectMinerAddress(vouts: { scriptpubkey_address?: string; value?: Amount; scriptpubkey_type?: string }[]): {
    minerAddress: string;
    feeAddress: string;
    isDirectPay: boolean;
  } | null {
    const nonOpReturnOutputs = vouts.filter(
      (v) => v.scriptpubkey_address && (v.value ?? 0) > 0 && v.scriptpubkey_type !== 'op_return'
    );
    if (nonOpReturnOutputs.length > 1) {
      // Direct-pay pool: smallest output = pool fee address, largest = miner address
      nonOpReturnOutputs.sort((a, b) => compareAmounts(a.value ?? 0, b.value ?? 0));
      return {
        minerAddress: nonOpReturnOutputs[nonOpReturnOutputs.length - 1].scriptpubkey_address!,
        feeAddress: nonOpReturnOutputs[0].scriptpubkey_address!,
        isDirectPay: true,
      };
    } else if (nonOpReturnOutputs.length === 1) {
      return {
        minerAddress: nonOpReturnOutputs[0].scriptpubkey_address!,
        feeAddress: nonOpReturnOutputs[0].scriptpubkey_address!,
        isDirectPay: false,
      };
    } else if (vouts.length > 0 && vouts[0].scriptpubkey_address) {
      return {
        minerAddress: vouts[0].scriptpubkey_address!,
        feeAddress: vouts[0].scriptpubkey_address!,
        isDirectPay: false,
      };
    }
    return null;
  }

  /**
   * Create a shortened address for display (e.g. "nito1qk8...7v45")
   */
  private $shortenAddress(address: string): string {
    if (address.length > 16) {
      return address.slice(0, 8) + '...' + address.slice(-4);
    }
    return address;
  }

  /**
   * Generate a URL-safe slug from a name string.
   */
  private $toSlug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9.-]/g, '').replace(/^[.-]+|[.-]+$/g, '');
  }

  /**
   * Get the address suffix for pool slug generation (last 8 chars, cleaned).
   */
  private $addrSuffix(address: string): string {
    return address.slice(-8).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * @asyncUnsafe
   * Try to find which miner found the block.
   * Unified 3-step pipeline:
   *   1. Match against known pools in DB (regex/address)
   *   2. Coinbase text + address → auto-register
   *   3. Address only (no coinbase text) → auto-register with shortened address
   *   4. No info at all → Unknown (edge case)
   */
  private async $findBlockMiner(txMinerInfo: TransactionMinerInfo | undefined, blockHeight: number = 0, allowPoolUpdates = true): Promise<PoolTag> {
    // Step 0: No transaction info at all
    if (txMinerInfo === undefined || txMinerInfo.vout.length < 1) {
      if (config.DATABASE.ENABLED === true) {
        return await poolsRepository.$getUnknownPool();
      } else {
        return poolsParser.unknownPool;
      }
    }

    const addresses = txMinerInfo.vout.map((vout) => vout.scriptpubkey_address).filter(address => address) as string[];
    const coinbaseHex = txMinerInfo.vin[0].scriptsig;
    const minerName = this.$extractCoinbaseText(coinbaseHex);
    const soloNode = !!minerName && NODE_MINING_SOFTWARE_MARKER.test(minerName);

    // Detect miner address first. In DB mode the address is the stable identity,
    // while the coinbase text is only the latest display label.
    const addrInfo = this.$detectMinerAddress(txMinerInfo.vout);
    const poolAddress = addrInfo ? (addrInfo.isDirectPay && !soloNode ? addrInfo.feeAddress : addrInfo.minerAddress) : '';
    const addrSuffix = poolAddress ? this.$addrSuffix(poolAddress) : '';

    if (poolAddress && config.DATABASE.ENABLED === true) {
      // Look up existing pool by address
      const existingPool = await poolsRepository.$getPoolByAddress(poolAddress);

      if (existingPool) {
        if (!allowPoolUpdates) { return existingPool; }
        const isDynamicPool = existingPool.link === '' && existingPool.slug?.endsWith(`_${addrSuffix}`);

        if (minerName && isDynamicPool && existingPool.name !== minerName) {
          const updated = await poolsRepository.$updatePoolNameIfNewer(existingPool.id, minerName, blockHeight);
          if (updated) {
            existingPool.name = minerName;
            existingPool.regexes = JSON.stringify([minerName]);
          }
        } else if (!minerName) {
          const fallbackName = this.$shortenAddress(poolAddress);
          const existingNameIsTrusted = TRUSTED_POOL_DOMAIN.test(existingPool.name)
            || TRUSTED_POOL_MARKER.test(existingPool.name) || NODE_MINING_SOFTWARE_MARKER.test(existingPool.name);

          // Repair names that older versions auto-registered from arbitrary
          // coinbase prose. Curated pools and already-trusted names are kept.
          if (isDynamicPool && !existingNameIsTrusted && existingPool.name !== fallbackName) {
            const updated = await poolsRepository.$updatePoolNameIfNewer(existingPool.id, fallbackName, blockHeight);
            if (updated) {
              existingPool.name = fallbackName;
              existingPool.regexes = JSON.stringify([fallbackName]);
            }
          }
        }

        return existingPool;
      }

      // An orphan may be inspected, but cannot create or rename a mining identity.
      if (!allowPoolUpdates) { return await poolsRepository.$getUnknownPool(); }

      // No pool for this address yet: create a new pool identity.
      const displayName = minerName || this.$shortenAddress(poolAddress);
      const slugBase = minerName ? this.$toSlug(minerName) : 'addr';
      const slug = `${slugBase || 'pool'}_${addrSuffix}`;

      const newPool = await poolsRepository.$autoRegisterPool(
        displayName,
        slug,
        [poolAddress],
        minerName || ''
      );
      if (newPool) {
        return newPool;
      }
    }

    // A shared software marker does not identify a miner without its payout.
    if (soloNode) {
      return config.DATABASE.ENABLED ? await poolsRepository.$getUnknownPool() : poolsParser.unknownPool;
    }

    // Fallback: match static/regex pools only after the dynamic DB address path.
    // Otherwise an existing address match would return before updating its label.
    let pools: PoolTag[] = [];
    if (config.DATABASE.ENABLED === true) {
      pools = await poolsRepository.$getPools();
    } else {
      pools = poolsParser.miningPools;
    }

    const knownPool = poolsParser.matchBlockMiner(coinbaseHex, addresses || [], pools);
    if (knownPool) {
      return knownPool;
    }

    // Step 4: No info at all (should never happen in practice)
    if (config.DATABASE.ENABLED === true) {
      return await poolsRepository.$getUnknownPool();
    } else {
      return poolsParser.unknownPool;
    }
  }
  /**
   * [INDEXING] Index all blocks summaries for the block txs visualization
   */
  public async $generateBlocksSummariesDatabase(): Promise<void> {
    if (Common.blocksSummariesIndexingEnabled() === false) {
      return;
    }

    try {
      const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      const currentBlockHeight = blockchainInfo.blocks;
      let indexingBlockAmount = Math.min(config.MEMPOOL.INDEXING_BLOCKS_AMOUNT, currentBlockHeight);
      if (indexingBlockAmount <= -1) {
        indexingBlockAmount = currentBlockHeight + 1;
      }
      const lastBlockToIndex = Math.max(0, currentBlockHeight - indexingBlockAmount + 1);

      // Get all indexed block hash
      const indexedBlocks = (await blocksRepository.$getIndexedBlocks()).filter(block => block.height >= lastBlockToIndex);
      const indexedBlockSummariesHashesArray = await BlocksSummariesRepository.$getIndexedSummariesId();

      const indexedBlockSummariesHashes = {}; // Use a map for faster seek during the indexing loop
      for (const hash of indexedBlockSummariesHashesArray) {
        indexedBlockSummariesHashes[hash] = true;
      }

      // Logging
      let newlyIndexed = 0;
      let totalIndexed = indexedBlockSummariesHashesArray.length;
      let indexedThisRun = 0;
      let timer = Date.now() / 1000;
      const startedAt = Date.now() / 1000;

      for (const block of indexedBlocks) {
        if (indexedBlockSummariesHashes[block.hash] === true) {
          continue;
        }

        // Logging
        const elapsedSeconds = (Date.now() / 1000) - timer;
        if (elapsedSeconds > 5) {
          const runningFor = (Date.now() / 1000) - startedAt;
          const blockPerSeconds = indexedThisRun / elapsedSeconds;
          const progress = Math.round(totalIndexed / indexedBlocks.length * 10000) / 100;
          logger.debug(`Indexing block summary for #${block.height} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${totalIndexed}/${indexedBlocks.length} (${progress}%) | elapsed: ${runningFor.toFixed(2)} seconds`, logger.tags.mining);
          timer = Date.now() / 1000;
          indexedThisRun = 0;
        }

        await this.$indexBlockSummary(block.hash, block.height, block.stale);

        // Logging
        indexedThisRun++;
        totalIndexed++;
        newlyIndexed++;
      }
      if (newlyIndexed > 0) {
        logger.notice(`Blocks summaries indexing completed: indexed ${newlyIndexed} blocks`, logger.tags.mining);
      } else {
        logger.debug(`Blocks summaries indexing completed: indexed ${newlyIndexed} blocks`, logger.tags.mining);
      }
    } catch (e) {
      logger.err(`Blocks summaries indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`, logger.tags.mining);
      throw e;
    }
  }

  /** @asyncUnsafe */
  public async $indexBlockSummary(hash: string, height: number, stale?: boolean): Promise<void> {
    if (config.MEMPOOL.BACKEND === 'esplora') {
      const txs = (await bitcoinApi.$getTxsForBlock(hash, stale)).map(tx => transactionUtils.extendMempoolTransaction(tx));
      const cpfpSummary = await this.$indexCPFP(hash, height, txs, stale);
      if (cpfpSummary) {
        await this.$getStrippedBlockTransactions(hash, true, true, cpfpSummary, height); // This will index the block summary
      }
    } else {
      await this.$getStrippedBlockTransactions(hash, true, true); // This will index the block summary
    }
  }

  /**
   * [INDEXING] Index transaction CPFP data for all blocks
   */
   public async $generateCPFPDatabase(): Promise<void> {
    if (Common.cpfpIndexingEnabled() === false) {
      return;
    }

    try {
      // Get all indexed block hash
      const unindexedBlockHeights = await blocksRepository.$getCPFPUnindexedBlocks();

      if (!unindexedBlockHeights?.length) {
        return;
      }

      logger.info(`Indexing cpfp data for ${unindexedBlockHeights.length} blocks`);

      // Logging
      let count = 0;
      let countThisRun = 0;
      let timer = Date.now() / 1000;
      const startedAt = Date.now() / 1000;
      for (const height of unindexedBlockHeights) {
        // Logging
        const hash = await bitcoinApi.$getBlockHash(height);
        const elapsedSeconds = (Date.now() / 1000) - timer;
        if (elapsedSeconds > 5) {
          const runningFor = (Date.now() / 1000) - startedAt;
          const blockPerSeconds = countThisRun / elapsedSeconds;
          const progress = Math.round(count / unindexedBlockHeights.length * 10000) / 100;
          logger.debug(`Indexing cpfp clusters for #${height} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${count}/${unindexedBlockHeights.length} (${progress}%) | elapsed: ${runningFor.toFixed(2)} seconds`);
          timer = Date.now() / 1000;
          countThisRun = 0;
        }

        await this.$indexCPFP(hash, height); // Calculate and save CPFP data for transactions in this block

        // Logging
        count++;
        countThisRun++;
      }
      logger.notice(`CPFP indexing completed: indexed ${count} blocks`);
    } catch (e) {
      logger.err(`CPFP indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`);
      throw e;
    }
  }

  /**
   * [INDEXING] Index expected fees & weight for all audited blocks
   *
   * @asyncUnsafe
   */
  public async $generateAuditStats(): Promise<void> {
    const blockIds = await BlocksAuditsRepository.$getBlocksWithoutSummaries();
    if (!blockIds?.length) {
      return;
    }
    let timer = Date.now();
    let indexedThisRun = 0;
    let indexedTotal = 0;
    logger.debug(`Indexing ${blockIds.length} block audit details`);
    for (const hash of blockIds) {
      const summary = await BlocksSummariesRepository.$getTemplate(hash);
      let totalFees: Amount = '0';
      let totalWeight = 0;
      for (const tx of summary?.transactions || []) {
        totalFees = addAmounts(totalFees, tx.fee);
        totalWeight += (tx.vsize * 4);
      }
      await BlocksAuditsRepository.$setSummary(hash, totalFees, totalWeight);
      const cachedBlock = this.blocks.find(block => block.id === hash);
      if (cachedBlock) {
        cachedBlock.extras.expectedFees = totalFees;
        cachedBlock.extras.expectedWeight = totalWeight;
      }

      indexedThisRun++;
      indexedTotal++;
      const elapsedSeconds = (Date.now() - timer) / 1000;
      if (elapsedSeconds > 5) {
        const blockPerSeconds = indexedThisRun / elapsedSeconds;
        logger.debug(`Indexed ${indexedTotal} / ${blockIds.length} block audit details (${blockPerSeconds.toFixed(1)}/s)`);
        timer = Date.now();
        indexedThisRun = 0;
      }
    }
    logger.debug(`Indexing block audit details completed`);
  }

  /**
   * [INDEXING] Index transaction classification flags for Goggles
   *
   * @asyncSafe
   */
  public async $classifyBlocks(): Promise<void> {
    if (this.classifyingBlocks) {
      return;
    }
    this.classifyingBlocks = true;

    // classification requires an esplora backend
    if (!Common.gogglesIndexingEnabled() || config.MEMPOOL.BACKEND !== 'esplora') {
      return;
    }

    const currentBlockHeight = this.currentBlockHeight;

    const targetSummaryVersion: number = 1;
    const targetTemplateVersion: number = 1;

    const unclassifiedBlocksList = await BlocksSummariesRepository.$getSummariesBelowVersion(targetSummaryVersion);
    const unclassifiedTemplatesList = await BlocksSummariesRepository.$getTemplatesBelowVersion(targetTemplateVersion);

    // nothing to do
    if (!unclassifiedBlocksList?.length && !unclassifiedTemplatesList?.length) {
      return;
    }

    let timer = Date.now();
    let indexedThisRun = 0;
    let indexedTotal = 0;

    const minHeight = Math.min(
      unclassifiedBlocksList[unclassifiedBlocksList.length - 1]?.height ?? Infinity,
      unclassifiedTemplatesList[unclassifiedTemplatesList.length - 1]?.height ?? Infinity,
    );
    const numToIndex = Math.max(
      unclassifiedBlocksList.length,
      unclassifiedTemplatesList.length,
    );

    const unclassifiedBlocks = {};
    const unclassifiedTemplates = {};
    for (const block of unclassifiedBlocksList) {
      unclassifiedBlocks[block.height] = block.id;
    }
    for (const template of unclassifiedTemplatesList) {
      unclassifiedTemplates[template.height] = template.id;
    }

    logger.debug(`Classifying blocks and templates from #${currentBlockHeight} to #${minHeight}`, logger.tags.goggles);

    for (let height = currentBlockHeight; height >= 0; height--) {
      try {
        let txs: MempoolTransactionExtended[] | null = null;
        if (unclassifiedBlocks[height]) {
          const blockHash = unclassifiedBlocks[height];
          // fetch transactions
          txs = (await bitcoinApi.$getTxsForBlock(blockHash, true)).map(tx => transactionUtils.extendMempoolTransaction(tx)) || [];
          // add CPFP
          const cpfpSummary = calculateGoodBlockCpfp(height, txs, []);
          // classify
          const { transactions: classifiedTxs } = this.summarizeBlockTransactions(blockHash, height, cpfpSummary.transactions);
          await BlocksSummariesRepository.$saveTransactions(height, blockHash, classifiedTxs, 2);
          if (unclassifiedBlocks[height].version < 2 && targetSummaryVersion === 2) {
            const cpfpClusters = await CpfpRepository.$getClustersAt(height);
            if (!cpfpRepository.compareClusters(cpfpClusters, cpfpSummary.clusters)) {
              // CPFP clusters changed - update the compact_cpfp tables
              await CpfpRepository.$deleteClustersAt(height);
              await this.$saveCpfp(blockHash, height, cpfpSummary);
            }
          }
          await Common.sleep$(250);
        }
        if (unclassifiedTemplates[height]) {
          // classify template
          const blockHash = unclassifiedTemplates[height];
          const template = await BlocksSummariesRepository.$getTemplate(blockHash);
          const alreadyClassified = template?.transactions?.reduce((classified, tx) => (classified || tx.flags > 0), false);
          let classifiedTemplate = template?.transactions || [];
          if (!alreadyClassified) {
            const templateTxs: (TransactionExtended | TransactionClassified)[] = [];
            const blockTxMap: { [txid: string]: TransactionExtended } = {};
            for (const tx of (txs || [])) {
              blockTxMap[tx.txid] = tx;
            }
            for (const templateTx of (template?.transactions || [])) {
              let tx: TransactionExtended | null = blockTxMap[templateTx.txid];
              if (!tx) {
                try {
                  tx = await transactionUtils.$getTransactionExtended(templateTx.txid, false, true, false);
                } catch (e) {
                  // transaction probably not found
                }
              }
              templateTxs.push(tx || templateTx);
            }
            const cpfpSummary = calculateGoodBlockCpfp(height, templateTxs?.filter(tx => tx['effectiveFeePerVsize'] != null) as MempoolTransactionExtended[], []);
            // classify
            const { transactions: classifiedTxs } = this.summarizeBlockTransactions(blockHash, height, cpfpSummary.transactions);
            const classifiedTxMap: { [txid: string]: TransactionClassified } = {};
            for (const tx of classifiedTxs) {
              classifiedTxMap[tx.txid] = tx;
            }
            classifiedTemplate = classifiedTemplate.map(tx => {
              if (classifiedTxMap[tx.txid]) {
                tx.flags = classifiedTxMap[tx.txid].flags || 0;
              }
              return tx;
            });
          }
          await BlocksSummariesRepository.$saveTemplate({ height, template: { id: blockHash, transactions: classifiedTemplate }, version: 1 });
          await Common.sleep$(250);
        }
      } catch (e) {
        logger.warn(`Failed to classify template or block summary at ${height}`, logger.tags.goggles);
      }

      // timing & logging
      if (unclassifiedBlocks[height] || unclassifiedTemplates[height]) {
        indexedThisRun++;
        indexedTotal++;
      }
      const elapsedSeconds = (Date.now() - timer) / 1000;
      if (elapsedSeconds > 5) {
        const perSecond = indexedThisRun / elapsedSeconds;
        logger.debug(`Classified #${height}: ${indexedTotal} / ${numToIndex} blocks (${perSecond.toFixed(1)}/s)`);
        timer = Date.now();
        indexedThisRun = 0;
      }
    }

    this.classifyingBlocks = false;
  }

  /**
   * [INDEXING] Index missing coinbase addresses for all blocks
   */
  public async $indexCoinbaseAddresses(): Promise<void> {
    try {
      // Get all indexed block hash
      const unindexedBlocks = await blocksRepository.$getBlocksWithoutCoinbaseAddresses();

      if (!unindexedBlocks?.length) {
        return;
      }

      logger.info(`Indexing missing coinbase addresses for ${unindexedBlocks.length} blocks`);

      // Logging
      let count = 0;
      let countThisRun = 0;
      let timer = Date.now() / 1000;
      const startedAt = Date.now() / 1000;
      for (const { height, hash } of unindexedBlocks) {
        // Logging
        const elapsedSeconds = (Date.now() / 1000) - timer;
        if (elapsedSeconds > 5) {
          const runningFor = (Date.now() / 1000) - startedAt;
          const blockPerSeconds = countThisRun / elapsedSeconds;
          const progress = Math.round(count / unindexedBlocks.length * 10000) / 100;
          logger.debug(`Indexing coinbase addresses for #${height} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${count}/${unindexedBlocks.length} (${progress}%) | elapsed: ${runningFor.toFixed(2)} seconds`);
          timer = Date.now() / 1000;
          countThisRun = 0;
        }

        const coinbaseTx = await bitcoinApi.$getCoinbaseTx(hash);
        const addresses = new Set<string>(coinbaseTx.vout.map(v => v.scriptpubkey_address).filter(a => a) as string[]);
        await blocksRepository.$saveCoinbaseAddresses(hash, [...addresses]);

        // Logging
        count++;
        countThisRun++;
      }
      logger.notice(`coinbase addresses indexing completed: indexed ${count} blocks`);
    } catch (e) {
      logger.err(`coinbase addresses indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`);
      throw e;
    }
  }

  /**
   * [INDEXING] Index all blocks metadata for the mining dashboard
   * @asyncSafe
   */
  public async $generateBlockDatabase(): Promise<boolean> {
    try {
      const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      let currentBlockHeight = blockchainInfo.blocks;

      let indexingBlockAmount = Math.min(config.MEMPOOL.INDEXING_BLOCKS_AMOUNT, blockchainInfo.blocks);
      if (indexingBlockAmount <= -1) {
        indexingBlockAmount = currentBlockHeight + 1;
      }

      const lastBlockToIndex = Math.max(0, currentBlockHeight - indexingBlockAmount + 1);

      logger.debug(`Indexing blocks from #${currentBlockHeight} to #${lastBlockToIndex}`, logger.tags.mining);
      loadingIndicators.setProgress('block-indexing', 0);

      const chunkSize = 10000;
      let totalIndexed = await blocksRepository.$blockCountBetweenHeight(currentBlockHeight, lastBlockToIndex);
      let indexedThisRun = 0;
      let newlyIndexed = 0;
      const startedAt = Date.now() / 1000;
      let timer = Date.now() / 1000;

      while (currentBlockHeight >= lastBlockToIndex) {
        const endBlock = Math.max(0, lastBlockToIndex, currentBlockHeight - chunkSize + 1);

        const missingBlockHeights: number[] = await blocksRepository.$getMissingBlocksBetweenHeights(
          currentBlockHeight, endBlock);
        if (missingBlockHeights.length <= 0) {
          currentBlockHeight -= chunkSize;
          continue;
        }

        logger.info(`Indexing ${missingBlockHeights.length} blocks from #${currentBlockHeight} to #${endBlock}`, logger.tags.mining);

        for (const blockHeight of missingBlockHeights) {
          if (blockHeight < lastBlockToIndex) {
            break;
          }
          ++indexedThisRun;
          ++totalIndexed;
          const elapsedSeconds = (Date.now() / 1000) - timer;
          if (elapsedSeconds > 5 || blockHeight === lastBlockToIndex) {
            const runningFor = (Date.now() / 1000) - startedAt;
            const blockPerSeconds = indexedThisRun / elapsedSeconds;
            const progress = Math.round(totalIndexed / indexingBlockAmount * 10000) / 100;
            logger.debug(`Indexing block #${blockHeight} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${totalIndexed}/${indexingBlockAmount} (${progress.toFixed(2)}%) | elapsed: ${runningFor.toFixed(2)} seconds`, logger.tags.mining);
            timer = Date.now() / 1000;
            indexedThisRun = 0;
            loadingIndicators.setProgress('block-indexing', progress, false);
          }
          const blockHash = await bitcoinApi.$getBlockHash(blockHeight);
          const block: IEsploraApi.Block = await bitcoinApi.$getBlock(blockHash);
          const transactions = await this.$getTransactionsExtended(blockHash, block.height, block.timestamp, !block.stale, null, true, block.stale);
          const blockExtended = await this.$getBlockExtended(block, transactions);

          newlyIndexed++;
          await blocksRepository.$saveBlockInDatabase(blockExtended);
        }

        currentBlockHeight -= chunkSize;
      }
      if (newlyIndexed > 0) {
        logger.notice(`Block indexing completed: indexed ${newlyIndexed} blocks`, logger.tags.mining);
      } else {
        logger.debug(`Block indexing completed: indexed ${newlyIndexed} blocks`, logger.tags.mining);
      }
      loadingIndicators.setProgress('block-indexing', 100);
    } catch (e) {
      logger.err('Block indexing failed. Trying again in 10 seconds. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      loadingIndicators.setProgress('block-indexing', 100);
      throw e;
    }

    return await BlocksRepository.$validateChain();
  }

  /**
   * [INDEXING] Index all blocks first seen time from Bitcoin Core debug logs
   *
   * @asyncUnsafe
   */
  public async $indexBlocksFirstSeen(): Promise<void> {
    const previous = this.oldestCoreLogTimestamp;
    const oldestLogTimestamp = this.getOldestCoreLogTimestamp(true);
    const hasLogFileChanged = previous !== undefined && oldestLogTimestamp !== previous;

    if (!oldestLogTimestamp) {
      return;
    }

    // If the log file changed since last run, re-try to index blocks marked with sentinel value
    const blocks = await BlocksRepository.$getBlocksWithoutFirstSeen(hasLogFileChanged);

    if (!blocks?.length) {
      return;
    }
    logger.debug(`Indexing ${blocks.length} block first seen times${hasLogFileChanged ? ' (log file changed since last run)' : ''}`);
    const startedAt = Date.now();
    const results = scanLogsForBlocksFirstSeen(blocks, oldestLogTimestamp);
    const foundCount = results.filter(result => result.firstSeen !== null).length;
    logger.debug(`Found first seen times of ${foundCount} / ${results.length} blocks in Core logs, saving to database...`);
    await BlocksRepository.$saveFirstSeenTimes(results);

    const blocksByHash = new Map<string, BlockExtended>(this.blocks.map<[string, BlockExtended]>(block => [block.id, block]));

    for (const { hash, firstSeen } of results) {
      const cachedBlock = blocksByHash.get(hash);
      if (cachedBlock?.extras) {
        cachedBlock.extras.firstSeen = firstSeen;
      }
    }

    logger.debug(`Indexed ${foundCount} / ${blocks.length} block first seen times in ${((Date.now() - startedAt) / 1000).toFixed(2)} seconds`);
  }

  /** @asyncUnsafe */
  public async $updateBlocks(): Promise<number> {
    // warn if this run stalls the main loop for more than 2 minutes
    const timer = this.startTimer();

    diskCache.lock();

    let fastForwarded = false;
    let handledBlocks = 0;
    const lastBlockHeight = this.currentBlockHeight;
    const blockHeightTip = await bitcoinCoreApi.$getBlockHeightTip();
    this.updateTimerProgress(timer, 'got block height tip');

    if (this.blocks.length === 0) {
      this.currentBlockHeight = Math.max(blockHeightTip - config.MEMPOOL.INITIAL_BLOCKS_AMOUNT, -1);
    } else {
      this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
      await this.$rewindChangedChain(blockHeightTip, timer);
    }

    if (blockHeightTip - this.currentBlockHeight > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 2) {
      logger.info(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${config.MEMPOOL.INITIAL_BLOCKS_AMOUNT} recent blocks`);
      this.currentBlockHeight = blockHeightTip - config.MEMPOOL.INITIAL_BLOCKS_AMOUNT;
      fastForwarded = true;
      logger.info(`Re-indexing skipped blocks and corresponding hashrates data`);
      indexer.reindex(); // Make sure to index the skipped blocks #1619
    }

    if (!this.lastDifficultyAdjustmentTime) {
      const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      this.updateTimerProgress(timer, 'got blockchain info for initial difficulty adjustment');
      if (blockchainInfo.blocks === blockchainInfo.headers) {
        const heightDiff = blockHeightTip % 1; // Nito: per-block retarget
        const blockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff);
        this.updateTimerProgress(timer, 'got block hash for initial difficulty adjustment');
        const block: IEsploraApi.Block = await bitcoinApi.$getBlock(blockHash);
        this.updateTimerProgress(timer, 'got block for initial difficulty adjustment');
        this.lastDifficultyAdjustmentTime = block.timestamp;
        this.currentBits = block.bits;

        if (blockHeightTip >= 1) { // Nito: per-block retarget
          const previousPeriodBlockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff - 1); // Nito: per-block retarget;
          this.updateTimerProgress(timer, 'got previous block hash for initial difficulty adjustment');
          const previousPeriodBlock: IEsploraApi.Block = await bitcoinApi.$getBlock(previousPeriodBlockHash);
          this.updateTimerProgress(timer, 'got previous block for initial difficulty adjustment');
          if (['liquid', 'liquidtestnet'].includes(config.MEMPOOL.NETWORK)) {
            this.previousDifficultyRetarget = NaN;
          } else {
            this.previousDifficultyRetarget = calcBitsDifference(previousPeriodBlock.bits, block.bits);
          }
          logger.debug(`Initial difficulty adjustment data set.`);
        }
      } else {
        logger.debug(`Blockchain headers (${blockchainInfo.headers}) and blocks (${blockchainInfo.blocks}) not in sync. Waiting...`);
      }
    }

    const heightChanged = lastBlockHeight !== this.currentBlockHeight;
    // make sure to update the quarter epoch block time now if we won't do it inside the loop
    if (this.currentBlockHeight >= blockHeightTip && (heightChanged || this.quarterEpochBlockTime == null)) {
      await this.updateQuarterEpochBlockTime();
    }

    while (this.currentBlockHeight < blockHeightTip) {
      this.currentBlockHeight++;
      await this.updateQuarterEpochBlockTime();
      logger.debug(`New block found (#${this.currentBlockHeight})!`);

      this.updateTimerProgress(timer, `getting block data for ${this.currentBlockHeight}`);
      const blockHash = await bitcoinCoreApi.$getBlockHash(this.currentBlockHeight);
      const verboseBlock = await bitcoinClient.getBlock(blockHash, 2);
      const block = BitcoinApi.convertBlock(verboseBlock);
      const txIds: string[] = verboseBlock.tx.map(tx => tx.txid);
      const transactions = await this.$getTransactionsExtended(blockHash, block.height, block.timestamp, false, txIds, false, true) as MempoolTransactionExtended[];

      // fill in missing transaction fee data from verboseBlock
      for (let i = 0; i < transactions.length; i++) {
        if (!transactions[i].fee && transactions[i].txid === verboseBlock.tx[i].txid) {
          transactions[i].fee = coinToNitoshi(verboseBlock.tx[i].fee || 0);
        }
      }

      let accelerations = Object.values(mempool.getAccelerations());
      if (accelerations?.length > 0) {
        const pool = await this.$findBlockMiner(transactionUtils.stripCoinbaseTransaction(transactions[0]), block.height);
        accelerations = accelerations.filter(a => a.pools.includes(pool.uniqueId));
      }
      const cpfpSummary: CpfpSummary = calculateGoodBlockCpfp(block.height, transactions, accelerations.map(a => ({ txid: a.txid, max_bid: a.feeDelta })));
      const blockExtended: BlockExtended = await this.$getBlockExtended(block, cpfpSummary.transactions);
      const blockSummary: BlockSummary = this.summarizeBlockTransactions(block.id, block.height, cpfpSummary.transactions);
      this.updateTimerProgress(timer, `got block data for ${this.currentBlockHeight}`);

      if (Common.indexingEnabled()) {
        if (!fastForwarded) {
          await this.$handleReorgs(blockExtended, timer);
        }

        await blocksRepository.$saveBlockInDatabase(blockExtended);
        this.updateTimerProgress(timer, `saved ${this.currentBlockHeight} to database`);

        if (!fastForwarded) {
          let lastestPriceId;
          try {
            lastestPriceId = await PricesRepository.$getLatestPriceId();
            this.updateTimerProgress(timer, `got latest price id ${this.currentBlockHeight}`);
          } catch (e) {
            logger.debug('failed to fetch latest price id from db: ' + (e instanceof Error ? e.message : e));
          }
          if (priceUpdater.historyInserted === true && lastestPriceId !== null) {
            await blocksRepository.$saveBlockPrices([{
              height: blockExtended.height,
              priceId: lastestPriceId,
            }]);
            this.updateTimerProgress(timer, `saved prices for ${this.currentBlockHeight}`);
          } else {
            logger.debug(`Cannot save block price for ${blockExtended.height} because the price updater hasnt completed yet. Trying again in 10 seconds.`, logger.tags.mining);
            indexer.scheduleSingleTask('blocksPrices', 10000);
          }

          // Save blocks summary for visualization if it's enabled
          if (Common.blocksSummariesIndexingEnabled() === true) {
            await this.$getStrippedBlockTransactions(blockExtended.id, true, false, cpfpSummary, blockExtended.height);
            this.updateTimerProgress(timer, `saved block summary for ${this.currentBlockHeight}`);
          }
          if (config.MEMPOOL.CPFP_INDEXING) {
            void this.$saveCpfp(blockExtended.id, this.currentBlockHeight, cpfpSummary);
            this.updateTimerProgress(timer, `saved cpfp for ${this.currentBlockHeight}`);
          }
        }
      }

      // start async callbacks
      this.updateTimerProgress(timer, `starting async callbacks for ${this.currentBlockHeight}`);
      const pendingCallbacks = this.startAsyncBlockCallbacks(blockExtended, txIds, cpfpSummary.transactions);

      if (block.height % 1 === 0) { // Nito: every block is a difficulty adjustment
        if (Common.indexingEnabled()) {
          let adjustment;
          if (['liquid', 'liquidtestnet'].includes(config.MEMPOOL.NETWORK)) {
            adjustment = NaN;
          } else {
            adjustment = Math.round(
              // calcBitsDifference returns +- percentage, +100 returns to positive, /100 returns to ratio.
              // Instead of actually doing /100, just reduce the multiplier.
              (calcBitsDifference(this.currentBits, block.bits) + 100) * 10000
            ) / 1000000; // Remove float point noise
          }

          await DifficultyAdjustmentsRepository.$saveAdjustments({
            time: block.timestamp,
            height: block.height,
            difficulty: block.difficulty,
            adjustment,
          });
          this.updateTimerProgress(timer, `saved difficulty adjustment for ${this.currentBlockHeight}`);
        }

        if (['liquid', 'liquidtestnet'].includes(config.MEMPOOL.NETWORK)) {
          this.previousDifficultyRetarget = NaN;
        } else {
          this.previousDifficultyRetarget = calcBitsDifference(this.currentBits, block.bits);
        }
        this.lastDifficultyAdjustmentTime = block.timestamp;
        this.currentBits = block.bits;
      }

      // skip updating the orphan block cache if we've fallen behind the chain tip
      if (this.currentBlockHeight >= blockHeightTip - 2) {
        this.updateTimerProgress(timer, `getting orphaned blocks for ${this.currentBlockHeight}`);
        await chainTips.updateOrphanedBlocks();
      }

      // wait for pending async callbacks to finish
      this.updateTimerProgress(timer, `waiting for async callbacks to complete for ${this.currentBlockHeight}`);
      const callbackResults = await pendingCallbacks;
      const rejectedCallback = callbackResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (rejectedCallback) { throw rejectedCallback.reason; }
      this.updateTimerProgress(timer, `async callbacks completed for ${this.currentBlockHeight}`);

      this.blocks.push(blockExtended);
      if (this.blocks.length > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4) {
        this.blocks = this.blocks.slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4);
      }
      blockSummary.transactions.forEach(tx => {
        delete tx.acc;
      });
      this.blockSummaries.push(blockSummary);
      if (this.blockSummaries.length > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4) {
        this.blockSummaries = this.blockSummaries.slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4);
      }

      if (this.newBlockCallbacks.length) {
        this.newBlockCallbacks.forEach((cb) => cb(blockExtended, txIds, transactions));
      }
      if (config.MEMPOOL.CACHE_ENABLED && !memPool.hasPriority() && (block.height % config.MEMPOOL.DISK_CACHE_BLOCK_INTERVAL === 0)) {
        void diskCache.$saveCacheToDisk();
      }

      // Update Redis cache
      if (config.REDIS.ENABLED) {
        await redisCache.$updateBlocks(this.blocks);
        await redisCache.$updateBlockSummaries(this.blockSummaries);
        await redisCache.$removeTransactions(txIds);
        await rbfCache.updateCache();
      }

      handledBlocks++;
    }

    diskCache.unlock();

    this.clearTimer(timer);

    return handledBlocks;
  }

  private startTimer() {
    const state: any = {
      start: Date.now(),
      progress: 'begin $updateBlocks',
      timer: null,
    };
    state.timer = setTimeout(() => {
      logger.err(`$updateBlocks stalled at "${state.progress}"`);
    }, this.mainLoopTimeout);
    return state;
  }

  private updateTimerProgress(state, msg): void {
    state.progress = msg;
  }

  private clearTimer(state): void {
    if (state.timer) {
      clearTimeout(state.timer);
    }
  }

  /** @asyncUnsafe */
  private async updateQuarterEpochBlockTime(): Promise<void> {
    if (this.currentBlockHeight >= 503) {
      try {
        const quarterEpochBlockHash = await bitcoinApi.$getBlockHash(this.currentBlockHeight - 503);
        const quarterEpochBlock = await bitcoinApi.$getBlock(quarterEpochBlockHash);
        this.quarterEpochBlockTime = quarterEpochBlock?.timestamp;
      } catch (e) {
      this.quarterEpochBlockTime = null;
        logger.warn('failed to update last epoch block time: ' + (e instanceof Error ? e.message : e));
      }
    }
  }

  /**
   * Index a block if it's missing from the database. Returns the block after indexing
   * @asyncUnsafe
   */
  public async $indexBlockByHeight(height: number, skipDb = false): Promise<BlockExtended> {
    if (Common.indexingEnabled() && !skipDb) {
      const dbBlock = await blocksRepository.$getBlockByHeight(height);
      if (dbBlock !== null) {
        return dbBlock;
      }
    }
    // not already indexed
    const hash = await bitcoinApi.$getBlockHash(height);
    return this.$indexBlock(hash);
  }

  /** @asyncUnsafe */
  private async $rewindChangedChain(blockHeightTip: number, timer: any): Promise<void> {
    let retained = this.blocks.length;
    // Height alone misses a disconnect/reconnect completed between two polls.
    // Verify the cached branch against Core, including equal-height replacements.
    while (retained > 0) {
      const cached = this.blocks[retained - 1];
      if (cached.height <= blockHeightTip && await bitcoinCoreApi.$getBlockHash(cached.height) === cached.id) { break; }
      retained--;
    }
    if (retained === this.blocks.length) { return; }

    const removed = this.blocks.slice(retained);
    const common = this.blocks[retained - 1];
    const height = common?.height ?? Math.max(blockHeightTip - config.MEMPOOL.INITIAL_BLOCKS_AMOUNT, -1);
    logger.warn(`Cached chain changed at height ${height + 1}; reconnecting through Core tip ${blockHeightTip}`);
    this.updateTimerProgress(timer, `rewinding changed chain to ${height}`);

    // Complete persistent invalidation before replacing the in-memory branch so
    // an SQL failure remains retryable on the next poll.
    if (Common.indexingEnabled()) {
      await blocksRepository.$invalidateCanonicalBlocksAboveHeight(height);
      await HashratesRepository.$deleteHashratesFromTimestamp(Math.max(0, removed[0].timestamp - 604800));
      await DifficultyAdjustmentsRepository.$deleteAdjustementsFromHeight(height + 1);
      await cpfpRepository.$deleteClustersFrom(height + 1);
      await AccelerationRepository.$deleteAccelerationsFrom(height + 1);
      indexer.reindex();
    }

    this.blocks = this.blocks.slice(0, retained);
    const canonicalIds = new Set(this.blocks.map(block => block.id));
    this.blockSummaries = this.blockSummaries.filter(summary => canonicalIds.has(summary.id));
    this.currentBlockHeight = height;
    this.currentBits = common?.bits || 0;
    this.lastDifficultyAdjustmentTime = common?.timestamp || 0;
    const previous = this.blocks[retained - 2];
    this.previousDifficultyRetarget = previous && common ? calcBitsDifference(previous.bits, common.bits) : 0;
    this.quarterEpochBlockTime = null;
    chainTips.clearOrphanCacheAboveHeight(height + 1);
    websocketHandler.handleReorg();
    if (config.REDIS.ENABLED) {
      await redisCache.$updateBlocks(this.blocks);
      await redisCache.$updateBlockSummaries(this.blockSummaries);
    }
  }

  /** @asyncUnsafe */
  private async $handleReorgs(blockExtended: BlockExtended, timer: any): Promise<void> {
    let forkTail = blockExtended;
    let currentlyIndexed = await blocksRepository.$getBlockByHeight(forkTail.height - 1);
    this.updateTimerProgress(timer, `got block by height at previous tip ${forkTail.height - 1}`);

    // previous blockhash is not what we expected: there has been a reorg
    if (currentlyIndexed !== null && forkTail.previousblockhash !== currentlyIndexed.id) {
      logger.warn(`Chain divergence detected at block ${blockExtended.height}, re-indexing most recent data`, logger.tags.mining);
      this.updateTimerProgress(timer, `reconnecting diverged chain from ${this.currentBlockHeight}`);
      const newBlocks: BlockExtended[] = [];
    // walk back along the chain until we reach the fork point
      while (currentlyIndexed !== null && forkTail.previousblockhash !== currentlyIndexed.id) {
        const newBlock = await this.$indexBlock(forkTail.previousblockhash);
        await blocksRepository.$setCanonicalBlockAtHeight(newBlock.id, newBlock.height);
        newBlocks.push(newBlock);
        this.updateTimerProgress(timer, `reindexed block at ${newBlock.height} (${newBlock.id})`);
        let newCpfpSummary;
        if (config.MEMPOOL.CPFP_INDEXING) {
          newCpfpSummary = await this.$indexCPFP(newBlock.id, newBlock.height);
          this.updateTimerProgress(timer, `reindexed block cpfp`);
        }
        await this.$getStrippedBlockTransactions(newBlock.id, true, true, newCpfpSummary, newBlock.height);
        this.updateTimerProgress(timer, `reindexed block summary`);

        forkTail = newBlock;
        currentlyIndexed = await blocksRepository.$getBlockByHeight(forkTail.height - 1);
        this.updateTimerProgress(timer, `got block by height for ${forkTail.height - 1}`);
      }

      // rebuild the block cache
      let currentBlock = forkTail;
      const cachedBlocksByHash = {};
      for (const cached of this.blocks) {
        cachedBlocksByHash[cached.id] = cached;
      }
      while (currentBlock.height > 0 && newBlocks.length < (config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4)) {
        const newBlock = cachedBlocksByHash[currentBlock.previousblockhash] || await blocksRepository.$getBlockByHash(currentBlock.previousblockhash);
        if (newBlock) {
          newBlocks.push(newBlock);
          currentBlock = newBlock;
        } else {
          break;
        }
      }
      this.updateTimerProgress(timer, `rebuilt block cache`);

      // force re-indexing of block-related data
      await HashratesRepository.$deleteHashratesFromTimestamp(forkTail.timestamp - 604800);
      await DifficultyAdjustmentsRepository.$deleteAdjustementsFromHeight(forkTail.height);
      await cpfpRepository.$deleteClustersFrom(forkTail.height);
      await AccelerationRepository.$deleteAccelerationsFrom(forkTail.height);
      chainTips.clearOrphanCacheAboveHeight(forkTail.height);
      this.updateTimerProgress(timer, `deleted stale block data`);

      this.blocks = newBlocks.reverse();
      if (this.blocks.length > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4) {
        this.blocks = this.blocks.slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4);
      }
      this.updateTimerProgress(timer, `connected new best chain from ${forkTail.height} to ${this.currentBlockHeight}`);

      await mining.$indexDifficultyAdjustments();
      this.updateTimerProgress(timer, `reindexed difficulty adjustments`);
      logger.info(`Re-indexed ${this.currentBlockHeight - forkTail.height} blocks and summaries. Also re-indexed the last difficulty adjustments. Will re-index latest hashrates in a few seconds.`, logger.tags.mining);
      indexer.reindex();

      websocketHandler.handleReorg();
    }
  }

  /**
   * Index a block if it's missing from the database. Returns the block after indexing
   *
   * @asyncUnsafe
   */
  public async $indexBlock(hash: string, block?: IEsploraApi.Block, skipDb = false): Promise<BlockExtended> {
    if (Common.indexingEnabled() && !skipDb) {
      const dbBlock = await blocksRepository.$getBlockByHash(hash);
      if (dbBlock !== null) {
        return dbBlock;
      }
    }

    if (!block) {
      // dont' bother trying to fetch orphan blocks from esplora
      block = await (chainTips.isOrphaned(hash) ? bitcoinCoreApi.$getBlock(hash) : bitcoinApi.$getBlock(hash));
    }

    const transactions = await this.$getTransactionsExtended(hash, block.height, block.timestamp, !block.stale, null, false, false, block.stale);
    const blockExtended = await this.$getBlockExtended(block, transactions);
    if (block.stale) {
      blockExtended.canonical = await bitcoinApi.$getBlockHash(block.height);
    }

    if (Common.indexingEnabled()) {
      await blocksRepository.$saveBlockInDatabase(blockExtended);
    }

    return blockExtended;
  }

  /**
   * Get one block by its hash
   * @asyncUnsafe
   */
  public async $getBlock(hash: string, skipMemoryCache: boolean = false): Promise<BlockExtended | IEsploraApi.Block> {
    // Check the memory cache
    if (!skipMemoryCache) {
      const blockByHash = this.getBlocks().find((b) => b.id === hash);
      if (blockByHash) {
        return blockByHash;
      }
    }

    // Not Bitcoin network, return the block as it from the bitcoin backend
    if (['mainnet', 'testnet', 'signet', 'testnet4', 'regtest'].includes(config.MEMPOOL.NETWORK) === false) {
      return await bitcoinCoreApi.$getBlock(hash);
    }

    // Bitcoin network, add our custom data on top
    return await this.$indexBlock(hash);
  }

  /** @asyncUnsafe */
  public async $getStrippedBlockTransactions(hash: string, skipMemoryCache = false,
    skipDBLookup = false, cpfpSummary?: CpfpSummary, blockHeight?: number): Promise<TransactionClassified[]>
  {
    if (skipMemoryCache === false) {
      // Check the memory cache
      const cachedSummary = this.getBlockSummaries().find((b) => b.id === hash);
      if (cachedSummary?.transactions?.length) {
        return cachedSummary.transactions;
      }
    }

    // Check if it's indexed in db
    if (skipDBLookup === false && Common.blocksSummariesIndexingEnabled() === true) {
      const indexedSummary = await BlocksSummariesRepository.$getByBlockId(hash);
      if (indexedSummary !== undefined && indexedSummary?.transactions?.length) {
        return indexedSummary.transactions;
      }
    }

    let height = blockHeight;
    let summary: BlockSummary;
    let summaryVersion = 0;
    if (cpfpSummary && !Common.isLiquid()) {
      summary = {
        id: hash,
        transactions: cpfpSummary.transactions.map(tx => {
          let flags: number = 0;
          try {
            flags = Common.getTransactionFlags(tx, height);
          } catch (e) {
            logger.warn('Failed to classify transaction: ' + (e instanceof Error ? e.message : e));
          }
          return {
            ...Common.stripTransaction(tx),
            flags: flags,
          };
        }),
      };
      summaryVersion = cpfpSummary.version;
    } else {
      const txs = (await bitcoinApi.$getTxsForBlock(hash, true)).map(tx => transactionUtils.extendTransaction(tx));
      summary = this.summarizeBlockTransactions(hash, height || 0, txs);
      summaryVersion = 1;
    }
    if (height == null) {
      // If the block is orphaned, use the height from the chaintips cache
      const orphanedBlock = chainTips.getOrphanedBlock(hash);
      if (orphanedBlock) {
        height = orphanedBlock.height;
      } else {
        const block = await bitcoinApi.$getBlock(hash);
        height = block.height;
      }
    }

    // Index the response if needed
    if (Common.blocksSummariesIndexingEnabled() === true) {
      await BlocksSummariesRepository.$saveTransactions(height, hash, summary.transactions, summaryVersion);
    }

    return summary.transactions;
  }

  /** @asyncUnsafe */
  public async $getSingleTxFromSummary(hash: string, txid: string): Promise<TransactionClassified | null> {
    const txs = await this.$getStrippedBlockTransactions(hash);
    return txs.find(tx => tx.txid === txid) || null;
  }

  /**
   * Get 15 blocks
   *
   * Internally this function uses two methods to get the blocks, and
   * the method is automatically selected:
   *  - Using previous block hash links
   *  - Using block height
   *
   * @param fromHeight
   * @param limit
   * @returns
   * @asyncUnsafe
   */
  public async $getBlocks(fromHeight?: number, limit: number = 15): Promise<BlockExtended[]> {
    let currentHeight = fromHeight !== undefined ? fromHeight : this.currentBlockHeight;
    if (currentHeight > this.currentBlockHeight) {
      limit -= currentHeight - this.currentBlockHeight;
      currentHeight = this.currentBlockHeight;
    }
    const returnBlocks: BlockExtended[] = [];

    if (currentHeight < 0) {
      return returnBlocks;
    }

    for (let i = 0; i < limit && currentHeight >= 0; i++) {
      let block = this.getBlocks().find((b) => b.height === currentHeight);
      if (block) {
        // Using the memory cache (find by height)
        returnBlocks.push(block);
      } else {
        // Using indexing (find by height, index on the fly, save in database)
        block = await this.$indexBlockByHeight(currentHeight);
        returnBlocks.push(block);
      }
      currentHeight--;
    }

    return returnBlocks;
  }

  /**
   * Used for bulk block data query
   *
   * @param fromHeight
   * @param toHeight
   * @asyncUnsafe
   */
  public async $getBlocksBetweenHeight(fromHeight: number, toHeight: number): Promise<any> {
    if (!Common.indexingEnabled()) {
      return [];
    }

    const blocks: any[] = [];

    while (fromHeight <= toHeight) {
      let block: BlockExtended | null = await blocksRepository.$getBlockByHeight(fromHeight);
      if (!block) {
        await this.$indexBlockByHeight(fromHeight);
        block = await blocksRepository.$getBlockByHeight(fromHeight);
        if (!block) {
          continue;
        }
      }

      // Cleanup fields before sending the response
      const cleanBlock: any = {
        height: block.height ?? null,
        hash: block.id ?? null,
        timestamp: block.timestamp ?? null,
        median_timestamp: block.mediantime ?? null,
        previous_block_hash: block.previousblockhash ?? null,
        difficulty: block.difficulty ?? null,
        header: block.extras.header ?? null,
        version: block.version ?? null,
        bits: block.bits ?? null,
        nonce: block.nonce ?? null,
        size: block.size ?? null,
        weight: block.weight ?? null,
        tx_count: block.tx_count ?? null,
        merkle_root: block.merkle_root ?? null,
        reward: block.extras.reward ?? null,
        total_fee_amt: block.extras.totalFees ?? null,
        avg_fee_amt: block.extras.avgFee ?? null,
        median_fee_amt: block.extras.medianFeeAmt ?? null,
        fee_amt_percentiles: block.extras.feePercentiles ?? null,
        avg_fee_rate: block.extras.avgFeeRate ?? null,
        median_fee_rate: block.extras.medianFee ?? null,
        fee_rate_percentiles: block.extras.feeRange ?? null,
        total_inputs: block.extras.totalInputs ?? null,
        total_input_amt: block.extras.totalInputAmt ?? null,
        total_outputs: block.extras.totalOutputs ?? null,
        total_output_amt: block.extras.totalOutputAmt ?? null,
        segwit_total_txs: block.extras.segwitTotalTxs ?? null,
        segwit_total_size: block.extras.segwitTotalSize ?? null,
        segwit_total_weight: block.extras.segwitTotalWeight ?? null,
        avg_tx_size: block.extras.avgTxSize ?? null,
        utxoset_change: block.extras.utxoSetChange ?? null,
        utxoset_size: block.extras.utxoSetSize ?? null,
        coinbase_raw: block.extras.coinbaseRaw ?? null,
        coinbase_address: block.extras.coinbaseAddress ?? null,
        coinbase_addresses: block.extras.coinbaseAddresses ?? null,
        coinbase_signature: block.extras.coinbaseSignature ?? null,
        coinbase_signature_ascii: block.extras.coinbaseSignatureAscii ?? null,
        pool_slug: block.extras.pool.slug ?? null,
        pool_id: block.extras.pool.id ?? null,
      };

      if (Common.blocksSummariesIndexingEnabled() && cleanBlock.fee_amt_percentiles === null) {
        cleanBlock.fee_amt_percentiles = await BlocksSummariesRepository.$getFeePercentilesByBlockId(cleanBlock.hash);
        if (cleanBlock.fee_amt_percentiles === null) {

          let summary;
          let summaryVersion = 0;
          if (config.MEMPOOL.BACKEND === 'esplora') {
            const txs = (await bitcoinApi.$getTxsForBlock(cleanBlock.hash, cleanBlock.stale)).map(tx => transactionUtils.extendTransaction(tx));
            summary = this.summarizeBlockTransactions(cleanBlock.hash, cleanBlock.height, txs);
            summaryVersion = 1;
          } else {
            // Call Core RPC
            const block = await bitcoinClient.getBlock(cleanBlock.hash, 2);
            summary = this.summarizeBlock(block);
          }

          await BlocksSummariesRepository.$saveTransactions(cleanBlock.height, cleanBlock.hash, summary.transactions, summaryVersion);
          cleanBlock.fee_amt_percentiles = await BlocksSummariesRepository.$getFeePercentilesByBlockId(cleanBlock.hash);
        }
        if (cleanBlock.fee_amt_percentiles !== null) {
          cleanBlock.median_fee_amt = cleanBlock.fee_amt_percentiles[3];
          await blocksRepository.$updateFeeAmounts(cleanBlock.hash, cleanBlock.fee_amt_percentiles, cleanBlock.median_fee_amt);
        }
      }

      cleanBlock.fee_amt_percentiles = {
        'min': cleanBlock.fee_amt_percentiles[0],
        'perc_10': cleanBlock.fee_amt_percentiles[1],
        'perc_25': cleanBlock.fee_amt_percentiles[2],
        'perc_50': cleanBlock.fee_amt_percentiles[3],
        'perc_75': cleanBlock.fee_amt_percentiles[4],
        'perc_90': cleanBlock.fee_amt_percentiles[5],
        'max': cleanBlock.fee_amt_percentiles[6],
      };
      cleanBlock.fee_rate_percentiles = {
        'min': cleanBlock.fee_rate_percentiles[0],
        'perc_10': cleanBlock.fee_rate_percentiles[1],
        'perc_25': cleanBlock.fee_rate_percentiles[2],
        'perc_50': cleanBlock.fee_rate_percentiles[3],
        'perc_75': cleanBlock.fee_rate_percentiles[4],
        'perc_90': cleanBlock.fee_rate_percentiles[5],
        'max': cleanBlock.fee_rate_percentiles[6],
      };

      // Re-org can happen after indexing so we need to always get the
      // latest state from core
      cleanBlock.orphans = chainTips.getOrphanedBlocksAtHeight(cleanBlock.height);

      blocks.push(cleanBlock);
      fromHeight++;
    }

    return blocks;
  }

  public async $getBlockAuditSummary(hash: string): Promise<BlockAudit | null> {
    if (['mainnet', 'testnet', 'signet', 'testnet4', 'regtest'].includes(config.MEMPOOL.NETWORK) && Common.auditIndexingEnabled()) {
      return BlocksAuditsRepository.$getBlockAudit(hash);
    } else {
      return null;
    }
  }

  public async $getBlockTxAuditSummary(hash: string, txid: string): Promise<TransactionAudit | null> {
    if (['mainnet', 'testnet', 'signet', 'testnet4', 'regtest'].includes(config.MEMPOOL.NETWORK) && Common.auditIndexingEnabled()) {
      return BlocksAuditsRepository.$getBlockTxAudit(hash, txid);
    } else {
      return null;
    }
  }

  public getLastDifficultyAdjustmentTime(): number {
    return this.lastDifficultyAdjustmentTime;
  }

  public getPreviousDifficultyRetarget(): number {
    return this.previousDifficultyRetarget;
  }

  public getQuarterEpochBlockTime(): number | null {
    return this.quarterEpochBlockTime;
  }

  public getCurrentBlockHeight(): number {
    return this.currentBlockHeight;
  }

/** @asyncUnsafe */
  public async $indexCPFP(hash: string, height: number, txs?: MempoolTransactionExtended[], stale?: boolean): Promise<CpfpSummary | null> {
    let transactions = txs;
    if (!transactions) {
      if (config.MEMPOOL.BACKEND === 'esplora') {
        transactions = (await bitcoinApi.$getTxsForBlock(hash, true)).map(tx => transactionUtils.extendMempoolTransaction(tx));
      }
      if (!transactions) {
        const block = await bitcoinClient.getBlock(hash, 2);
        transactions = block.tx.map(tx => {
          tx.fee = coinToNitoshi(tx.fee || 0);
          return tx;
        });
      }
    }

    if (transactions?.length != null) {
      const summary = calculateFastBlockCpfp(height, transactions);

      if (!stale) {
        await this.$saveCpfp(hash, height, summary);
      }

      const effectiveFeeStats = Common.calcEffectiveFeeStatistics(summary.transactions);
      await blocksRepository.$saveEffectiveFeeStats(hash, effectiveFeeStats);

      return summary;
    } else {
      logger.err(`Cannot index CPFP for block ${height} - missing transaction data`);
      return null;
    }
  }

  /** @asyncSafe */
  public async $saveCpfp(hash: string, height: number, cpfpSummary: CpfpSummary): Promise<void> {
    try {
      const result = await cpfpRepository.$batchSaveClusters(cpfpSummary.clusters);
      if (!result) {
        await cpfpRepository.$insertProgressMarker(height);
      }
    } catch (e) {
      // not a fatal error, we'll try again next time the indexer runs
    }
  }

  public async $getBlockDefinitionHashes(): Promise<string[] | null> {
    try {
      const [rows]: any = await database.query(`SELECT DISTINCT(definition_hash) FROM blocks WHERE stale = 0`);
      if (rows && Array.isArray(rows)) {
        return rows.map(r => r.definition_hash);
      } else {
        logger.debug(`Unable to retrieve list of blocks.definition_hash from db (no result)`);
        return null;
      }
    } catch (e) {
      logger.debug(`Unable to retrieve list of blocks.definition_hash from db (exception: ${e})`);
      return null;
    }
  }

  public async $getBlocksByDefinitionHash(definitionHash: string): Promise<string[] | null> {
    try {
      const [rows]: any = await database.query(`SELECT hash FROM blocks WHERE definition_hash = ? AND stale = 0`, [definitionHash]);
      if (rows && Array.isArray(rows)) {
        return rows.map(r => r.hash);
      } else {
        logger.debug(`Unable to retrieve list of blocks for definition hash ${definitionHash} from db (no result)`);
        return null;
      }
    } catch (e) {
      logger.debug(`Unable to retrieve list of blocks for definition hash ${definitionHash} from db (exception: ${e})`);
      return null;
    }
  }

  public getOldestCoreLogTimestamp(forceRefresh = false): number | null {
    if (!forceRefresh && this.oldestCoreLogTimestamp !== undefined) {
      return this.oldestCoreLogTimestamp;
    }
    const debugLogPath = config.CORE_RPC.DEBUG_LOG_PATH;
    if (!debugLogPath) {
      this.oldestCoreLogTimestamp = null;
      return null;
    }
    try {
      this.oldestCoreLogTimestamp = getOldestLogTimestampFromLogs(debugLogPath);
      if (this.oldestCoreLogTimestamp !== null) {
        logger.info(`Core debug log entries date back to ${new Date(this.oldestCoreLogTimestamp * 1000).toISOString()}`);
      } else {
        logger.err(`Could not find oldest timestamp in Core debug log file at ${debugLogPath}`);
      }
      return this.oldestCoreLogTimestamp;
    } catch (e) {
      this.oldestCoreLogTimestamp = null;
      logger.err(`Could not read Core debug log file at ${debugLogPath}. Reason: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}

export default new Blocks();
