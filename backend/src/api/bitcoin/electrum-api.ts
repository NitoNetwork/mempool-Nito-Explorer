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
import { IndexUnavailableError } from './index-unavailable-error';

const PRIVATE_ORCHARD_ADDRESS_ERROR = 'Private Orchard address balances are not public';
type TransparentEffects = { vin: { txid: string; vout: number; is_coinbase: boolean }[]; vout: { scriptpubkey: string; value: string }[] };
type AddressContribution = { funded_txo_count: number; funded_txo_sum: string; spent_txo_count: number; spent_txo_sum: string };

class BitcoindElectrsApi extends BitcoinApi implements AbstractBitcoinApi {
  private electrumClient: any;
  private addressStatsCache = new Map<string, { fingerprint: string; chain_stats: IEsploraApi.ChainStats; mempool_stats: IEsploraApi.MempoolStats }>();
  private pendingAddressStats = new Map<string, Promise<{ chain_stats: IEsploraApi.ChainStats; mempool_stats: IEsploraApi.MempoolStats }>>();
  private addressContributions = new Map<string, AddressContribution>();
  private effectsCache = new Map<string, { effects: TransparentEffects; bytes: number }>();
  private effectsBytes = 0;
  private pendingEffects = new Map<string, Promise<TransparentEffects>>();
  private pendingIndexReads = new Map<string, Promise<unknown>>();

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
  private async indexTip(): Promise<string> {
    const expected = { mainnet: 'main', testnet: 'test', signet: 'signet', regtest: 'regtest' }[config.MEMPOOL.NETWORK];
    try {
      const [core, index] = await Promise.all([
        this.bitcoindClient.getBlockchainInfo(), this.electrumClient.request('blockchain.headers.subscribe', [])
      ]);
      if (!expected || core.chain !== expected || core.initialblockdownload) {
        throw new IndexUnavailableError('Core network mismatch or initial synchronization; index data unavailable', false);
      }
      if (index.height !== core.blocks) {
        throw new IndexUnavailableError('Core and ElectrumX height mismatch; index data unavailable');
      }
      const header = await this.bitcoindClient.getBlockHeader(core.bestblockhash, false);
      if (index.hex !== header) { throw new IndexUnavailableError('Core and ElectrumX tips differ; index data unavailable'); }
      return core.bestblockhash;
    } catch (error) {
      if (error instanceof IndexUnavailableError) { throw error; }
      throw new IndexUnavailableError('Core or ElectrumX unavailable; retry', false);
    }
  }

