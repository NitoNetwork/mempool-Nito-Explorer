import { calculateStaleBlockStats } from '../../api/nito-stale-block-stats';

test('excludes coinbase from stale fee statistics while retaining block counts', () => {
  const block = {
    id: 'stale-hash',
    height: 100,
    timestamp: 1234,
    mediantime: 1200,
  } as any;
  const transactions = [
    {
      txid: 'coinbase', fee: '-1', size: 100, vsize: 100, weight: 400,
      vin: [{ is_coinbase: true }], vout: [{ value: '10000' }],
    },
    {
      txid: 'first', fee: '200', size: 100, vsize: 100, weight: 400,
      vin: [{ txid: 'parent', vout: 0 }], vout: [{ value: '1000' }],
    },
    {
      txid: 'second', fee: '400', size: 200, vsize: 200, weight: 800,
      vin: [{ txid: 'one', vout: 0 }, { txid: 'two', vout: 0 }],
      vout: [{ value: '2000' }, { value: '3000' }],
    },
  ] as any;

  const stats = calculateStaleBlockStats(block, transactions);

  expect(stats.totalfee).toBe('600');
  expect(stats.avgfee).toBe('300');
  expect(stats.medianfee).toBe('300');
  expect(stats.minfee).toBe('200');
  expect(stats.maxfee).toBe('400');
  expect(stats.avgfeerate).toBe(2);
  expect(stats.feerate_percentiles).toEqual([2, 2, 2, 2, 2]);
  expect(stats.txs).toBe(3);
  expect(stats.ins).toBe(3);
  expect(stats.outs).toBe(4);
  expect(stats.total_out).toBe('6000');
  expect(stats.total_size).toBe(300);
  expect(stats.total_weight).toBe(1200);
  expect(stats.subsidy).toBe('9400');
  expect(stats.utxo_increase).toBe(1);
});

test('returns zero fee statistics for a coinbase-only stale block', () => {
  const stats = calculateStaleBlockStats({
    id: 'stale-coinbase-only',
    height: 101,
    timestamp: 2234,
    mediantime: 2200,
  } as any, [{
    txid: 'coinbase', fee: '-1', size: 100, vsize: 100, weight: 400,
    vin: [{ is_coinbase: true }], vout: [{ value: '10000' }, { value: '20000' }],
  }] as any);

  expect(stats.totalfee).toBe('0');
  expect(stats.avgfee).toBe('0');
  expect(stats.medianfee).toBe('0');
  expect(stats.feerate_percentiles).toEqual([0, 0, 0, 0, 0]);
  expect(stats.txs).toBe(1);
  expect(stats.ins).toBe(0);
  expect(stats.outs).toBe(2);
  expect(stats.total_out).toBe('0');
  expect(stats.total_size).toBe(0);
  expect(stats.total_weight).toBe(0);
  expect(stats.subsidy).toBe('30000');
  expect(stats.utxo_increase).toBe(2);
});
