import DB from '../database';
import config from '../config';
import blocks from '../repositories/BlocksRepository';
import { setupTestDatabase, waitForDatabase, cleanupTestData, insertTestBlock, insertTestPool } from './test-helpers';

describe('Canonical SQL accounting after a missed branch replacement', () => {
  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
    await cleanupTestData();
    config.MEMPOOL.BACKEND = 'none';
  }, 120000);

  afterAll(async () => { await cleanupTestData(); });

  test('removes a disconnected suffix, counts only the replacement, and restores exact original totals', async () => {
    const poolId = await insertTestPool({ name: 'Canonical QA', slug: 'canonical-qa', addresses: '[]', regexes: '[]' });
    const base = '1'.repeat(64), old109 = '2'.repeat(64), old110 = '3'.repeat(64);
    const next109 = '4'.repeat(64), next110 = '5'.repeat(64);
    const put = async (height: number, hash: string, reward: string, fees: string, txCount: number) => {
      await insertTestBlock({ height, hash, poolId, tx_count: txCount });
      await DB.query('UPDATE blocks SET reward=?, fees=?, amounts_version=1 WHERE hash=?', [reward, fees, hash]);
    };
    await put(108, base, '9007199254740993', '0', 1);
    await put(109, old109, '100', '1', 2);
    await put(110, old110, '200', '2', 2);
    const [original]: any = await DB.query('SELECT * FROM blocks ORDER BY height');
    const originalTotals = await blocks.$getBlockStats(10);
    expect(originalTotals).toMatchObject({ blockCount: 3, totalReward: '9007199254741293', totalFee: '3', totalTx: 5 });

    await blocks.$invalidateCanonicalBlocksAboveHeight(108);
    expect(await blocks.$getBlockStats(10)).toMatchObject({ blockCount: 1, startBlock: 108, endBlock: 108, totalReward: '9007199254740993' });
    expect(await blocks.$getBlockByHeight(110)).toBeNull();

    // A genuinely new hash inserts normally, without an ER_DUP_ENTRY fallback.
    await put(109, next109, '128456589000000000', '3', 3);
    expect(await blocks.$getBlockStats(10)).toMatchObject({ blockCount: 2, endBlock: 109, totalReward: '137463788254740993' });
    expect(await blocks.$getBlockByHeight(110)).toBeNull();
    await put(110, next110, '9007199254740995', '4', 4);
    expect(await blocks.$getBlockStats(10)).toMatchObject({ blockCount: 3, totalReward: '146470987509481988', totalFee: '7', totalTx: 8 });
    const [duplicateCanonical]: any = await DB.query('SELECT height FROM blocks WHERE stale=0 GROUP BY height HAVING COUNT(*)>1');
    expect(duplicateCanonical).toEqual([]);

    await blocks.$invalidateCanonicalBlocksAboveHeight(108);
    await blocks.$setCanonicalBlockAtHeight(old109, 109);
    await blocks.$setCanonicalBlockAtHeight(old110, 110);
    expect(await blocks.$getBlockStats(10)).toEqual(originalTotals);
    const [restored]: any = await DB.query('SELECT * FROM blocks WHERE stale=0 ORDER BY height');
    expect(restored).toEqual(original);
    const [retained]: any = await DB.query('SELECT COUNT(*) AS count FROM blocks');
    expect(retained[0].count).toBe('5');
  });
});
