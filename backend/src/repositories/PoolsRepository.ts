import { Common } from '../api/common';
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import logger from '../logger';
import { PoolInfo, PoolTag } from '../mempool.interfaces';

class PoolsRepository {
  /**
   * Get all pools tagging info
   * @asyncUnsafe
   */
  public async $getPools(): Promise<PoolTag[]> {
    const [rows] = await DB.query('SELECT id, unique_id as uniqueId, name, addresses, regexes, slug FROM pools');
    return <PoolTag[]>rows;
  }

  /**
   * Get unknown pool tagging info
   * @asyncUnsafe
   */
  public async $getUnknownPool(): Promise<PoolTag> {
    let [rows]: any[] = await DB.query('SELECT id, unique_id as uniqueId, name, slug FROM pools where name = "Unknown"');
    if (rows && rows.length === 0 && config.DATABASE.ENABLED) {
      await poolsParser.$insertUnknownPool();
      [rows] = await DB.query('SELECT id, unique_id as uniqueId, name, slug FROM pools where name = "Unknown"');
    }
    return <PoolTag>rows[0];
  }

  /**
   * Get basic pool info and block count
   * @asyncSafe
   */
  public async $getPoolsInfo(interval: string | null = null): Promise<PoolInfo[]> {
    interval = Common.getSqlInterval(interval);

    let query = `
      SELECT
        CAST(COUNT(blocks.height) AS DOUBLE) As blockCount,
          pool_id AS poolId,
          pools.name AS name,
          pools.link AS link,
          slug,
          AVG(blocks_audits.match_rate) AS avgMatchRate,
          CAST(AVG((CAST(blocks.fees as DECIMAL(65,0)) - CAST(blocks_audits.expected_fees as DECIMAL(65,0))) / NULLIF(blocks_audits.expected_fees, 0)) AS DOUBLE) AS avgFeeDelta,
          unique_id as poolUniqueId,
          MAX(blocks.height) as lastBlockHeight
      FROM blocks
      JOIN pools on pools.id = pool_id
      LEFT JOIN blocks_audits ON blocks_audits.height = blocks.height
      WHERE blocks.stale = 0
    `;

    if (interval) {
      query += ` AND blocks.blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` GROUP BY pool_id
      ORDER BY COUNT(blocks.height) DESC, pool_id`;

    try {
      const [rows] = await DB.query(query);
      return <PoolInfo[]>rows;
    } catch (e) {
      logger.err(`Cannot generate pools stats. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get basic pool info and block count between two timestamp
   * @asyncSafe
   */
  public async $getPoolsInfoBetween(from: number, to: number): Promise<PoolInfo[]> {
    const query = `SELECT CAST(COUNT(height) AS DOUBLE) as blockCount, pools.id as poolId, pools.name as poolName
      FROM pools
      LEFT JOIN blocks on pools.id = blocks.pool_id AND blocks.blockTimestamp BETWEEN FROM_UNIXTIME(?) AND FROM_UNIXTIME(?)
      WHERE blocks.stale = 0
      GROUP BY pools.id`;

    try {
      const [rows] = await DB.query(query, [from, to]);
      return <PoolInfo[]>rows;
    } catch (e) {
      logger.err('Cannot generate pools blocks count. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get a mining pool info
   * @asyncSafe
   */
  public async $getPool(slug: string, parse: boolean = true): Promise<PoolTag | null> {
    const query = `
      SELECT *
      FROM pools
      WHERE pools.slug = ?`;

    try {
      let [rows]: any[] = await DB.query(query, [slug]);

      // Fallback: try prefix match for slugs with address suffixes (e.g. "miningcore" -> "miningcore_ntap2yfr")
      if (rows.length < 1) {
        const prefixQuery = `
          SELECT *
          FROM pools
          WHERE slug LIKE ? ORDER BY slug ASC LIMIT 1`;
        [rows] = await DB.query(prefixQuery, [slug + '\\_%']);
      }

      if (rows.length < 1) {
        return null;
      }

      if (parse) {
        rows[0].regexes = JSON.parse(rows[0].regexes);
      }
      if (['testnet', 'signet', 'testnet4', 'regtest'].includes(config.MEMPOOL.NETWORK)) {
        rows[0].addresses = []; // pools-v2.json only contains mainnet addresses
      } else if (parse) {
        rows[0].addresses = JSON.parse(rows[0].addresses);
      }

      return rows[0];
    } catch (e) {
      logger.err('Cannot get pool from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get a mining pool info by its unique id
   * @asyncSafe
   */
  public async $getPoolByUniqueId(id: number, parse: boolean = true): Promise<PoolTag | null> {
    const query = `
      SELECT *
      FROM pools
      WHERE pools.unique_id = ?`;

    try {
      const [rows]: any[] = await DB.query(query, [id]);

      if (rows.length < 1) {
        return null;
      }

      if (parse) {
        rows[0].regexes = JSON.parse(rows[0].regexes);
      }
      if (['testnet', 'signet', 'testnet4', 'regtest'].includes(config.MEMPOOL.NETWORK)) {
        rows[0].addresses = []; // pools.json only contains mainnet addresses
      } else if (parse) {
        rows[0].addresses = JSON.parse(rows[0].addresses);
      }

      return rows[0];
    } catch (e) {
      logger.err('Cannot get pool from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Insert a new mining pool in the database
   *
   * @param pool
   * @asyncSafe
   */
  public async $insertNewMiningPool(pool: any, slug: string): Promise<void> {
    try {
      await DB.query(`
        INSERT INTO pools
        SET name = ?, link = ?, addresses = ?, regexes = ?, slug = ?, unique_id = ?`,
        [pool.name, pool.link, JSON.stringify(pool.addresses), JSON.stringify(pool.regexes), slug, pool.id]
      );
    } catch (e: any) {
      logger.err(`Cannot insert new mining pool into db. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Rename an existing mining pool
   *
   * @param dbId
   * @param newSlug
   * @param newName
   * @asyncSafe
   */
  public async $renameMiningPool(dbId: number, newSlug: string, newName: string): Promise<void> {

    try {
      await DB.query(`
        UPDATE pools
        SET slug = ?, name = ?
        WHERE id = ?`,
        [newSlug, newName, dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot rename mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Update an exisiting mining pool link
   *
   * @param dbId
   * @param newLink
   * @asyncSafe
   */
  public async $updateMiningPoolLink(dbId: number, newLink: string): Promise<void> {
    try {
      await DB.query(`
        UPDATE pools
        SET link = ?
        WHERE id = ?`,
        [newLink, dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot update link for mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
    }

  }

  /**
   * Update an existing mining pool addresses or coinbase tags
   *
   * @param dbId
   * @param addresses
   * @param regexes
   * @asyncSafe
   */
  public async $updateMiningPoolTags(dbId: number, addresses: string, regexes: string): Promise<void> {
    try {
      await DB.query(`
        UPDATE pools
        SET addresses = ?, regexes = ?
        WHERE id = ?`,
        [JSON.stringify(addresses), JSON.stringify(regexes), dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot update mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Get a pool by its slug (for auto-registration lookup)
   * @asyncSafe
   */
  public async $getPoolBySlug(slug: string): Promise<PoolTag | null> {
    try {
      const [rows]: any[] = await DB.query('SELECT id, unique_id as uniqueId, name, link, addresses, regexes, slug FROM pools WHERE slug = ?', [slug]);
      if (rows.length === 0) return null;
      return <PoolTag>rows[0];
    } catch (e) {
      logger.err('Cannot get pool by slug. Reason: ' + (e instanceof Error ? e.message : e));
      return null;
    }
  }

  /**
   * Get a pool by its database id.
   * @asyncSafe
   */
  public async $getPoolByDbId(dbId: number): Promise<PoolTag | null> {
    try {
      const [rows]: any[] = await DB.query(
        'SELECT id, unique_id as uniqueId, name, link, addresses, regexes, slug FROM pools WHERE id = ? LIMIT 1',
        [dbId]
      );
      if (rows.length === 0) return null;
      return <PoolTag>rows[0];
    } catch (e) {
      logger.err('Cannot get pool by database id. Reason: ' + (e instanceof Error ? e.message : e));
      return null;
    }
  }

  /**
   * Get a pool by slug prefix (matches exact slug or slug_suffix pattern).
   * Used when the base slug (e.g. "miningcore") should match suffixed slugs
   * like "miningcore_ntap2yfr" in the DB.
   * @asyncSafe
   */
  public async $getPoolBySlugPrefix(baseSlug: string): Promise<PoolTag | null> {
    try {
      const [rows]: any[] = await DB.query(
        'SELECT id, unique_id as uniqueId, name, link, addresses, regexes, slug FROM pools WHERE slug = ? OR slug LIKE ? ORDER BY slug ASC LIMIT 1',
        [baseSlug, baseSlug + '\\_%']
      );
      if (rows.length === 0) return null;
      return <PoolTag>rows[0];
    } catch (e) {
      logger.err('Cannot get pool by slug prefix. Reason: ' + (e instanceof Error ? e.message : e));
      return null;
    }
  }

  /**
   * Auto-register a new pool discovered from coinbase text.
   * Returns the newly created pool, or the existing one if it was created concurrently.
   * @asyncSafe
   */
  public async $autoRegisterPool(name: string, slug: string, coinbaseAddresses: string[], coinbaseText: string): Promise<PoolTag | null> {
    try {
      // Get a unique_id that cannot collide with historical block rows.
      const [maxRows]: any[] = await DB.query(`
        SELECT GREATEST(
          COALESCE((SELECT MAX(unique_id) FROM pools), 0),
          COALESCE((SELECT MAX(pool_id) FROM blocks), 0)
        ) as max_id
      `);
      const maxUniqueId = Number(maxRows[0]?.max_id ?? 0);
      const nextUniqueId = maxUniqueId + 1;

      const addresses = JSON.stringify(coinbaseAddresses || []);
      // Escape the name for use as a regex pattern
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '$&');
      const regexes = JSON.stringify([escapedName]);

      const [result]: any[] = await DB.query(
        'INSERT INTO pools (name, link, addresses, regexes, slug, unique_id) VALUES (?, ?, ?, ?, ?, ?)',
        [name, '', addresses, regexes, slug, nextUniqueId]
      );

      logger.info('Auto-registered new mining pool: ' + name + ' (slug: ' + slug + ', addresses: ' + addresses + ', unique_id: ' + nextUniqueId + ')');

      // Fetch by inserted database id because slugs are not unique in the legacy table.
      return await this.$getPoolByDbId(result.insertId);
    } catch (e: any) {
      // If duplicate slug (race condition), just fetch existing
      if (e.code === 'ER_DUP_ENTRY' || (e.message && e.message.includes('Duplicate'))) {
        return await this.$getPoolBySlug(slug);
      }
      logger.err('Cannot auto-register pool. Reason: ' + (e instanceof Error ? e.message : e));
      return null;
    }
  }

  /**
   * Find a pool by coinbase payout address.
   * Searches the JSON addresses array for a match.
   * @asyncSafe
   */
  public async $getPoolByAddress(address: string): Promise<PoolTag | null> {
    try {
      const [rows]: any[] = await DB.query(
        "SELECT id, unique_id as uniqueId, name, link, addresses, regexes, slug FROM pools WHERE JSON_CONTAINS(addresses, ?, '$') ORDER BY id ASC LIMIT 1",
        [JSON.stringify(address)]
      );
      if (rows.length === 0) return null;
      return <PoolTag>rows[0];
    } catch (e) {
      logger.err('Cannot get pool by address. Reason: ' + (e instanceof Error ? e.message : e));
      return null;
    }
  }

  /**
   * Update pool name and regexes when a miner changes their coinbase label.
   * @asyncSafe
   */
  public async $updatePoolName(dbId: number, newName: string): Promise<void> {
    try {
      const escapedName = newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await DB.query(
        'UPDATE pools SET name = ?, regexes = ? WHERE id = ?',
        [newName, JSON.stringify([escapedName]), dbId]
      );
      logger.info('Updated pool name and regexes: id=' + dbId + ' -> ' + newName);
    } catch (e) {
      logger.err('Cannot update pool name. Reason: ' + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Update pool name only when the indexed block is not older than the
   * newest block already attached to this pool.
   * @asyncSafe
   */
  public async $updatePoolNameIfNewer(dbId: number, newName: string, blockHeight: number): Promise<boolean> {
    try {
      const [rows]: any[] = await DB.query(
        'SELECT COALESCE(MAX(height), -1) as maxHeight FROM blocks WHERE pool_id = ?',
        [dbId]
      );
      const maxHeight = Number(rows[0]?.maxHeight ?? -1);

      if (blockHeight < maxHeight) {
        logger.debug('Skipped pool name update from older block: id=' + dbId + ', height=' + blockHeight + ', currentMax=' + maxHeight);
        return false;
      }

      await this.$updatePoolName(dbId, newName);
      return true;
    } catch (e) {
      logger.err('Cannot update pool name by height. Reason: ' + (e instanceof Error ? e.message : e));
      return false;
    }
  }

}

export default new PoolsRepository();
