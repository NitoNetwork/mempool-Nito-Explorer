import { amount, addAmounts, sumAmounts, coinToNitoshi, subtractAmounts } from '../api/nito-values';

/**
 * Reconstruct legacy monetary columns from public Core data, never rounded SQL values.
 * @asyncUnsafe Core RPC failures must abort the historical reconstruction.
 */
export async function reconstructBlockAmounts(rpc: any, hash: string) {
  const block = await rpc.getBlock(hash, 2);
  const stats = block.height === 0 ? { totalfee: '0', avgfee: '0', medianfee: '0' } : await rpc.getBlockStats(hash);
  const reward = sumAmounts(block.tx[0].vout.map(vout => coinToNitoshi(vout.value)));
  const ordinary = block.tx.slice(1);
  const totalOutputAmt = sumAmounts(ordinary.flatMap(tx => tx.vout.map(vout => coinToNitoshi(vout.value))));
  const balance = sumAmounts(ordinary.map(tx => {
    if (tx.has_private_bundle && tx.private_bundle?.value_balance == null) {
      throw new Error('Cannot reconstruct block amounts without Orchard metadata');
    }
    return coinToNitoshi(tx.private_bundle?.value_balance ?? '0');
  }));
  return {
    reward,
    totalFees: amount(stats.totalfee),
    avgFee: amount(stats.avgfee),
    medianFeeAmt: amount(stats.medianfee),
    totalOutputAmt,
    totalInputAmt: subtractAmounts(addAmounts(totalOutputAmt, stats.totalfee), balance),
    feePercentiles: null,
    amountsVersion: 1,
  };
}
