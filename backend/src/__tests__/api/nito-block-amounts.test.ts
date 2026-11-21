import { reconstructBlockAmounts } from '../../repositories/nito-block-amounts';
import { nitoshi } from '../../api/nito-values';

test('reconstructs public turnover beyond uint64 and uses Orchard net flow in transparent inputs', async () => {
  const rpc = {
    getBlock: jest.fn(async () => ({ height: 100, tx: [
      { vout: [{ value: '90071992.54740993' }] },
      ...Array.from({ length: 200 }, () => ({ vout: [{ value: '1284565890.00000000' }],
        has_private_bundle: true,
        private_bundle: { actions: 1, flags: 3, has_auth: true, value_balance: '0.00000001' } })),
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

test('reconstructs a stale block from external and in-block prevouts without getblockstats', async () => {
  const externalValue = '90072000.54740993';
  const firstOutput = '90071992.54740993';
  const secondOutput = '90071991.54740993';
  const rpc = {
    getBlock: jest.fn(async () => ({ confirmations: -1, height: 100, tx: [
      { txid: 'coinbase', vin: [{ coinbase: '00' }], vout: [{ value: '1284565890.00000000' }] },
      {
        txid: 'first',
        vin: [{ txid: 'external', vout: 0 }],
        vout: [{ value: firstOutput }],
        has_private_bundle: true,
        private_bundle: { actions: 1, flags: 3, has_auth: true, value_balance: '-7.00000000' },
      },
      {
        txid: 'second',
        vin: [{ txid: 'first', vout: 0 }],
        vout: [{ value: secondOutput }],
      },
    ] })),
    getBlockStats: jest.fn(async () => { throw new Error('undo data unavailable'); }),
    getRawTransaction: jest.fn(async (txid: string) => {
      if (txid !== 'external') { throw new Error(`unexpected parent ${txid}`); }
      return { txid, vout: [{ value: externalValue }] };
    }),
  };

  const result = await reconstructBlockAmounts(rpc, 'stale-hash');

  expect(rpc.getBlockStats).not.toHaveBeenCalled();
  expect(rpc.getRawTransaction).toHaveBeenCalledTimes(1);
  expect(rpc.getRawTransaction).toHaveBeenCalledWith('external', true);
  expect(result.reward).toBe('128456589000000000');
  expect(result.totalFees).toBe('200000000');
  expect(result.avgFee).toBe('100000000');
  expect(result.medianFeeAmt).toBe('100000000');
  expect(result.totalInputAmt).toBe((nitoshi(externalValue) + nitoshi(firstOutput)).toString());
  expect(result.totalOutputAmt).toBe((nitoshi(firstOutput) + nitoshi(secondOutput)).toString());
});

test('fails closed when stale private metadata is incomplete', async () => {
  const rpc = {
    getBlock: jest.fn(async () => ({ confirmations: -1, height: 100, tx: [
      { txid: 'coinbase', vout: [{ value: '1.00000000' }] },
      {
        txid: 'private',
        vin: [{ txid: 'external', vout: 0 }],
        vout: [{ value: '1.00000000' }],
        has_private_bundle: true,
      },
    ] })),
    getBlockStats: jest.fn(),
    getRawTransaction: jest.fn(),
  };

  await expect(reconstructBlockAmounts(rpc, 'stale-hash')).rejects.toThrow('complete private metadata');
  expect(rpc.getBlockStats).not.toHaveBeenCalled();
  expect(rpc.getRawTransaction).not.toHaveBeenCalled();
});

test('fails closed when a stale prevout is unavailable', async () => {
  const rpc = {
    getBlock: jest.fn(async () => ({ confirmations: -1, height: 100, tx: [
      { txid: 'coinbase', vout: [{ value: '1.00000000' }] },
      {
        txid: 'transparent',
        vin: [{ txid: 'missing', vout: 1 }],
        vout: [{ value: '0.50000000' }],
      },
    ] })),
    getBlockStats: jest.fn(),
    getRawTransaction: jest.fn(async () => ({ txid: 'missing', vout: [] })),
  };

  await expect(reconstructBlockAmounts(rpc, 'stale-hash')).rejects.toThrow('missing prevout missing:1');
  expect(rpc.getBlockStats).not.toHaveBeenCalled();
});

test.each([
  ['negative', '1.00000000', '2.00000000', undefined],
  ['above MoneyRange', '1284565890.00000000', '0.00000000', '1284565890.00000000'],
])('rejects a %s reconstructed stale transaction fee', async (_label, parentValue, outputValue, privateBalance) => {
  const privateFields = privateBalance == null ? {} : {
    has_private_bundle: true,
    private_bundle: { actions: 1, flags: 3, has_auth: true, value_balance: privateBalance },
  };
  const rpc = {
    getBlock: jest.fn(async () => ({ confirmations: -1, height: 100, tx: [
      { txid: 'coinbase', vout: [{ value: '1284565890.00000000' }] },
      {
        txid: 'invalid-fee',
        vin: [{ txid: 'parent', vout: 0 }],
        vout: [{ value: outputValue }],
        ...privateFields,
      },
    ] })),
    getBlockStats: jest.fn(),
    getRawTransaction: jest.fn(async () => ({ txid: 'parent', vout: [{ value: parentValue }] })),
  };

  await expect(reconstructBlockAmounts(rpc, 'stale-hash')).rejects.toThrow('fee outside Nito MoneyRange');
  expect(rpc.getBlockStats).not.toHaveBeenCalled();
});
