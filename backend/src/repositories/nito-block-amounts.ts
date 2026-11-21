import {
  MAX_MONEY,
  amount,
  coinToNitoshi,
  divideAmount,
  privateMetadataState,
  sumAmounts,
  transactionNitoshi,
} from '../api/nito-values';

interface ReconstructionOptions {
  stale?: boolean;
}

function truncatedMedian(values: bigint[]): string {
  if (!values.length) {
    return '0';
  }
  values.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const middle = Math.floor(values.length / 2);
  return (values.length % 2
    ? values[middle]
    : (values[middle - 1] + values[middle]) / 2n).toString();
}

function checkedPrivateBalance(tx: any): bigint {
  const state = privateMetadataState(tx);
  if (state === 'incomplete') {
    throw new Error('Cannot reconstruct block amounts without complete private metadata');
  }
  if (state === 'transparent') {
    return 0n;
  }
  const balance = BigInt(coinToNitoshi(tx.private_bundle.value_balance));
  if (balance < -MAX_MONEY || balance > MAX_MONEY) {
    throw new Error('Private value balance outside Nito MoneyRange');
  }
  return balance;
}

/** Rebuild stale-block fees without relying on undo data retained by Core. @asyncUnsafe */
async function reconstructStaleBlockAmounts(rpc: any, block: any) {
  if (!Array.isArray(block?.tx) || !block.tx.length) {
    throw new Error('Cannot reconstruct block amounts without verbose transactions');
  }

  const transactions = new Map<string, any>();
  for (const tx of block.tx) {
    if (!tx || typeof tx.txid !== 'string' || transactions.has(tx.txid) || !Array.isArray(tx.vout)) {
      throw new Error('Cannot reconstruct block amounts from incomplete transaction data');
    }
    transactions.set(tx.txid, tx);
  }

  const externalParents = new Map<string, Promise<any>>();
  const getParent = (txid: string): Promise<any> => {
    const inBlock = transactions.get(txid);
    if (inBlock) {
      return Promise.resolve(inBlock);
    }
    let parent = externalParents.get(txid);
    if (!parent) {
      parent = Promise.resolve(rpc.getRawTransaction(txid, true));
      externalParents.set(txid, parent);
    }
    return parent;
  };

  const reward = sumAmounts(block.tx[0].vout.map((vout: any) => transactionNitoshi(vout.value)));
  let totalInputs = 0n;
  let totalOutputs = 0n;
  let totalFees = 0n;
  const fees: bigint[] = [];

  for (const tx of block.tx.slice(1)) {
    if (!Array.isArray(tx.vin) || !Array.isArray(tx.vout)) {
      throw new Error('Cannot reconstruct block amounts from incomplete transaction data');
    }
    const privateBalance = checkedPrivateBalance(tx);
    let transactionInputs = 0n;
    for (const vin of tx.vin) {
      if (!vin || typeof vin.txid !== 'string' || !Number.isSafeInteger(vin.vout) || vin.vout < 0) {
        throw new Error('Cannot reconstruct block amounts from incomplete prevout metadata');
      }
      const parent = await getParent(vin.txid);
      const prevout = parent?.vout?.[vin.vout];
      if (!prevout || prevout.value == null) {
        throw new Error(`Cannot reconstruct block amounts: missing prevout ${vin.txid}:${vin.vout}`);
      }
      transactionInputs += BigInt(transactionNitoshi(prevout.value));
    }
    const transactionOutputs = BigInt(sumAmounts(tx.vout.map((vout: any) => transactionNitoshi(vout.value))));
    const fee = transactionInputs + privateBalance - transactionOutputs;
    if (fee < 0n || fee > MAX_MONEY) {
      throw new Error('Reconstructed transaction fee outside Nito MoneyRange');
    }
    totalInputs += transactionInputs;
    totalOutputs += transactionOutputs;
    totalFees += fee;
    fees.push(fee);
  }

  return {
    reward,
    totalFees: totalFees.toString(),
    avgFee: fees.length ? divideAmount(totalFees.toString(), fees.length) : '0',
    medianFeeAmt: truncatedMedian(fees),
    totalOutputAmt: totalOutputs.toString(),
    totalInputAmt: totalInputs.toString(),
    feePercentiles: null,
    amountsVersion: 1,
  };
}

/**
 * Reconstruct legacy monetary columns from public Core data, never rounded SQL values.
 * @asyncUnsafe Core RPC failures must abort the historical reconstruction.
 */
export async function reconstructBlockAmounts(rpc: any, hash: string, options: ReconstructionOptions = {}) {
  const block = await rpc.getBlock(hash, 2);
  if (options.stale || block?.confirmations < 0) {
    return reconstructStaleBlockAmounts(rpc, block);
  }
  const stats = block.height === 0 ? { totalfee: '0', avgfee: '0', medianfee: '0' } : await rpc.getBlockStats(hash);
  const reward = sumAmounts(block.tx[0].vout.map(vout => coinToNitoshi(vout.value)));
  const ordinary = block.tx.slice(1);
  const totalOutputAmt = sumAmounts(ordinary.flatMap(tx => tx.vout.map(vout => coinToNitoshi(vout.value))));
  const balance = sumAmounts(ordinary.map(tx => checkedPrivateBalance(tx)));
  return {
    reward,
    totalFees: amount(stats.totalfee),
    avgFee: amount(stats.avgfee),
    medianFeeAmt: amount(stats.medianfee),
    totalOutputAmt,
    totalInputAmt: (BigInt(totalOutputAmt) + BigInt(amount(stats.totalfee)) - BigInt(balance)).toString(),
    feePercentiles: null,
    amountsVersion: 1,
  };
}
