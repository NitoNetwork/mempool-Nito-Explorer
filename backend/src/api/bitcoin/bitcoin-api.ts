import { amount, compareAmounts, MAX_MONEY, transactionNitoshi } from '../nito-values';
import * as bitcoinjs from 'bitcoinjs-lib';
import { AbstractBitcoinApi, HealthCheckHost } from './bitcoin-api-abstract-factory';
import { IBitcoinApi, SubmitPackageResult, TestMempoolAcceptResult } from './bitcoin-api.interface';
import { IEsploraApi } from './esplora-api.interface';
import blocks from '../blocks';
import mempool from '../mempool';
import { TransactionExtended } from '../../mempool.interfaces';
import transactionUtils from '../transaction-utils';
import { Common } from '../common';
import { privateMetadataState, safeNitoshi } from '../nito-values';

class BitcoinApi implements AbstractBitcoinApi {
  private rawMempoolCache: IBitcoinApi.RawMempool | null = null;
  private rawMempoolCacheTime = 0;
  protected bitcoindClient: any;

  constructor(bitcoinClient: any) {
    this.bitcoindClient = bitcoinClient;
  }

  static convertBlock(block: IBitcoinApi.Block): IEsploraApi.Block {
    return {
      id: block.hash,
      height: block.height,
      version: block.version,
      timestamp: block.time,
      bits: parseInt(block.bits, 16),
      nonce: block.nonce,
      difficulty: block.difficulty,
      merkle_root: block.merkleroot,
      tx_count: block.nTx,
      size: block.size,
      weight: block.weight,
      previousblockhash: block.previousblockhash,
      mediantime: block.mediantime,
      stale: block.confirmations === -1,
    };
  }


  $getRawTransaction(txId: string, skipConversion = false, addPrevout = false, lazyPrevouts = false): Promise<IEsploraApi.Transaction> {
    // If the transaction is in the mempool we already converted and fetched the fee. Only prevouts are missing
    const txInMempool = mempool.getMempool()[txId];
    if (txInMempool && addPrevout) {
      return this.$addPrevouts(txInMempool);
    }

    return this.bitcoindClient.getRawTransaction(txId, true)
      .then(/** @asyncUnsafe */ async (transaction: IBitcoinApi.Transaction) => {
        if (skipConversion) {
          transaction.vout.forEach((vout) => {
            vout.value = transactionNitoshi(vout.value);
          });
          return transaction;
        }
        const header = transaction.confirmations > 0 && transaction.blockhash
          ? await this.bitcoindClient.getBlockHeader(transaction.blockhash) : undefined;
        if (header?.confirmations <= 0) { transaction.confirmations = -1; }
        return this.$convertTransaction(transaction, addPrevout, lazyPrevouts, false, false, header?.height);
      })
      .catch((e: Error) => {
        if (e.message.startsWith('The genesis block coinbase')) {
          return this.$returnCoinbaseTransaction();
        }
        throw e;
      });
  }

  async $getRawTransactions(txids: string[]): Promise<IEsploraApi.Transaction[]> {
    const txs: IEsploraApi.Transaction[] = [];
    for (const txid of txids) {
      try {
        const tx = await this.$getRawTransaction(txid, false, true);
        txs.push(tx);
      } catch (err) {
        // skip failures
      }
    }
    return txs;
  }

