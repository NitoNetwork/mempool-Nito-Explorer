import config from '../../config';
import Client from '@mempool/electrum-client';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IEsploraApi } from './esplora-api.interface';
import { IElectrumApi } from './electrum-api.interface';
import BitcoinApi from './bitcoin-api';
import logger from '../../logger';
import crypto from 'crypto-js';
import loadingIndicators from '../loading-indicators';
import { amount, addAmounts, parseCoreJson, transactionNitoshi } from '../nito-values';
import { PRIVATE_ADDRESS_ERROR } from '../nito-errors';
import { IndexUnavailableError } from './index-unavailable-error';
import DB from '../../database';

type TransparentEffects = { vin: { txid: string; vout: number; is_coinbase: boolean }[]; vout: { scriptpubkey: string; value: string }[] };
type AddressContribution = { funded_txo_count: number; funded_txo_sum: string; spent_txo_count: number; spent_txo_sum: string };
type AddressStats = { chain_stats: IEsploraApi.ChainStats; mempool_stats: IEsploraApi.MempoolStats };
type IndexTip = { hash: string; height: number };
type PersistentAddressStats = AddressStats & { fingerprint: string; tip_hash: string; tip_height: number };
type HistoryContinuation = { cursor: number; tipHash: string; tipHeight: number };

class BitcoindElectrsApi extends BitcoinApi implements AbstractBitcoinApi {
  private electrumClient: any;
  private addressStatsCache = new Map<string, { fingerprint: string; chain_stats: IEsploraApi.ChainStats; mempool_stats: IEsploraApi.MempoolStats }>();
  private pendingAddressStats = new Map<string, Promise<{ chain_stats: IEsploraApi.ChainStats; mempool_stats: IEsploraApi.MempoolStats }>>();
  private addressContributions = new Map<string, AddressContribution>();
  private effectsCache = new Map<string, { effects: TransparentEffects; bytes: number }>();
  private effectsBytes = 0;
  private pendingEffects = new Map<string, Promise<TransparentEffects>>();
  private pendingIndexReads = new Map<string, Promise<unknown>>();
  private completedIndexReads = new Map<string, { value: unknown; tipHash: string; tipHeight: number; completedAt: number }>();
  private historyContinuations = new Map<string, HistoryContinuation>();
  private lastHistoryCursorPrune = 0;

  private exactAddressStats(value: unknown): IEsploraApi.ChainStats | null {
    if (!value || typeof value !== 'object') { return null; }
    const stats = value as Record<string, unknown>;
    const count = (field: string): number | null => Number.isSafeInteger(stats[field]) && Number(stats[field]) >= 0
      ? Number(stats[field]) : null;
    const sum = (field: string): string | null => typeof stats[field] === 'string' && /^(0|[1-9]\d*)$/.test(stats[field] as string)
      ? stats[field] as string : null;
    const funded_txo_count = count('funded_txo_count');
    const spent_txo_count = count('spent_txo_count');
    const tx_count = count('tx_count');
    const funded_txo_sum = sum('funded_txo_sum');
    const spent_txo_sum = sum('spent_txo_sum');
    if (funded_txo_count === null || spent_txo_count === null || tx_count === null
      || funded_txo_sum === null || spent_txo_sum === null) { return null; }
    return { funded_txo_count, funded_txo_sum, spent_txo_count, spent_txo_sum, tx_count };
  }

