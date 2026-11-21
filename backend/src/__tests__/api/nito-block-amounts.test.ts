import { reconstructBlockAmounts } from '../../repositories/nito-block-amounts';

test('reconstructs public turnover beyond uint64 and uses Orchard net flow in transparent inputs', async () => {
  const rpc = {
    getBlock: jest.fn(async () => ({ height: 100, tx: [
      { vout: [{ value: '90071992.54740993' }] },
      ...Array.from({ length: 200 }, () => ({ vout: [{ value: '1284565890.00000000' }],
        has_private_bundle: true, private_bundle: { value_balance: '0.00000001' } })),
    ] })),
    getBlockStats: jest.fn(async () => ({ totalfee: '9007199254740993', avgfee: '45035996273704', medianfee: '45035996273704' })),
  };
  const result = await reconstructBlockAmounts(rpc, 'hash');
  const output = 200n * 128456589000000000n;
  expect(result.reward).toBe('9007199254740993');
  expect(result.totalOutputAmt).toBe(output.toString());
  expect(result.totalInputAmt).toBe((output + 9007199254740993n - 200n).toString());
  expect(result.totalFees).toBe('9007199254740993');
});
