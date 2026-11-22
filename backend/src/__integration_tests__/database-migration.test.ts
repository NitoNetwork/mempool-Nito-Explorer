import DB from '../database';
import { setupTestDatabase, waitForDatabase } from './test-helpers';
import databaseMigration from '../api/database-migration';

describe('Database Migration Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
  }, 120000);

  test('should create state table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'state'`
    );
    expect(result[0].count).toBe('1');
  });

  test('should have schema version in state table', async () => {
    const [result] = await DB.query<any>('SELECT number FROM state WHERE name = \'schema_version\'');
    expect(result).toHaveLength(1);
    expect(result[0].number).toBeGreaterThan(0);
  });

  test('should create blocks table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'blocks'`
    );
    expect(result[0].count).toBe('1');
  });

  test('should create pools table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'pools'`
    );
    expect(result[0].count).toBe('1');
  });

  test('should create hashrates table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'hashrates'`
    );
    expect(result[0].count).toBe('1');
  });

  test('should create prices table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'prices'`
    );
    expect(result[0].count).toBe('1');
  });

  test('blocks table should have required columns', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = 'mempool_test' 
       AND TABLE_NAME = 'blocks'`
    );

    const columnNames = columns.map((col: any) => col.COLUMN_NAME);
    expect(columnNames).toContain('height');
    expect(columnNames).toContain('hash');
    expect(columnNames).toContain('blockTimestamp');
    expect(columnNames).toContain('size');
    expect(columnNames).toContain('weight');
    expect(columnNames).toContain('tx_count');
  });

  test('pools table should have required columns', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = 'mempool_test' 
       AND TABLE_NAME = 'pools'`
    );

    const columnNames = columns.map((col: any) => col.COLUMN_NAME);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('slug');
  });

  test('clean install creates exact address cache tables', async () => {
    const [tables] = await DB.query<any>(
      `SELECT TABLE_NAME FROM information_schema.tables
       WHERE table_schema = 'mempool_test'
       AND TABLE_NAME IN ('address_stats_cache', 'address_history_cursors')`
    );
    expect(tables.map((row: any) => row.TABLE_NAME).sort()).toEqual([
      'address_history_cursors', 'address_stats_cache',
    ]);

    const [columns] = await DB.query<any>(
      `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = 'mempool_test'
       AND TABLE_NAME IN ('address_stats_cache', 'address_history_cursors')`
    );
    const names = new Set(columns.map((row: any) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));
    for (const name of ['scripthash', 'fingerprint', 'tip_hash', 'tip_height', 'chain_stats', 'mempool_stats', 'updated_at']) {
      expect(names).toContain(`address_stats_cache.${name}`);
    }
    for (const name of ['scripthash', 'txid', 'tx_num', 'tip_hash', 'tip_height', 'updated_at']) {
      expect(names).toContain(`address_history_cursors.${name}`);
    }
  });

  test('migrates an isolated schema 110 copy to additive schema 112', async () => {
    await DB.query('DROP TABLE IF EXISTS address_history_cursors');
    await DB.query('DROP TABLE IF EXISTS address_stats_cache');
    await DB.query(`UPDATE state SET number = 110 WHERE name = 'schema_version'`);

    await databaseMigration.$initializeOrMigrateDatabase();

    const [version] = await DB.query<any>(`SELECT number FROM state WHERE name = 'schema_version'`);
    expect(Number(version[0].number)).toBe(112);
    const [tables] = await DB.query<any>(
      `SELECT TABLE_NAME FROM information_schema.tables
       WHERE table_schema = 'mempool_test'
       AND TABLE_NAME IN ('address_stats_cache', 'address_history_cursors')`
    );
    expect(tables).toHaveLength(2);
  }, 120000);

  test('migrates an existing schema 111 cache to schema 112', async () => {
    await DB.query('DROP TABLE IF EXISTS address_history_cursors');
    await DB.query('ALTER TABLE address_stats_cache DROP COLUMN IF EXISTS tip_hash');
    await DB.query('ALTER TABLE address_stats_cache DROP COLUMN IF EXISTS tip_height');
    await DB.query(`UPDATE state SET number = 111 WHERE name = 'schema_version'`);

    await databaseMigration.$initializeOrMigrateDatabase();

    const [version] = await DB.query<any>(`SELECT number FROM state WHERE name = 'schema_version'`);
    expect(Number(version[0].number)).toBe(112);
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = 'mempool_test' AND table_name = 'address_stats_cache'
       AND COLUMN_NAME IN ('tip_hash', 'tip_height')`
    );
    expect(columns).toHaveLength(2);
    const [cursorTable] = await DB.query<any>(
      `SELECT TABLE_NAME FROM information_schema.tables
       WHERE table_schema = 'mempool_test' AND TABLE_NAME = 'address_history_cursors'`
    );
    expect(cursorTable).toHaveLength(1);
  }, 120000);
});

