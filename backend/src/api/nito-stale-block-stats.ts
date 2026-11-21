import { IBitcoinApi } from './bitcoin/bitcoin-api.interface';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import { TransactionExtended } from '../mempool.interfaces';
import { Amount, MAX_MONEY, amount, sumAmounts } from './nito-values';

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

function numericMedian(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  values.sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : Math.trunc((values[middle - 1] + values[middle]) / 2);
}

function safeMetric(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Cannot calculate stale block statistics without exact ${name}`);
  }
  return value;
}

function calculateFeeRate(fee: bigint, weight: number): number {
  return weight ? Number((fee * 4n) / BigInt(weight)) : 0;
}

function calculateFeeRatePercentiles(entries: { rate: number; weight: number }[], totalWeight: number): [number, number, number, number, number] {
  if (!entries.length || !totalWeight) {
    return [0, 0, 0, 0, 0];
  }
  entries.sort((left, right) => left.rate - right.rate);
  const thresholds = [totalWeight / 10, totalWeight / 4, totalWeight / 2, totalWeight * 3 / 4, totalWeight * 9 / 10];
  const result: number[] = [];
  let cumulativeWeight = 0;
  let threshold = 0;
  for (const entry of entries) {
    cumulativeWeight += entry.weight;
    while (threshold < thresholds.length && cumulativeWeight >= thresholds[threshold]) {
      result.push(entry.rate);
      threshold++;
    }
  }
  while (result.length < thresholds.length) {
    result.push(entries[entries.length - 1].rate);
  }
  return result as [number, number, number, number, number];
}

/** Core cannot calculate getblockstats for stale blocks after undo data is discarded. */
export function calculateStaleBlockStats(
  block: IEsploraApi.Block,
  transactions: TransactionExtended[],
  exactTransactionFees: Amount[],
): IBitcoinApi.BlockStats {
  if (!transactions.length) {
    throw new Error('Cannot calculate stale block statistics without transactions');
  }

  const ordinary = transactions.slice(1);
  if (exactTransactionFees.length !== ordinary.length) {
    throw new Error('Exact stale transaction fee count does not match block transactions');
  }
  const fees = exactTransactionFees.map(value => {
    const fee = BigInt(amount(value));
    if (fee < 0n || fee > MAX_MONEY) {
      throw new Error('Stale block transaction fee outside Nito MoneyRange');
    }
    return fee;
  });
  const sizes = ordinary.map(tx => safeMetric(tx.size, 'transaction size'));
  const weights = ordinary.map(tx => safeMetric(tx.weight, 'transaction weight'));
  const totalFee = fees.reduce((sum, fee) => sum + fee, 0n);
  const totalSize = sizes.reduce((sum, size) => sum + size, 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const feeRates = fees.map((fee, index) => ({
    rate: calculateFeeRate(fee, weights[index]),
    weight: weights[index],
  }));
  const sortedFees = [...fees].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const sortedRates = feeRates.map(entry => entry.rate).sort((left, right) => left - right);
  const reward = BigInt(sumAmounts(transactions[0].vout.map(vout => vout.value)));
  const outputs = transactions.reduce((sum, tx) => sum + tx.vout.length, 0);
  const inputs = ordinary.reduce((sum, tx) => sum + tx.vin.length, 0);
  const totalOut = sumAmounts(ordinary.flatMap(tx => tx.vout.map(vout => vout.value)));

  return {
    avgfee: ordinary.length ? (totalFee / BigInt(ordinary.length)).toString() : '0',
    avgfeerate: calculateFeeRate(totalFee, totalWeight),
    avgtxsize: ordinary.length ? Math.trunc(totalSize / ordinary.length) : 0,
    blockhash: block.id,
    feerate_percentiles: calculateFeeRatePercentiles([...feeRates], totalWeight),
    height: block.height,
    ins: inputs,
    maxfee: sortedFees.length ? sortedFees[sortedFees.length - 1].toString() : '0',
    maxfeerate: sortedRates.length ? sortedRates[sortedRates.length - 1] : 0,
    maxtxsize: sizes.length ? Math.max(...sizes) : 0,
    medianfee: truncatedMedian([...fees]),
    mediantime: block.mediantime,
    mediantxsize: numericMedian([...sizes]),
    minfee: sortedFees.length ? sortedFees[0].toString() : '0',
    minfeerate: sortedRates.length ? sortedRates[0] : 0,
    mintxsize: sizes.length ? Math.min(...sizes) : 0,
    outs: outputs,
    subsidy: (reward - totalFee).toString(),
    swtotal_size: 0,
    swtotal_weight: 0,
    swtxs: 0,
    time: block.timestamp,
    total_out: totalOut,
    total_size: totalSize,
    total_weight: totalWeight,
    totalfee: totalFee.toString(),
    txs: transactions.length,
    utxo_increase: outputs - inputs,
    utxo_size_inc: 0,
  };
}