  private async persistentAddressStats(scripthash: string): Promise<PersistentAddressStats | null> {
    if (!config.DATABASE.ENABLED) { return null; }
    try {
      const [rows]: any = await DB.query(
        `SELECT fingerprint, tip_hash, tip_height, chain_stats, mempool_stats
          FROM address_stats_cache WHERE scripthash = ?`, [scripthash], 'silent');
      if (!rows?.length) { return null; }
      const parse = (value: unknown): unknown => typeof value === 'string' ? JSON.parse(value) : value;
      const chain_stats = this.exactAddressStats(parse(rows[0].chain_stats));
      const mempool_stats = this.exactAddressStats(parse(rows[0].mempool_stats));
      if (!chain_stats || !mempool_stats || typeof rows[0].fingerprint !== 'string'
        || !/^[0-9a-f]{64}$/i.test(rows[0].fingerprint) || typeof rows[0].tip_hash !== 'string'
        || !/^[0-9a-f]{64}$/i.test(rows[0].tip_hash) || !Number.isSafeInteger(rows[0].tip_height)
        || rows[0].tip_height < 0) { return null; }
      return { fingerprint: rows[0].fingerprint, tip_hash: rows[0].tip_hash,
        tip_height: rows[0].tip_height, chain_stats, mempool_stats };
    } catch (error) {
      logger.warn(`Cannot read persistent address statistics: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  private async savePersistentAddressStats(scripthash: string, fingerprint: string,
    tip: IndexTip, stats: AddressStats): Promise<void> {
    if (!config.DATABASE.ENABLED) { return; }
    try {
      await DB.query(`INSERT INTO address_stats_cache
        (scripthash, fingerprint, tip_hash, tip_height, chain_stats, mempool_stats)
        VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE
        fingerprint = VALUES(fingerprint), tip_hash = VALUES(tip_hash),
        tip_height = VALUES(tip_height), chain_stats = VALUES(chain_stats),
        mempool_stats = VALUES(mempool_stats), updated_at = CURRENT_TIMESTAMP`, [
        scripthash, fingerprint, tip.hash, tip.height,
        JSON.stringify(stats.chain_stats), JSON.stringify(stats.mempool_stats)
      ], 'silent');
    } catch (error) {
      logger.warn(`Cannot persist address statistics: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async persistentHistoryContinuation(scripthash: string, txid: string): Promise<HistoryContinuation | null> {
    if (!config.DATABASE.ENABLED) { return null; }
    try {
      const [rows]: any = await DB.query(
        `SELECT tx_num, tip_hash, tip_height FROM address_history_cursors
          WHERE scripthash = ? AND txid = ? AND updated_at >= CURRENT_TIMESTAMP - INTERVAL 30 DAY`,
        [scripthash, txid], 'silent');
      if (!rows?.length || typeof rows[0].tip_hash !== 'string' || !/^[0-9a-f]{64}$/i.test(rows[0].tip_hash)) { return null; }
      const cursor = typeof rows[0].tx_num === 'string' && /^\d+$/.test(rows[0].tx_num)
        ? Number(rows[0].tx_num) : rows[0].tx_num;
      const tipHeight = typeof rows[0].tip_height === 'string' && /^\d+$/.test(rows[0].tip_height)
        ? Number(rows[0].tip_height) : rows[0].tip_height;
      if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(tipHeight) || tipHeight < 0) { return null; }
      return { cursor, tipHash: rows[0].tip_hash, tipHeight };
    } catch (error) {
      logger.warn(`Cannot read persistent address history cursor: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  private async savePersistentHistoryContinuations(
    scripthash: string, entries: IElectrumApi.ScriptHashHistory[], tip: IndexTip, total: number
  ): Promise<void> {
    if (!config.DATABASE.ENABLED || total < 1000) { return; }
    const confirmed: { entry: IElectrumApi.ScriptHashHistory; cursor: number }[] = [];
    for (const entry of entries) {
      if (Number.isSafeInteger(entry.cursor) && entry.cursor !== undefined && entry.cursor >= 0) {
        confirmed.push({ entry, cursor: entry.cursor });
      }
    }
    if (!confirmed.length) { return; }
    try {
      const placeholders = confirmed.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const values = confirmed.flatMap(({ entry, cursor }) => [scripthash, entry.tx_hash, cursor, tip.hash, tip.height]);
      await DB.query(`INSERT INTO address_history_cursors
        (scripthash, txid, tx_num, tip_hash, tip_height) VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE tx_num = VALUES(tx_num), tip_hash = VALUES(tip_hash),
        tip_height = VALUES(tip_height), updated_at = CURRENT_TIMESTAMP`, values, 'silent');
      if (Date.now() - this.lastHistoryCursorPrune >= 3_600_000) {
        this.lastHistoryCursorPrune = Date.now();
        await DB.query(`DELETE FROM address_history_cursors
          WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL 30 DAY`, [], 'silent');
      }
    } catch (error) {
      logger.warn(`Cannot persist address history cursors: ${error instanceof Error ? error.message : error}`);
    }
  }

  constructor(bitcoinClient: any) {
    super(bitcoinClient);

    const electrumConfig = { client: 'mempool-v2', version: '1.4' };
    const electrumPersistencePolicy = { retryPeriod: 1000, maxRetry: Number.MAX_SAFE_INTEGER, callback: null };

    const electrumCallbacks = {
      onConnect: (client, versionInfo) => { logger.info(`Connected to Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT} (${JSON.stringify(versionInfo)})`); },
      onClose: (client) => { logger.info(`Disconnected from Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT}`); },
      onError: (err) => { logger.err(`Electrum error: ${JSON.stringify(err)}`); },
      onLog: (str) => { logger.debug(str); },
    };

    this.electrumClient = new Client(
      config.ELECTRUM.PORT,
      config.ELECTRUM.HOST,
      config.ELECTRUM.TLS_ENABLED ? 'tls' : 'tcp',
      null,
      electrumCallbacks
    );

    // The upstream client uses JSON.parse before callbacks. Preserve monetary
    // tokens here, before binary64 rounding can destroy an Electrum integer.
    this.electrumClient.onMessage = (body: string) => {
      const message = parseCoreJson(body);
      if (Array.isArray(message) || message.id !== undefined) {
        this.electrumClient.response(message);
      } else {
        this.electrumClient.subscribe.emit(message.method, message.params);
      }
    };

    this.electrumClient.initElectrum(electrumConfig, electrumPersistencePolicy)
      .then(() => { })
      .catch((err) => {
        logger.err(`Error connecting to Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT}`);
      });
  }

  /** @asyncUnsafe */
  private async indexTip(): Promise<IndexTip> {
    const expected = { mainnet: 'main', testnet: 'test', signet: 'signet', regtest: 'regtest' }[config.MEMPOOL.NETWORK];
    try {
      const [core, index] = await Promise.all([
        this.bitcoindClient.getBlockchainInfo(), this.electrumClient.request('blockchain.headers.subscribe', [])
      ]);
      if (!expected || core.chain !== expected || core.initialblockdownload) {
        throw new IndexUnavailableError('Core network mismatch or initial synchronization; index data unavailable', false);
      }
      if (index.height !== core.blocks) {
        throw new IndexUnavailableError('Core and ElectrumX height mismatch; index data unavailable', true, core.blocks > index.height);
      }
      const header = await this.bitcoindClient.getBlockHeader(core.bestblockhash, false);
      if (index.hex !== header) { throw new IndexUnavailableError('Core and ElectrumX tips differ; index data unavailable'); }
      return { hash: core.bestblockhash, height: core.blocks };
    } catch (error) {
      if (error instanceof IndexUnavailableError) { throw error; }
      throw new IndexUnavailableError('Core or ElectrumX unavailable; retry', false);
    }
  }

  /** Serve only a recently completed snapshot proven to remain on both active chains. */
  private async forwardLagSnapshot<T>(key: string): Promise<T | null> {
    const cached = this.completedIndexReads.get(key);
    if (!cached || Date.now() - cached.completedAt > 180_000) { return null; }
    try {
      const [core, index] = await Promise.all([
        this.bitcoindClient.getBlockchainInfo(), this.electrumClient.request('blockchain.headers.subscribe', [])
      ]);
      const expected = { mainnet: 'main', testnet: 'test', signet: 'signet', regtest: 'regtest' }[config.MEMPOOL.NETWORK];
      if (!expected || core.chain !== expected || core.initialblockdownload
        || !Number.isInteger(index.height) || core.blocks <= index.height || core.blocks - index.height > 3
        || cached.tipHeight !== index.height) { return null; }
      const [coreIndexHash, cachedActiveHash] = await Promise.all([
        this.bitcoindClient.getBlockHash(index.height), this.bitcoindClient.getBlockHash(cached.tipHeight)
      ]);
      const coreIndexHeader = await this.bitcoindClient.getBlockHeader(coreIndexHash, false);
      if (coreIndexHeader !== index.hex || cachedActiveHash !== cached.tipHash) { return null; }
      this.completedIndexReads.delete(key);
      this.completedIndexReads.set(key, cached);
      return cached.value as T;
    } catch (_) {
      return null;
    }
  }

  /** @asyncUnsafe */
  private async consistentIndexRead<T>(read: (tip: IndexTip) => Promise<T>, key: string): Promise<T> {
    const pending = this.pendingIndexReads.get(key);
    if (pending) { return pending as Promise<T>; }
    if (this.pendingIndexReads.size >= 128) { throw new IndexUnavailableError('Index read capacity reached; retry', false); }
    /** @asyncUnsafe */
    const collect = async (): Promise<T> => {
      for (let attempt = 0; ; attempt++) {
        try {
          const before = await this.indexTip();
          const result = await read(before);
          const after = await this.indexTip();
          if (before.hash !== after.hash) { throw new IndexUnavailableError('Chain tip changed during index read; retry'); }
          this.completedIndexReads.delete(key);
          this.completedIndexReads.set(key, { value: result, tipHash: after.hash, tipHeight: after.height, completedAt: Date.now() });
          while (this.completedIndexReads.size > 128) { this.completedIndexReads.delete(this.completedIndexReads.keys().next().value); }
          return result;
        } catch (error) {
          if (!(error instanceof IndexUnavailableError) || !error.retryable || attempt >= 2) {
            const stale = error instanceof IndexUnavailableError && error.forwardLagEligible
              ? await this.forwardLagSnapshot<T>(key) : null;
            if (stale !== null) { return stale; }
            throw error;
          }
          // A long first address scan has already cached immutable contributions.
          // Retry the small history/balance snapshot instead of making visitors restart it.
          await new Promise<void>(resolve => setTimeout(resolve, 150));
        }
      }
    };
    const work = collect().finally(() => this.pendingIndexReads.delete(key));
    this.pendingIndexReads.set(key, work);
    return work;
  }

  private checkedBalance(balance: IElectrumApi.ScriptHashBalance): IElectrumApi.ScriptHashBalance {
    return { confirmed: amount(balance.confirmed), unconfirmed: amount(balance.unconfirmed) };
  }

  private validHistoryEntry(value: any, confirmed: boolean): value is IElectrumApi.ScriptHashHistory {
    if (!value || typeof value !== 'object' || typeof value.tx_hash !== 'string'
      || !/^[0-9a-f]{64}$/i.test(value.tx_hash) || !Number.isSafeInteger(value.height)) { return false; }
    if (confirmed ? value.height < 0 : (value.height !== 0 && value.height !== -1)) { return false; }
    if (confirmed && (!Number.isSafeInteger(value.cursor) || value.cursor < 0)) { return false; }
    if (!confirmed && value.cursor !== undefined) { return false; }
    try {
      return value.fee === undefined || value.fee === null || BigInt(amount(value.fee)) >= 0n;
    } catch (_) {
      return false;
    }
  }

  private validHistoryPage(value: any, requestedCursor: number | null, limit: number): value is IElectrumApi.ScriptHashHistoryPage {
    if (!value || !Array.isArray(value.confirmed) || !Array.isArray(value.unconfirmed)
      || typeof value.has_more !== 'boolean' || !Number.isSafeInteger(value.total) || value.total < 0
      || value.confirmed.length > limit || (requestedCursor !== null && value.unconfirmed.length)
      || !value.confirmed.every(entry => this.validHistoryEntry(entry, true))
      || !value.unconfirmed.every(entry => this.validHistoryEntry(entry, false))) { return false; }
    if (value.has_more) {
      if (!Number.isSafeInteger(value.cursor) || value.cursor < 0 || value.confirmed.length !== limit) { return false; }
    } else if (value.cursor !== null) { return false; }
    if (value.total < value.confirmed.length) { return false; }
    for (let index = 0; index < value.confirmed.length; index++) {
      const cursor = value.confirmed[index].cursor;
      const previousCursor = index > 0 ? value.confirmed[index - 1].cursor : undefined;
      if (cursor === undefined) { return false; }
      if ((requestedCursor !== null && cursor >= requestedCursor)
        || (previousCursor !== undefined && cursor >= previousCursor)) { return false; }
    }
    if (value.has_more && value.cursor !== value.confirmed[value.confirmed.length - 1].cursor) { return false; }
    const txids = new Set([...value.unconfirmed, ...value.confirmed].map(entry => entry.tx_hash));
    return txids.size === value.unconfirmed.length + value.confirmed.length;
  }

  /** @asyncUnsafe */
  private async historyPage(scripthash: string, cursor: number | null, limit: number): Promise<IElectrumApi.ScriptHashHistoryPage> {
    try {
      const page = await this.electrumClient.request(
        'blockchain.nito.scripthash.get_history_page', [scripthash, cursor, limit]);
      if (!this.validHistoryPage(page, cursor, limit)) {
        throw new IndexUnavailableError('Electrum returned an invalid paginated history response', false);
      }
      return page;
    } catch (error: any) {
      const message = String(error?.message || error).toLowerCase();
      if (message.includes('unknown method') || message.includes('method not found')) {
        if (cursor !== null) {
          throw new IndexUnavailableError('Electrum pagination support is required for this address history', false);
        }
        const history = await this.electrumClient.request(
          'blockchain.scripthash.get_history', [scripthash]);
        const isConfirmed = (entry: any): boolean => Number(entry?.height) > 0
          || (Number(entry?.height) === 0 && entry?.fee === undefined);
        if (!Array.isArray(history) || !history.every(entry => this.validHistoryEntry(entry, isConfirmed(entry)))) {
          throw new IndexUnavailableError('Electrum returned an invalid address history', false);
        }
        const confirmed = history.filter(isConfirmed).reverse();
        const unconfirmed = history.filter(entry => !isConfirmed(entry));
        if (confirmed.length > limit) {
          throw new IndexUnavailableError('Electrum pagination support is required for this large address history', false);
        }
        return { confirmed, unconfirmed, has_more: false, cursor: null, total: confirmed.length };
      }
      throw error;
    }
  }

  /** @asyncUnsafe */
  private async fullScriptHashHistory(scripthash: string): Promise<IElectrumApi.ScriptHashHistory[]> {
    const first = await this.historyPage(scripthash, null, 1000);
    const history = [...first.unconfirmed, ...first.confirmed];
    const seenTxids = new Set(history.map(entry => entry.tx_hash));
    let page = first;
    let cursor = first.cursor;
    const total = first.total;
    while (page.has_more) {
      if (cursor === null) { throw new IndexUnavailableError('Electrum history cursor did not advance'); }
      const requestedCursor = cursor;
      page = await this.historyPage(scripthash, requestedCursor, 1000);
      if (page.total !== total || page.unconfirmed.length
        || (page.has_more && (page.cursor === null || page.cursor >= requestedCursor))) {
        throw new IndexUnavailableError('Electrum history changed during pagination; retry');
      }
      for (const entry of page.confirmed) {
        if (seenTxids.has(entry.tx_hash)) {
          throw new IndexUnavailableError('Electrum paginated history contained a duplicate transaction', false);
        }
        seenTxids.add(entry.tx_hash);
      }
      history.push(...page.confirmed);
      cursor = page.cursor;
      if (history.length > total + first.unconfirmed.length) {
        throw new IndexUnavailableError('Electrum paginated history exceeded its declared total', false);
      }
    }
    if (history.length !== total + first.unconfirmed.length) {
      throw new IndexUnavailableError('Electrum history changed during pagination; retry');
    }
    return history;
  }

  private rememberHistoryContinuations(scripthash: string, entries: IElectrumApi.ScriptHashHistory[], tip: IndexTip): void {
    for (const entry of entries) {
      const cursor = entry.cursor;
      if (!Number.isSafeInteger(cursor) || cursor === undefined || cursor < 0) { continue; }
      const key = `${scripthash}:${entry.tx_hash}`;
      this.historyContinuations.delete(key);
      this.historyContinuations.set(key, { cursor, tipHash: tip.hash, tipHeight: tip.height });
    }
    while (this.historyContinuations.size > 50_000) {
      this.historyContinuations.delete(this.historyContinuations.keys().next().value);
    }
  }

  private async historyContinuationActive(
    continuation: HistoryContinuation, tip: IndexTip
  ): Promise<boolean> {
    if (continuation.tipHeight > tip.height) { return false; }
    if (continuation.tipHeight === tip.height) { return continuation.tipHash === tip.hash; }
    try {
      return await this.bitcoindClient.getBlockHash(continuation.tipHeight) === continuation.tipHash;
    } catch (_) {
      return false;
    }
  }

  /** @asyncUnsafe Persists the continuation page in SQL. */
  private async completedRecentHistory(
    scripthash: string, entries: IElectrumApi.ScriptHashHistory[], tip: IndexTip, total: number
  ): Promise<IElectrumApi.ScriptHashHistory[]> {
    await this.savePersistentHistoryContinuations(scripthash, entries, tip, total);
    return entries;
  }

  /** @asyncUnsafe */
  private async recentScriptHashHistory(
    scripthash: string, tip: IndexTip, lastSeenTxId?: string
  ): Promise<IElectrumApi.ScriptHashHistory[]> {
    const pageLimit = 100;
    const resultLimit = 10;
    const continuationKey = lastSeenTxId ? `${scripthash}:${lastSeenTxId}` : '';
    let continuation = continuationKey ? this.historyContinuations.get(continuationKey) : undefined;
    if (!continuation && lastSeenTxId) {
      continuation = await this.persistentHistoryContinuation(scripthash, lastSeenTxId) || undefined;
      if (continuation) {
        this.historyContinuations.set(continuationKey, continuation);
      }
    }
    if (continuation && await this.historyContinuationActive(continuation, tip)) {
      const page = await this.historyPage(scripthash, continuation.cursor, pageLimit);
      this.rememberHistoryContinuations(scripthash, page.confirmed, tip);
      return this.completedRecentHistory(scripthash, page.confirmed.slice(0, resultLimit), tip, page.total);
    }
    if (continuationKey) { this.historyContinuations.delete(continuationKey); }

    const newest: IElectrumApi.ScriptHashHistory[] = [];
    const result: IElectrumApi.ScriptHashHistory[] = [];
    const seenTxids = new Set<string>();
    let found = !lastSeenTxId;
    let page = await this.historyPage(scripthash, null, pageLimit);
    const total = page.total;
    let cursor = page.cursor;
    let firstPage = true;
    let searchedPages = 0;
    while (true) {
      searchedPages++;
      this.rememberHistoryContinuations(scripthash, page.confirmed, tip);
      const entries = firstPage ? [...page.unconfirmed, ...page.confirmed] : page.confirmed;
      firstPage = false;
      for (const entry of entries) {
        if (seenTxids.has(entry.tx_hash)) {
          throw new IndexUnavailableError('Electrum paginated history contained a duplicate transaction', false);
        }
        seenTxids.add(entry.tx_hash);
        if (newest.length < resultLimit) { newest.push(entry); }
        if (!found) {
          if (entry.tx_hash === lastSeenTxId) { found = true; }
          continue;
        }
        if (lastSeenTxId && entry.tx_hash === lastSeenTxId) { continue; }
        result.push(entry);
        if (result.length === resultLimit) {
          return this.completedRecentHistory(scripthash, result, tip, total);
        }
      }
      if (!page.has_more) {
        return this.completedRecentHistory(scripthash, found ? result : newest, tip, total);
      }
      if (!found && searchedPages >= 10) {
        throw new IndexUnavailableError('Address history continuation is too old or unknown; restart from the newest page', false);
      }
      if (cursor === null) { throw new IndexUnavailableError('Electrum history cursor did not advance'); }
      const requestedCursor = cursor;
      page = await this.historyPage(scripthash, requestedCursor, pageLimit);
      if (page.total !== total || page.unconfirmed.length
        || (page.has_more && (page.cursor === null || page.cursor >= requestedCursor))) {
        throw new IndexUnavailableError('Electrum history changed during pagination; retry');
      }
      cursor = page.cursor;
    }
  }

  /** @asyncUnsafe */
  private async transparentEffects(txid: string): Promise<TransparentEffects> {
    const cached = this.effectsCache.get(txid);
    if (cached) {
      this.effectsCache.delete(txid); this.effectsCache.set(txid, cached);
      return cached.effects;
    }
    const pending = this.pendingEffects.get(txid);
    if (pending) { return pending; }
    /** @asyncUnsafe */
    const fetch = async () => {
      const tx = await this.bitcoindClient.getRawTransaction(txid, true);
      if (tx.txid !== txid) { throw new Error('Core returned a different transaction'); }
      const effects: TransparentEffects = {
        vin: tx.vin.map(input => ({ txid: input.txid, vout: input.vout, is_coinbase: !!input.coinbase })),
        vout: tx.vout.map(output => ({ scriptpubkey: output.scriptPubKey.hex, value: transactionNitoshi(output.value) })),
      };
      const bytes = Buffer.byteLength(JSON.stringify(effects));
      // Immutable public effects only: no proofs, witnesses or mutable status.
      if (bytes <= 1024 * 1024) {
        this.effectsCache.set(txid, { effects, bytes }); this.effectsBytes += bytes;
        while (this.effectsBytes > 32 * 1024 * 1024 || this.effectsCache.size > 2000) {
          const oldest = this.effectsCache.keys().next().value;
          this.effectsBytes -= this.effectsCache.get(oldest)!.bytes;
          this.effectsCache.delete(oldest);
        }
      }
      return effects;
    };
    const promise = fetch().finally(() => this.pendingEffects.delete(txid));
    this.pendingEffects.set(txid, promise);
    return promise;
  }

  private emptyAddressStats(): IEsploraApi.ChainStats {
    return { funded_txo_count: 0, funded_txo_sum: '0', spent_txo_count: 0, spent_txo_sum: '0', tx_count: 0 };
  }

  /** @asyncUnsafe */
  private async statsForHistoryEntries(
    scripthash: string, history: IElectrumApi.ScriptHashHistory[], initial?: IEsploraApi.ChainStats
  ): Promise<IEsploraApi.ChainStats> {
    const stats: IEsploraApi.ChainStats = initial ? { ...initial } : this.emptyAddressStats();
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(16, history.length) }, /** @asyncUnsafe */ async () => {
      while (next < history.length) {
        const entry = history[next++];
        const contributionKey = `${scripthash}:${entry.tx_hash}`;
        let contribution = this.addressContributions.get(contributionKey);
        if (!contribution) {
          contribution = { funded_txo_count: 0, funded_txo_sum: '0', spent_txo_count: 0, spent_txo_sum: '0' };
          const tx = await this.transparentEffects(entry.tx_hash);
          for (const output of tx.vout) {
            if (this.encodeScriptHash(output.scriptpubkey) === scripthash) {
              contribution.funded_txo_count++;
              contribution.funded_txo_sum = addAmounts(contribution.funded_txo_sum, output.value);
            }
          }
          for (const input of tx.vin) {
            if (input.is_coinbase) { continue; }
            const prevout = (await this.transparentEffects(input.txid)).vout[input.vout];
            if (!prevout) { throw new Error('Missing transparent prevout for address accounting'); }
            if (this.encodeScriptHash(prevout.scriptpubkey) === scripthash) {
              contribution.spent_txo_count++;
              contribution.spent_txo_sum = addAmounts(contribution.spent_txo_sum, prevout.value);
            }
          }
        }
        this.addressContributions.delete(contributionKey);
        this.addressContributions.set(contributionKey, contribution);
        while (this.addressContributions.size > 250_000) {
          this.addressContributions.delete(this.addressContributions.keys().next().value);
        }
        stats.tx_count++;
        stats.funded_txo_count += contribution.funded_txo_count;
        stats.spent_txo_count += contribution.spent_txo_count;
        stats.funded_txo_sum = addAmounts(stats.funded_txo_sum, contribution.funded_txo_sum);
        stats.spent_txo_sum = addAmounts(stats.spent_txo_sum, contribution.spent_txo_sum);
      }
    }));
    return stats;
  }

  private async persistentTipIsAncestor(stats: PersistentAddressStats, tip: IndexTip): Promise<boolean> {
    if (stats.tip_height > tip.height) { return false; }
    if (stats.tip_height === tip.height) { return stats.tip_hash === tip.hash; }
    try {
      return await this.bitcoindClient.getBlockHash(stats.tip_height) === stats.tip_hash;
    } catch (_) {
      return false;
    }
  }

  /** @asyncUnsafe */
  private async addressStats(
    scripthash: string, history: IElectrumApi.ScriptHashHistory[], tip: IndexTip
  ): Promise<AddressStats> {
    const fingerprint = crypto.SHA256(JSON.stringify(history)).toString();
    // The Nito page RPC marks confirmed entries with their stable tx_num cursor.
    // This distinguishes the confirmed genesis transaction (height 0) from
    // ordinary height-0 mempool entries without guessing from the height alone.
    const confirmedHistory = history.filter(entry => entry.cursor !== undefined || entry.height > 0);
    const mempoolHistory = history.filter(entry => entry.cursor === undefined && entry.height <= 0);
    if (confirmedHistory.some(entry => entry.height > tip.height)) {
      throw new IndexUnavailableError('Electrum history is ahead of its advertised tip; retry');
    }
    const cached = this.addressStatsCache.get(scripthash);
    if (cached && cached.fingerprint === fingerprint) {
      return { chain_stats: { ...cached.chain_stats }, mempool_stats: { ...cached.mempool_stats } };
    }
    const persisted = await this.persistentAddressStats(scripthash);
    if (persisted && persisted.fingerprint === fingerprint
      && persisted.chain_stats.tx_count === confirmedHistory.length
      && persisted.mempool_stats.tx_count === mempoolHistory.length) {
      this.addressStatsCache.delete(scripthash);
      this.addressStatsCache.set(scripthash, { fingerprint,
        chain_stats: { ...persisted.chain_stats }, mempool_stats: { ...persisted.mempool_stats } });
      return { chain_stats: { ...persisted.chain_stats }, mempool_stats: { ...persisted.mempool_stats } };
    }
    const key = `${scripthash}:${fingerprint}:${tip.hash}`;
    const pending = this.pendingAddressStats.get(key);
    if (pending) { return pending; }
    if (this.pendingAddressStats.size >= 16) { throw new IndexUnavailableError('Address accounting capacity reached; retry', false); }
    /** @asyncUnsafe */
    const collect = async () => {
      let chainBase: IEsploraApi.ChainStats | undefined;
      let newConfirmedHistory = confirmedHistory;
      const cachedPrefixCount = persisted
        ? confirmedHistory.filter(entry => entry.height <= persisted.tip_height).length : -1;
      if (persisted && persisted.chain_stats.tx_count === cachedPrefixCount
        && await this.persistentTipIsAncestor(persisted, tip)) {
        chainBase = persisted.chain_stats;
        newConfirmedHistory = confirmedHistory.filter(entry => entry.height > persisted.tip_height);
      }
      // Reuse only a proven active-chain prefix. Mempool entries are always
      // recalculated because their membership is intentionally mutable.
      const [chain_stats, mempool_stats] = await Promise.all([
        this.statsForHistoryEntries(scripthash, newConfirmedHistory, chainBase),
        this.statsForHistoryEntries(scripthash, mempoolHistory),
      ]);
      const result = { chain_stats, mempool_stats };
      this.addressStatsCache.delete(scripthash);
      this.addressStatsCache.set(scripthash, { fingerprint, chain_stats: { ...result.chain_stats }, mempool_stats: { ...result.mempool_stats } });
      while (this.addressStatsCache.size > 128) { this.addressStatsCache.delete(this.addressStatsCache.keys().next().value); }
      // Keep the shared SQL cache for histories expensive enough to justify it.
      // Existing rows continue to be maintained, while trivial public address
      // probes cannot grow the table without substantial on-chain history.
      if (persisted || confirmedHistory.length >= 1000) {
        await this.savePersistentAddressStats(scripthash, fingerprint, tip, result);
      }
      return result;
    };
    const promise = collect().finally(() => this.pendingAddressStats.delete(key));
    this.pendingAddressStats.set(key, promise);
    return promise;
  }

  /** @asyncUnsafe */
  async $getAddress(address: string): Promise<IEsploraApi.Address> {
    return this.consistentIndexRead(tip => this.$getAddressUnchecked(address, tip), `address:${address}`);
  }

  /** @asyncUnsafe */
  private async $getAddressUnchecked(address: string, tip: IndexTip): Promise<IEsploraApi.Address> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }
    if (!addressInfo.scriptPubKey) {
      throw new Error(PRIVATE_ADDRESS_ERROR);
    }

    try {
      const balance = await this.$getScriptHashBalance(addressInfo.scriptPubKey);
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);

      const stats = await this.addressStats(this.encodeScriptHash(addressInfo.scriptPubKey), history, tip);
      if (BigInt(stats.chain_stats.funded_txo_sum) - BigInt(stats.chain_stats.spent_txo_sum) !== BigInt(balance.confirmed)
        || BigInt(stats.mempool_stats.funded_txo_sum) - BigInt(stats.mempool_stats.spent_txo_sum) !== BigInt(balance.unconfirmed)) {
        throw new IndexUnavailableError('Electrum history and balance changed during address accounting; retry');
      }
      return { address: addressInfo.address, ...stats, electrum: true, stats_complete: true };
    } catch (e: any) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  /** @asyncUnsafe */
  async $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    return this.consistentIndexRead(tip => this.$getAddressTransactionsUnchecked(address, tip, lastSeenTxId), `address-txs:${address}:${lastSeenTxId || ''}`);
  }

  /** @asyncUnsafe */
  private async $getAddressTransactionsUnchecked(
    address: string, tip: IndexTip, lastSeenTxId: string
  ): Promise<IEsploraApi.Transaction[]> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }
    if (!addressInfo.scriptPubKey) {
      throw new Error(PRIVATE_ADDRESS_ERROR);
    }

    try {
      loadingIndicators.setProgress('address-' + address, 0);

      const transactions: IEsploraApi.Transaction[] = [];
      const history = await this.recentScriptHashHistory(
        this.encodeScriptHash(addressInfo.scriptPubKey), tip, lastSeenTxId);
      for (let i = 0; i < history.length; i++) {
        const tx = await this.$getRawTransaction(history[i].tx_hash, false, true);
        transactions.push(tx);
        loadingIndicators.setProgress('address-' + address, (i + 1) / history.length * 100);
      }
      loadingIndicators.setProgress('address-' + address, 100);
      return transactions;
    } catch (e: any) {
      loadingIndicators.setProgress('address-' + address, 100);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  async $getScriptHash(scripthash: string): Promise<IEsploraApi.ScriptHash> {
    return this.consistentIndexRead(tip => this.$getScriptHashUnchecked(scripthash, tip), `script:${scripthash}`);
  }

  private async $getScriptHashUnchecked(scripthash: string, tip: IndexTip): Promise<IEsploraApi.ScriptHash> {
    try {
      const balance = this.checkedBalance(await this.electrumClient.blockchainScripthash_getBalance(scripthash));
      const history = await this.fullScriptHashHistory(scripthash);

      const stats = await this.addressStats(scripthash, history || [], tip);
      if (BigInt(stats.chain_stats.funded_txo_sum) - BigInt(stats.chain_stats.spent_txo_sum) !== BigInt(balance.confirmed)
        || BigInt(stats.mempool_stats.funded_txo_sum) - BigInt(stats.mempool_stats.spent_txo_sum) !== BigInt(balance.unconfirmed)) {
        throw new IndexUnavailableError('Electrum history and balance changed during address accounting; retry');
      }
      return { scripthash, ...stats, electrum: true, stats_complete: true };
    } catch (e: any) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  /** @asyncUnsafe */
  async $getAddressUtxos(address: string): Promise<IEsploraApi.UTXO[]> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }
    if (!addressInfo.scriptPubKey) {
      throw new Error(PRIVATE_ADDRESS_ERROR);
    }
    const scripthash = this.encodeScriptHash(addressInfo.scriptPubKey);
    return this.$getScriptHashUtxos(scripthash);
  }

  async $getScriptHashTransactions(scripthash: string, lastSeenTxId?: string): Promise<IEsploraApi.Transaction[]> {
    return this.consistentIndexRead(tip => this.$getScriptHashTransactionsUnchecked(scripthash, tip, lastSeenTxId), `script-txs:${scripthash}:${lastSeenTxId || ''}`);
  }

  private async $getScriptHashTransactionsUnchecked(
    scripthash: string, tip: IndexTip, lastSeenTxId?: string
  ): Promise<IEsploraApi.Transaction[]> {
    try {
      loadingIndicators.setProgress('address-' + scripthash, 0);

      const transactions: IEsploraApi.Transaction[] = [];
      const history = await this.recentScriptHashHistory(scripthash, tip, lastSeenTxId);
      for (let i = 0; i < history.length; i++) {
        const tx = await this.$getRawTransaction(history[i].tx_hash, false, true);
        transactions.push(tx);
        loadingIndicators.setProgress('address-' + scripthash, (i + 1) / history.length * 100);
      }
      loadingIndicators.setProgress('address-' + scripthash, 100);
      return transactions;
    } catch (e: any) {
      loadingIndicators.setProgress('address-' + scripthash, 100);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  /** @asyncUnsafe */
  async $getScriptHashUtxos(scripthash: string): Promise<IEsploraApi.UTXO[]> {
    return this.consistentIndexRead(() => this.$getScriptHashUtxosUnchecked(scripthash), `utxos:${scripthash}`);
  }

  /** @asyncUnsafe */
  private async $getScriptHashUtxosUnchecked(scripthash: string): Promise<IEsploraApi.UTXO[]> {
    const utxos = await this.$getScriptHashUnspent(scripthash);
    const result: IEsploraApi.UTXO[] = [];
    for(const utxo of utxos) {
      if (BigInt(amount(utxo.value)) < 0n) {
        throw new Error('Invalid negative UTXO amount');
      }
      if(utxo.height <= 0) {
        //Unconfirmed
        result.push({
          txid: utxo.tx_hash,
          vout: utxo.tx_pos,
          status: {
            confirmed: false
          },
          value: amount(utxo.value)
        });
      } else {
        //Confirmed
        const blockHash = await this.$getBlockHash(utxo.height);
        const block = await this.$getBlock(blockHash);
        result.push({
          txid: utxo.tx_hash,
          vout: utxo.tx_pos,
          status: {
            confirmed: true,
            block_height: utxo.height,
            block_hash: blockHash,
            block_time: block.timestamp
          },
          value: amount(utxo.value)
        });
      }
    }
    return result;
  }

  private $getScriptHashUnspent(scriptHash: string): Promise<IElectrumApi.ScriptHashUtxos[]> {
    return this.electrumClient.blockchainScripthash_listunspent(scriptHash);
  }

  /** @asyncUnsafe */
  async $getTransactionMerkleProof(txId: string): Promise<IEsploraApi.MerkleProof> {
    return this.consistentIndexRead(/** @asyncUnsafe */ async () => {
      const tx = await this.$getRawTransaction(txId);
      if (!tx.status.confirmed || tx.status.block_height == null) { throw new Error('No confirmed Merkle proof'); }
      return this.electrumClient.blockchainTransaction_getMerkle(txId, tx.status.block_height);
    }, `merkle:${txId}`);
  }

  private $getScriptHashBalance(scriptHash: string): Promise<IElectrumApi.ScriptHashBalance> {
    return this.electrumClient.blockchainScripthash_getBalance(this.encodeScriptHash(scriptHash))
      .then(balance => this.checkedBalance(balance));
  }

  private $getScriptHashHistory(scriptHash: string): Promise<IElectrumApi.ScriptHashHistory[]> {
    return this.fullScriptHashHistory(this.encodeScriptHash(scriptHash));
  }

  private encodeScriptHash(scriptPubKey: string): string {
    const addrScripthash = crypto.enc.Hex.stringify(crypto.SHA256(crypto.enc.Hex.parse(scriptPubKey)));
    return addrScripthash!.match(/.{2}/g)!.reverse().join('');
  }

}

export default BitcoindElectrsApi;