  /** @asyncUnsafe */
  private async consistentIndexRead<T>(read: () => Promise<T>, key: string): Promise<T> {
    const pending = this.pendingIndexReads.get(key);
    if (pending) { return pending as Promise<T>; }
    if (this.pendingIndexReads.size >= 128) { throw new IndexUnavailableError('Index read capacity reached; retry', false); }
    /** @asyncUnsafe */
    const collect = async (): Promise<T> => {
      for (let attempt = 0; ; attempt++) {
        try {
          const before = await this.indexTip();
          const result = await read();
          if (before !== await this.indexTip()) { throw new IndexUnavailableError('Chain tip changed during index read; retry'); }
          return result;
        } catch (error) {
          if (!(error instanceof IndexUnavailableError) || !error.retryable || attempt >= 2) { throw error; }
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

  /** @asyncUnsafe */
  private async addressStats(scripthash: string, history: IElectrumApi.ScriptHashHistory[]) {
    const fingerprint = crypto.SHA256(JSON.stringify(history)).toString();
    const cached = this.addressStatsCache.get(scripthash);
    if (cached && cached.fingerprint === fingerprint) {
      return { chain_stats: { ...cached.chain_stats }, mempool_stats: { ...cached.mempool_stats } };
    }
    const key = `${scripthash}:${fingerprint}`;
    const pending = this.pendingAddressStats.get(key);
    if (pending) { return pending; }
    if (this.pendingAddressStats.size >= 16) { throw new IndexUnavailableError('Address accounting capacity reached; retry', false); }
    /** @asyncUnsafe */
    const collect = async () => {
      const empty = (): IEsploraApi.ChainStats => ({ funded_txo_count: 0, funded_txo_sum: '0', spent_txo_count: 0, spent_txo_sum: '0', tx_count: 0 });
      const result = { chain_stats: empty(), mempool_stats: empty() };
      let next = 0;
      // Bound RPC work for a previously unseen address; cache only completed,
      // consistent histories, never a partial sum or a rounded balance surrogate.
      await Promise.all(Array.from({ length: Math.min(4, history.length) }, /** @asyncUnsafe */ async () => {
        while (next < history.length) {
          const entry = history[next++];
          const stats = entry.height > 0 ? result.chain_stats : result.mempool_stats;
          stats.tx_count++;
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
          while (this.addressContributions.size > 50_000) { this.addressContributions.delete(this.addressContributions.keys().next().value); }
          stats.funded_txo_count += contribution.funded_txo_count;
          stats.spent_txo_count += contribution.spent_txo_count;
          stats.funded_txo_sum = addAmounts(stats.funded_txo_sum, contribution.funded_txo_sum);
          stats.spent_txo_sum = addAmounts(stats.spent_txo_sum, contribution.spent_txo_sum);
        }
      }));
      this.addressStatsCache.delete(scripthash);
      this.addressStatsCache.set(scripthash, { fingerprint, chain_stats: { ...result.chain_stats }, mempool_stats: { ...result.mempool_stats } });
      while (this.addressStatsCache.size > 128) { this.addressStatsCache.delete(this.addressStatsCache.keys().next().value); }
      return result;
    };
    const promise = collect().finally(() => this.pendingAddressStats.delete(key));
    this.pendingAddressStats.set(key, promise);
    return promise;
  }

  /** @asyncUnsafe */
  async $getAddress(address: string): Promise<IEsploraApi.Address> {
    return this.consistentIndexRead(() => this.$getAddressUnchecked(address), `address:${address}`);
  }

  /** @asyncUnsafe */
  private async $getAddressUnchecked(address: string): Promise<IEsploraApi.Address> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }
    if (!addressInfo.scriptPubKey) {
      throw new Error(PRIVATE_ORCHARD_ADDRESS_ERROR);
    }

    try {
      const balance = await this.$getScriptHashBalance(addressInfo.scriptPubKey);
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);

      const stats = await this.addressStats(this.encodeScriptHash(addressInfo.scriptPubKey), history);
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
    return this.consistentIndexRead(() => this.$getAddressTransactionsUnchecked(address, lastSeenTxId), `address-txs:${address}:${lastSeenTxId || ''}`);
  }

  /** @asyncUnsafe */
  private async $getAddressTransactionsUnchecked(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }
    if (!addressInfo.scriptPubKey) {
      throw new Error(PRIVATE_ORCHARD_ADDRESS_ERROR);
    }

    try {
      loadingIndicators.setProgress('address-' + address, 0);

      const transactions: IEsploraApi.Transaction[] = [];
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);
      history.sort((a, b) => (b.height || 9999999) - (a.height || 9999999));

      let startingIndex = 0;
      if (lastSeenTxId) {
        const pos = history.findIndex((historicalTx) => historicalTx.tx_hash === lastSeenTxId);
        if (pos >= 0) {
          startingIndex = pos + 1;
        }
      }
      const endIndex = Math.min(startingIndex + 10, history.length);

      for (let i = startingIndex; i < endIndex; i++) {
        const tx = await this.$getRawTransaction(history[i].tx_hash, false, true);
        transactions.push(tx);
        loadingIndicators.setProgress('address-' + address, (i + 1) / endIndex * 100);
      }

      return transactions;
    } catch (e: any) {
      loadingIndicators.setProgress('address-' + address, 100);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  async $getScriptHash(scripthash: string): Promise<IEsploraApi.ScriptHash> {
    return this.consistentIndexRead(() => this.$getScriptHashUnchecked(scripthash), `script:${scripthash}`);
  }

  private async $getScriptHashUnchecked(scripthash: string): Promise<IEsploraApi.ScriptHash> {
    try {
      const balance = this.checkedBalance(await this.electrumClient.blockchainScripthash_getBalance(scripthash));
      const history: IElectrumApi.ScriptHashHistory[] = await this.electrumClient.blockchainScripthash_getHistory(scripthash);

      const stats = await this.addressStats(scripthash, history || []);
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
      throw new Error(PRIVATE_ORCHARD_ADDRESS_ERROR);
    }
    const scripthash = this.encodeScriptHash(addressInfo.scriptPubKey);
    return this.$getScriptHashUtxos(scripthash);
  }

  async $getScriptHashTransactions(scripthash: string, lastSeenTxId?: string): Promise<IEsploraApi.Transaction[]> {
    return this.consistentIndexRead(() => this.$getScriptHashTransactionsUnchecked(scripthash, lastSeenTxId), `script-txs:${scripthash}:${lastSeenTxId || ''}`);
  }

  private async $getScriptHashTransactionsUnchecked(scripthash: string, lastSeenTxId?: string): Promise<IEsploraApi.Transaction[]> {
    try {
      loadingIndicators.setProgress('address-' + scripthash, 0);

      const transactions: IEsploraApi.Transaction[] = [];
      const history: IElectrumApi.ScriptHashHistory[] = await this.electrumClient.blockchainScripthash_getHistory(scripthash);
      if (!history) {
        throw new Error('failed to get scripthash history');
      }
      history.sort((a, b) => (b.height || 9999999) - (a.height || 9999999));

      let startingIndex = 0;
      if (lastSeenTxId) {
        const pos = history.findIndex((historicalTx) => historicalTx.tx_hash === lastSeenTxId);
        if (pos >= 0) {
          startingIndex = pos + 1;
        }
      }
      const endIndex = Math.min(startingIndex + 10, history.length);

      for (let i = startingIndex; i < endIndex; i++) {
        const tx = await this.$getRawTransaction(history[i].tx_hash, false, true);
        transactions.push(tx);
        loadingIndicators.setProgress('address-' + scripthash, (i + 1) / endIndex * 100);
      }

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
    return this.electrumClient.blockchainScripthash_getHistory(this.encodeScriptHash(scriptHash));
  }

  private encodeScriptHash(scriptPubKey: string): string {
    const addrScripthash = crypto.enc.Hex.stringify(crypto.SHA256(crypto.enc.Hex.parse(scriptPubKey)));
    return addrScripthash!.match(/.{2}/g)!.reverse().join('');
  }

}

export default BitcoindElectrsApi;