  $getMempoolTransactions(txids: string[]): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getMempoolTransactions not supported by the Bitcoin RPC API.');
  }

  $getAllMempoolTransactions(lastTxid?: string, max_txs?: number): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getAllMempoolTransactions not supported by the Bitcoin RPC API.');

  }

  async $getTransactionHex(txId: string): Promise<string> {
    const txInMempool = mempool.getMempool()[txId];
    if (txInMempool && txInMempool.hex) {
      return txInMempool.hex;
    }

    return this.bitcoindClient.getRawTransaction(txId, true)
      .then((transaction: IBitcoinApi.Transaction) => {
        return transaction.hex;
      });
  }

  $getTransactionMerkleProof(txId: string): Promise<IEsploraApi.MerkleProof> {
    throw new Error('Method getTransactionMerkleProof not supported by the Bitcoin RPC API.');
  }

  $getBlockHeightTip(): Promise<number> {
    return this.bitcoindClient.getBlockCount();
  }

  $getBlockHashTip(): Promise<string> {
    return this.bitcoindClient.getBestBlockHash();
  }

  $getTxIdsForBlock(hash: string, fallbackToCore = false): Promise<string[]> {
    return this.bitcoindClient.getBlock(hash, 1)
      .then((rpcBlock: IBitcoinApi.Block) => rpcBlock.tx);
  }

  /** @asyncUnsafe */
  async $getTxsForBlock(hash: string, fallbackToCore = false): Promise<IEsploraApi.Transaction[]> {
    const verboseBlock: IBitcoinApi.VerboseBlock = await this.bitcoindClient.getBlock(hash, 2);
    const transactions: IEsploraApi.Transaction[] = [];
    for (const tx of verboseBlock.tx) {
      tx.confirmations = verboseBlock.confirmations;
      tx.blockhash = hash;
      tx.blocktime = verboseBlock.time;
      const converted = await this.$convertTransaction(tx, false, false, verboseBlock.confirmations === -1, false, verboseBlock.height);
      converted.status = {
        confirmed: verboseBlock.confirmations > 0,
        block_height: verboseBlock.height,
        block_hash: hash,
        block_time: verboseBlock.time,
      };
      transactions.push(converted);
    }
    return transactions;
  }

  $getRawBlock(hash: string): Promise<Buffer> {
    return this.bitcoindClient.getBlock(hash, 0)
      .then((raw: string) => Buffer.from(raw, 'hex'));
  }

  $getBlockHash(height: number): Promise<string> {
    return this.bitcoindClient.getBlockHash(height);
  }

  $getBlockHeader(hash: string): Promise<string> {
    return this.bitcoindClient.getBlockHeader(hash, false);
  }

  async $getBlock(hash: string): Promise<IEsploraApi.Block> {
    const foundBlock = blocks.getBlocks().find((block) => block.id === hash);
    if (foundBlock) {
      return foundBlock;
    }

    return this.bitcoindClient.getBlock(hash)
      .then((block: IBitcoinApi.Block) => BitcoinApi.convertBlock(block));
  }

  $getAddress(address: string): Promise<IEsploraApi.Address> {
    throw new Error('Method getAddress not supported by the Bitcoin RPC API.');
  }

  $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getAddressTransactions not supported by the Bitcoin RPC API.');
  }

  $getAddressUtxos(address: string): Promise<IEsploraApi.UTXO[]> {
    throw new Error('Method getAddressUtxos not supported by the Bitcoin RPC API.');
  }

  $getScriptHash(scripthash: string): Promise<IEsploraApi.ScriptHash> {
    throw new Error('Method getScriptHash not supported by the Bitcoin RPC API.');
  }

  $getScriptHashTransactions(scripthash: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getScriptHashTransactions not supported by the Bitcoin RPC API.');
  }

  $getScriptHashUtxos(scripthash: string): Promise<IEsploraApi.UTXO[]> {
    throw new Error('Method getScriptHashUtxos not supported by the Bitcoin RPC API.');
  }

  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]> {
    return this.bitcoindClient.getRawMemPool();
  }

  $getAddressPrefix(prefix: string): string[] {
    const found: { [address: string]: string } = {};
    const mp = mempool.getMempool();
    for (const tx in mp) {
      for (const vout of mp[tx].vout) {
        if (vout.scriptpubkey_address?.indexOf(prefix) === 0) {
          found[vout.scriptpubkey_address] = '';
          if (Object.keys(found).length >= 10) {
            return Object.keys(found);
          }
        }
      }
      for (const vin of mp[tx].vin) {
        if (vin.prevout?.scriptpubkey_address?.indexOf(prefix) === 0) {
          found[vin.prevout?.scriptpubkey_address] = '';
          if (Object.keys(found).length >= 10) {
            return Object.keys(found);
          }
        }
      }
    }
    return Object.keys(found);
  }

  $sendRawTransaction(rawTransaction: string): Promise<string> {
    return this.bitcoindClient.sendRawTransaction(rawTransaction);
  }

  /** @asyncUnsafe */
  async $decodeRawTransaction(raw: string): Promise<IEsploraApi.Transaction> {
    const decoded = await this.bitcoindClient.decodeRawTransaction(raw);
    return this.$convertTransaction(decoded, false, false, false, true);
  }

  async $testMempoolAccept(rawTransactions: string[], maxfeerate?: number): Promise<TestMempoolAcceptResult[]> {
    if (rawTransactions.length) {
      return this.bitcoindClient.testMempoolAccept(rawTransactions, maxfeerate ?? undefined);
    } else {
      return [];
    }
  }

  $submitPackage(rawTransactions: string[], maxfeerate?: number, maxburnamount?: string): Promise<SubmitPackageResult> {
    return this.bitcoindClient.submitPackage(rawTransactions, maxfeerate ?? undefined, maxburnamount ?? undefined);
  }

  /** @asyncUnsafe */
  async $getOutspend(txId: string, vout: number): Promise<IEsploraApi.Outspend> {
    const txOut = await this.bitcoindClient.getTxOut(txId, vout, false);
    return {
      spent: txOut === null,
      status: {
        confirmed: true,
      }
    };
  }

  /** @asyncUnsafe */
  async $getOutspends(txId: string): Promise<IEsploraApi.Outspend[]> {
    const outSpends: IEsploraApi.Outspend[] = [];
    const tx = await this.$getRawTransaction(txId, true, false);
    for (let i = 0; i < tx.vout.length; i++) {
      if (tx.status && tx.status.block_height === 0) {
        outSpends.push({
          spent: false
        });
      } else {
        const txOut = await this.bitcoindClient.getTxOut(txId, i);
        outSpends.push({
          spent: txOut === null,
        });
      }
    }
    return outSpends;
  }

  /** @asyncUnsafe */
  async $getBatchedOutspends(txId: string[]): Promise<IEsploraApi.Outspend[][]> {
    const outspends: IEsploraApi.Outspend[][] = [];
    for (const tx of txId) {
      const outspend = await this.$getOutspends(tx);
      outspends.push(outspend);
    }
    return outspends;
  }

  async $getBatchedOutspendsInternal(txId: string[]): Promise<IEsploraApi.Outspend[][]> {
    return this.$getBatchedOutspends(txId);
  }

  /** @asyncUnsafe */
  async $getOutSpendsByOutpoint(outpoints: { txid: string, vout: number }[]): Promise<IEsploraApi.Outspend[]> {
    const outspends: IEsploraApi.Outspend[] = [];
    for (const outpoint of outpoints) {
      const outspend = await this.$getOutspend(outpoint.txid, outpoint.vout);
      outspends.push(outspend);
    }
    return outspends;
  }

  /** @asyncUnsafe */
  async $getCoinbaseTx(blockhash: string): Promise<IEsploraApi.Transaction> {
    const txids = await this.$getTxIdsForBlock(blockhash);
    return this.$getRawTransaction(txids[0]);
  }

  async $getAddressTransactionSummary(address: string): Promise<IEsploraApi.AddressTxSummary[]> {
    throw new Error('Method getAddressTransactionSummary not supported by the Bitcoin RPC API.');
  }

  $getEstimatedHashrate(blockHeight: number): Promise<number> {
    // 120 is the default block span in Core
    return this.bitcoindClient.getNetworkHashPs(120, blockHeight);
  }

  /** @asyncUnsafe */
  protected async $convertTransaction(transaction: IBitcoinApi.Transaction, addPrevout: boolean, lazyPrevouts = false, allowMissingPrevouts = false, decodedOnly = false, blockHeight?: number): Promise<IEsploraApi.Transaction> {
    let esploraTransaction: IEsploraApi.Transaction = {
      txid: transaction.txid,
      wtxid: transaction.hash,
      serialized_vsize: transaction.vsize,
      private_metadata_status: privateMetadataState(transaction),
      version: transaction.version,
      locktime: transaction.locktime,
      size: transaction.size,
      weight: transaction.weight,
      fee: transaction.fee != null ? transactionNitoshi(transaction.fee) : '-1',
      fee_source: transaction.fee != null ? 'core' : 'unknown',
      vin: [],
      vout: [],
      status: { confirmed: false },
    };

    if (esploraTransaction.private_metadata_status !== 'transparent') {
      esploraTransaction.has_private_bundle = true;
      if (transaction.private_bundle) {
        esploraTransaction.private_bundle = transaction.private_bundle;
      }
    }

    esploraTransaction.vout = transaction.vout.map((vout) => {
      return {
        value: transactionNitoshi(vout.value),
        scriptpubkey: vout.scriptPubKey.hex,
        scriptpubkey_address: vout.scriptPubKey && vout.scriptPubKey.address ? vout.scriptPubKey.address
          : vout.scriptPubKey.addresses ? vout.scriptPubKey.addresses[0] : '',
        scriptpubkey_asm: vout.scriptPubKey.asm ? transactionUtils.convertScriptSigAsm(vout.scriptPubKey.hex) : '',
        scriptpubkey_type: this.translateScriptPubKeyType(vout.scriptPubKey.type),
      };
    });

    esploraTransaction.vin = transaction.vin.map((vin) => {
      return {
        is_coinbase: !!vin.coinbase,
        prevout: null,
        scriptsig: vin.scriptSig && vin.scriptSig.hex || vin.coinbase || '',
        scriptsig_asm: vin.scriptSig ? transactionUtils.convertScriptSigAsm(vin.scriptSig.hex) : (vin.coinbase ? transactionUtils.convertScriptSigAsm(vin.coinbase) : ''),
        sequence: vin.sequence,
        txid: vin.txid || '',
        vout: vin.vout || 0,
        witness: vin.txinwitness || [],
        inner_redeemscript_asm: '',
        inner_witnessscript_asm: '',
      };
    });

    if (transaction.confirmations > 0) {
      esploraTransaction.status = {
        confirmed: true,
        block_height: blockHeight,
        block_hash: transaction.blockhash,
        block_time: transaction.blocktime,
      };
    }

    if (addPrevout) {
      try {
        esploraTransaction = await this.$calculateFeeFromInputs(esploraTransaction, false, lazyPrevouts);
      } catch (e) {
        if (!allowMissingPrevouts) {
          throw e;
        }
      }
    }
    if (!transaction.confirmations && !decodedOnly) {
      esploraTransaction = await this.$appendMempoolFeeData(esploraTransaction);
    }

    if (esploraTransaction.vin[0]?.is_coinbase) {
      esploraTransaction.fee = '0';
      esploraTransaction.fee_source = 'coinbase';
    }

    return esploraTransaction;
  }

  private translateScriptPubKeyType(outputType: string): string {
    const map = {
      'pubkey': 'p2pk',
      'pubkeyhash': 'p2pkh',
      'scripthash': 'p2sh',
      'witness_v0_keyhash': 'v0_p2wpkh',
      'witness_v0_scripthash': 'v0_p2wsh',
      'witness_v1_taproot': 'v1_p2tr',
      'nonstandard': 'nonstandard',
      'multisig': 'multisig',
      'anchor': 'anchor',
      'nulldata': 'op_return'
    };

    if (map[outputType]) {
      return map[outputType];
    } else {
      return 'unknown';
    }
  }

  private privateValueBalanceSats(transaction: IEsploraApi.Transaction): string {
    if (!transaction.private_bundle || transaction.private_bundle.value_balance == null) {
      return '0';
    }
    return safeNitoshi(transaction.private_bundle.value_balance);
  }

  private hasPrivateBundleWithoutValueBalance(transaction: IEsploraApi.Transaction): boolean {
    return transaction.private_metadata_status === 'incomplete' || (!!transaction.has_private_bundle && transaction.private_bundle?.value_balance == null);
  }

  /** @asyncUnsafe */
  private async $appendMempoolFeeData(transaction: IEsploraApi.Transaction): Promise<IEsploraApi.Transaction> {
    let mempoolEntry: IBitcoinApi.MempoolEntry;
    if (!mempool.isInSync() && (!this.rawMempoolCache || Date.now() - this.rawMempoolCacheTime > 2000)) {
      this.rawMempoolCache = await this.$getRawMempoolVerbose();
      this.rawMempoolCacheTime = Date.now();
    }
    if (!mempool.isInSync() && this.rawMempoolCache && this.rawMempoolCache[transaction.txid]) {
      mempoolEntry = this.rawMempoolCache[transaction.txid];
    } else {
      mempoolEntry = await this.$getMempoolEntry(transaction.txid);
    }
    if (!Number.isSafeInteger(mempoolEntry.vsize) || mempoolEntry.vsize <= 0 || mempoolEntry.wtxid !== transaction.wtxid) {
      throw new Error('Incomplete or inconsistent Core mempool entry');
    }
    transaction.fee = transactionNitoshi(mempoolEntry.fees.base);
    transaction.fee_source = 'core';
    transaction.policy_vsize = mempoolEntry.vsize;
    return transaction;
  }

  /** @asyncUnsafe */
  protected async $addPrevouts(transaction: TransactionExtended): Promise<TransactionExtended> {
    let addedPrevouts = false;
    for (const vin of transaction.vin) {
      if (vin.prevout) {
        continue;
      }
      const innerTx = await this.$getRawTransaction(vin.txid, false, false);
      vin.prevout = innerTx.vout[vin.vout];
      transactionUtils.addInnerScriptsToVin(vin);
      addedPrevouts = true;
    }
    if (addedPrevouts) {
      // re-calculate transaction flags now that we have full prevout data
      transaction.flags = undefined; // clear existing flags to force full classification
      transaction.flags = Common.getTransactionFlags(transaction, transaction.status?.block_height ?? blocks.getCurrentBlockHeight());
    }
    return transaction;
  }

  protected $returnCoinbaseTransaction(): Promise<IEsploraApi.Transaction> {
    return this.bitcoindClient.getBlockHash(0).then((hash: string) =>
      this.bitcoindClient.getBlock(hash, 2)
        .then((block: IBitcoinApi.Block) => {
          return this.$convertTransaction(Object.assign(block.tx[0], {
            confirmations: blocks.getCurrentBlockHeight() + 1,
            blockhash: hash, blocktime: block.time }), false, false, false, false, 0);
        })
    );
  }

  private $getMempoolEntry(txid: string): Promise<IBitcoinApi.MempoolEntry> {
    return this.bitcoindClient.getMempoolEntry(txid);
  }

  private $getRawMempoolVerbose(): Promise<IBitcoinApi.RawMempool> {
    return this.bitcoindClient.getRawMemPool(true);
  }


  /** @asyncUnsafe */
  private async $calculateFeeFromInputs(transaction: IEsploraApi.Transaction, addPrevout: boolean, lazyPrevouts: boolean): Promise<IEsploraApi.Transaction> {
    if (transaction.vin[0]?.is_coinbase) {
      transaction.fee = '0';
      return transaction;
    }
    if (this.hasPrivateBundleWithoutValueBalance(transaction)) {
      transaction.fee = compareAmounts(transaction.fee, 0) >= 0 ? amount(transaction.fee) : '-1';
      return transaction;
    }
    for (let i = 0; i < transaction.vin.length; i++) {
      if (lazyPrevouts && i > 12) {
        transaction.vin[i].lazy = true;
        continue;
      }
      const innerTx = await this.$getRawTransaction(transaction.vin[i].txid, false, false);
      transaction.vin[i].prevout = innerTx.vout[transaction.vin[i].vout];
      transactionUtils.addInnerScriptsToVin(transaction.vin[i]);
    }
    if (lazyPrevouts && transaction.vin.length > 12) {
      transaction.fee = '-1';
    } else {
      const exactFee = BigInt(this.privateValueBalanceSats(transaction))
        + transaction.vin.reduce((sum, vin) => sum + BigInt(vin.prevout!.value), 0n)
        - transaction.vout.reduce((sum, output) => sum + BigInt(output.value), 0n);
      if (exactFee < 0n || exactFee > MAX_MONEY) { throw new Error('Invalid public transaction fee'); }
      transaction.fee = exactFee.toString();
      transaction.fee_source = 'public-balance';
    }
    return transaction;
  }

  public startHealthChecks(): void {};

  public getHealthStatus() {
    return [];
  }
}

export default BitcoinApi;
