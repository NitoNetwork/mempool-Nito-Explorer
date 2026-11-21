import DB from '../database';
import config from '../config';
import blocks from '../repositories/BlocksRepository';
import summaries from '../repositories/BlocksSummariesRepository';
import cpfp from '../repositories/CpfpRepository';
import statistics from '../api/statistics/statistics-api';
import bitcoinClient from '../api/bitcoin/bitcoin-client';
import { exactAverageSql } from '../api/exact-sql-average';
import { exactMoneyColumnMigrations, legacyStatisticsMoneyMigrations } from '../api/nito-money-schema';
import { setupTestDatabase, waitForDatabase, cleanupTestData, insertTestBlock, insertTestPool } from './test-helpers';

const amounts = ['9007199254740991', '9007199254740992', '9007199254740993', '128456588999999999', '128456589000000000'];

describe('Exact Nito monetary persistence', () => {
  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
    for (const query of exactMoneyColumnMigrations) {
      await DB.query(query);
    }
    config.MEMPOOL.BACKEND = 'none';
  }, 120000);
  afterAll(async () => {
    await cleanupTestData();
    await DB.query('DELETE FROM statistics');
    await DB.query('DROP TABLE IF EXISTS qa_money_legacy, qa_money_backup');
  });

  test('round-trips transactions, summaries and compact CPFP fees at JS and Nito bounds', async () => {
    for (const [i, value] of amounts.entries()) {
      const id = i.toString(16).padStart(64, '0');
      const tx: any = { txid: id, fee: value, value, weight: 400, vsize: 100, flags: 0, private_metadata_status: 'transparent' };
      await summaries.$saveTransactions(i, id, [tx], 1);
      expect((await summaries.$getByBlockId(id))!.transactions[0]).toMatchObject({ fee: value, value });
      expect(cpfp.unpack(Buffer.from(cpfp.pack([tx])))[0].fee).toBe(value);
    }
  });

  test('preserves block fields and aggregate totals beyond uint64 without changing count semantics', async () => {
    const poolId = await insertTestPool({ name: 'Exact amounts', slug: 'exact-amounts', addresses: '[]', regexes: '[]' });
    let rewardSum = 0n;
    const turnover = '184467440737095516170';
    for (const [i, value] of amounts.entries()) {
      const hash = (i + 32).toString(16).padStart(64, '0');
      await insertTestBlock({ height: 1000 + i, hash, poolId, tx_count: 3 });
      await DB.query(`UPDATE blocks SET reward=?, fees=?, avg_fee=?, median_fee_amt=?,
        total_output_amt=?, total_input_amt=?, amounts_version=1 WHERE hash=?`,
      [value, value, value, value, turnover, turnover, hash]);
      const block = await blocks.$getBlockByHash(hash);
      expect(block!.extras).toMatchObject({ reward: value, totalFees: value, avgFee: value,
        medianFeeAmt: value, totalOutputAmt: turnover, totalInputAmt: turnover });
      expect(block!.tx_count).toBe(3);
      rewardSum += BigInt(value);
    }
    const stats = await blocks.$getBlockStats(amounts.length);
    expect(stats.totalReward).toBe(rewardSum.toString());
    expect(stats.totalFee).toBe(rewardSum.toString());
    expect(stats.totalTx).toBe(amounts.length * 3);
    expect(stats.blockCount).toBe(amounts.length);
  });

  test('reconstructs legacy block amounts once from Core before exposing shared aggregate totals', async () => {
    const poolId = await insertTestPool({ name: 'Reconstruction', slug: 'reconstruction', addresses: '[]', regexes: '[]' });
    const hash = 'f'.repeat(64);
    await insertTestBlock({ height: 2000, hash, poolId, tx_count: 2 });
    const source = jest.spyOn(bitcoinClient, 'getBlock').mockResolvedValue({ height: 2000, tx: [
      { vout: [{ value: '90071992.54740994' }] },
      { vout: [{ value: '1.00000000' }], has_private_bundle: true,
        private_bundle: { actions: 1, flags: 3, has_auth: true, value_balance: '-0.00000001' } },
    ] } as any);
    const stats = jest.spyOn(bitcoinClient, 'getBlockStats').mockResolvedValue({
      totalfee: '9007199254740993', avgfee: '9007199254740993', medianfee: '9007199254740993',
    } as any);
    config.MEMPOOL.BACKEND = 'electrum';
    try {
      const [first, second] = await Promise.all([blocks.$getBlockStats(1), blocks.$getBlockStats(1)]);
      expect(first).toMatchObject({ blockCount: 1, totalReward: '9007199254740994', totalFee: '9007199254740993' });
      expect(second).toEqual(first);
      const rebuilt = await blocks.$getBlockByHash(hash);
      expect(rebuilt!.extras.totalInputAmt).toBe('9007199354740994');
      const [stored]: any = await DB.query('SELECT amounts_version FROM blocks WHERE hash=?', [hash]);
      expect(stored[0].amounts_version).toBe(1);
      expect(source).toHaveBeenCalledTimes(1);
      expect(stats).toHaveBeenCalledTimes(1);
      const history = await blocks.$getHistoricalBlockFees(60, null);
      const totalRewards = await blocks.$getHistoricalBlockRewards(60, null);
      expect(history).not.toHaveLength(0);
      expect(totalRewards).not.toHaveLength(0);
      expect(typeof history[0].timestamp).toBe('number');
      expect(history[0].USD).toBeNull();
      expect(typeof history[0].avgFees).toBe('string');
      expect(typeof history[0].avgSubsidy).toBe('string');
    } finally {
      config.MEMPOOL.BACKEND = 'none';
      source.mockRestore();
      stats.mockRestore();
    }
  });

  test('statistics retain exact fees and explicitly preserve unavailable legacy totals', async () => {
    for (const value of [...amounts, null]) {
      const id = await statistics.$createZeroedStatistic();
      await DB.query('UPDATE statistics SET total_fee=? WHERE id=?', [value, id]);
      const row = await statistics.$get(id!);
      expect(row!.total_fee).toBe(value);
      expect(row!.total_fee_precision).toBe(value == null ? 'unavailable' : 'exact');
      const restored = statistics.mapOptimizedStatisticToStatistic([row!])[0];
      expect(restored.total_fee).toBe(value);
    }
  });

  test('floors monetary averages exactly when a large sample leaves a tiny fractional remainder', async () => {
    const [rows]: any = await DB.query(`SELECT ${exactAverageSql('fee')} AS exactAverage FROM
      (SELECT CAST(IF(seq = 1, '9007199254740992', '9007199254740993') AS DECIMAL(65,0)) AS fee
      FROM seq_1_to_100001) AS samples`);
    expect(rows[0].exactAverage).toBe('9007199254740992');
  });

  test('copies legacy DOUBLE data, migrates honestly, then restores the original snapshot', async () => {
    await DB.query('CREATE TABLE qa_money_legacy (id INT PRIMARY KEY, total_fee DOUBLE UNSIGNED NOT NULL)');
    await DB.query('INSERT INTO qa_money_legacy VALUES (1, 9007199254740991), (2, 9007199254740993)');
    await DB.query('CREATE TABLE qa_money_backup LIKE qa_money_legacy');
    await DB.query('INSERT INTO qa_money_backup SELECT * FROM qa_money_legacy');
    const [before]: any = await DB.query('SELECT id, CAST(total_fee AS CHAR) AS stored FROM qa_money_backup ORDER BY id');
    for (const query of legacyStatisticsMoneyMigrations) {
      await DB.query(query.replace(/\bstatistics\b/g, 'qa_money_legacy'));
    }
    const [migrated]: any = await DB.query('SELECT * FROM qa_money_legacy ORDER BY id');
    expect(migrated[0].total_fee).toBe('9007199254740991');
    expect(migrated[1].total_fee).toBeNull();
    await DB.query('DROP TABLE qa_money_legacy');
    await DB.query('RENAME TABLE qa_money_backup TO qa_money_legacy');
    const [restored]: any = await DB.query('SELECT id, CAST(total_fee AS CHAR) AS stored FROM qa_money_legacy ORDER BY id');
    expect(restored).toEqual(before);
  });
});
