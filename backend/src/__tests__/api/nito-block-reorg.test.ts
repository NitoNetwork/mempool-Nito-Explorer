describe('Core canonical branch polling', () => {
  let blocks: any;
  let core: any;
  let database: any;
  let websocket: any;
  let cache: any;
  let chain: Map<number, any>;
  let tip: number;
  let indexing: boolean;
  const block = (height: number, id: string, parent: string) => ({
    height, id, previousblockhash: parent, timestamp: 1000 + height, bits: 0x207fffff, difficulty: 1,
    extras: { pool: { id: 1 } }, tx: [{ txid: `coinbase-${id}`, fee: '0' }, { txid: `tracked-${id}`, fee: '1' }],
  });

  beforeEach(() => {
    jest.resetModules(); indexing = false; tip = 110;
    chain = new Map([108, 109, 110].map(height => [height, block(height, `canonical-${height}`, `canonical-${height - 1}`)]));
    for (const path of [
      '../../repositories/PoolsRepository', '../../api/loading-indicators', '../../api/pools-parser',
      '../../repositories/BlocksSummariesRepository', '../../repositories/BlocksAuditsRepository', '../../api/mining/mining',
      '../../api/redis-cache', '../../api/rbf-cache', '../../database', '../../api/transaction-utils',
    ]) { jest.doMock(path, () => ({ __esModule: true, default: {} })); }
    jest.doMock('../../config', () => ({ __esModule: true, default: {
      MEMPOOL: { BACKEND: 'electrum', NETWORK: 'regtest', INITIAL_BLOCKS_AMOUNT: 8, CACHE_ENABLED: false, CPFP_INDEXING: false },
      REDIS: { ENABLED: false },
    } }));
    jest.doMock('../../logger', () => ({ __esModule: true, default: { debug: jest.fn(), warn: jest.fn(), info: jest.fn(), tags: {} } }));
    jest.doMock('../../api/common', () => ({ Common: { isLiquid: () => false, indexingEnabled: () => indexing, blocksSummariesIndexingEnabled: () => false } }));
    jest.doMock('../../api/mempool', () => ({ __esModule: true, default: { getAccelerations: () => ({}) } }));
    cache = { lock: jest.fn(), unlock: jest.fn() };
    jest.doMock('../../api/disk-cache', () => ({ __esModule: true, default: cache }));
    core = {
      $getBlockHeightTip: jest.fn(async () => tip),
      $getBlockHash: jest.fn(async height => chain.get(height)?.id),
    };
    jest.doMock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: core, bitcoinCoreApi: core }));
    jest.doMock('../../api/bitcoin/bitcoin-client', () => ({ __esModule: true, default: {
      getBlock: async hash => Array.from(chain.values()).find(entry => entry.id === hash),
    } }));
    jest.doMock('../../api/bitcoin/bitcoin-api', () => ({ __esModule: true, default: { convertBlock: value => value } }));
    database = { $invalidateCanonicalBlocksAboveHeight: jest.fn(async () => undefined), $saveBlockInDatabase: jest.fn(async () => undefined) };
    jest.doMock('../../repositories/BlocksRepository', () => ({ __esModule: true, default: database }));
    jest.doMock('../../repositories/HashratesRepository', () => ({ __esModule: true, default: { $deleteHashratesFromTimestamp: jest.fn(async () => undefined) } }));
    jest.doMock('../../repositories/DifficultyAdjustmentsRepository', () => ({ __esModule: true, default: {
      $deleteAdjustementsFromHeight: jest.fn(async () => undefined), $saveAdjustments: jest.fn(async () => undefined),
    } }));
    jest.doMock('../../repositories/CpfpRepository', () => ({ __esModule: true, default: { $deleteClustersFrom: jest.fn(async () => undefined) } }));
    jest.doMock('../../repositories/AccelerationRepository', () => ({ __esModule: true, default: { $deleteAccelerationsFrom: jest.fn(async () => undefined) } }));
    jest.doMock('../../repositories/PricesRepository', () => ({ __esModule: true, default: { $getLatestPriceId: async () => null } }));
    jest.doMock('../../tasks/price-updater', () => ({ __esModule: true, default: { historyInserted: false } }));
    jest.doMock('../../indexer', () => ({ __esModule: true, default: { reindex: jest.fn(), scheduleSingleTask: jest.fn() } }));
    jest.doMock('../../api/chain-tips', () => ({ __esModule: true, default: { clearOrphanCacheAboveHeight: jest.fn(), updateOrphanedBlocks: async () => undefined } }));
    websocket = { handleReorg: jest.fn() };
    jest.doMock('../../api/websocket-handler', () => ({ __esModule: true, default: websocket }));
    jest.doMock('../../api/difficulty-adjustment', () => ({ calcBitsDifference: () => 0 }));
    jest.doMock('../../api/cpfp', () => ({ calculateGoodBlockCpfp: (_height, transactions) => ({ transactions }) }));
    blocks = require('../../api/blocks').default;
    blocks.currentBlockHeight = 110;
    blocks.lastDifficultyAdjustmentTime = 1110;
    blocks.currentBits = 0x207fffff;
    blocks.setBlocks([chain.get(108), chain.get(109), block(110, 'old-110', 'canonical-109')]);
    blocks.setBlockSummaries(blocks.getBlocks().map(entry => ({ id: entry.id, transactions: [] })));
    jest.spyOn(blocks, 'updateQuarterEpochBlockTime').mockResolvedValue(undefined);
    jest.spyOn(blocks, '$getTransactionsExtended').mockImplementation(async hash => Array.from(chain.values()).find(entry => entry.id === hash).tx);
    jest.spyOn(blocks, '$getBlockExtended').mockImplementation(async value => value);
    jest.spyOn(blocks, 'summarizeBlockTransactions').mockImplementation((id, _height, txs) => ({ id, transactions: txs }));
    jest.spyOn(blocks, '$handleReorgs').mockResolvedValue(undefined);
  });

  test.each([false, true])('replays a same-height replacement and its transaction callback (SQL=%s)', async sql => {
    indexing = sql;
    const confirmed = jest.fn(async () => undefined);
    blocks.setNewAsyncBlockCallback(confirmed);
    expect(await blocks.$updateBlocks()).toBe(1);
    expect(blocks.getBlocks().map(entry => entry.id)).toEqual(['canonical-108', 'canonical-109', 'canonical-110']);
    expect(blocks.getBlockSummaries().map(entry => entry.id)).not.toContain('old-110');
    expect(websocket.handleReorg).toHaveBeenCalledTimes(1);
    expect(confirmed).toHaveBeenCalledWith(chain.get(110), ['coinbase-canonical-110', 'tracked-canonical-110'], chain.get(110).tx);
    expect(cache.unlock).toHaveBeenCalledTimes(1);
    if (sql) {
      expect(database.$invalidateCanonicalBlocksAboveHeight).toHaveBeenCalledWith(109);
      expect(database.$saveBlockInDatabase).toHaveBeenCalledWith(chain.get(110));
    } else { expect(database.$invalidateCanonicalBlocksAboveHeight).not.toHaveBeenCalled(); }
  });

  test('walks back to the common ancestor and replays every replacement in order', async () => {
    blocks.setBlocks([chain.get(108), block(109, 'old-109', 'canonical-108'), block(110, 'old-110', 'old-109')]);
    const observed: string[] = [];
    blocks.setNewAsyncBlockCallback(async entry => { observed.push(entry.id); });
    expect(await blocks.$updateBlocks()).toBe(2);
    expect(observed).toEqual(['canonical-109', 'canonical-110']);
    expect(blocks.getBlocks().map(entry => entry.id)).toEqual(['canonical-108', 'canonical-109', 'canonical-110']);
  });

  test('handles a lower tip even when no new block is connected', async () => {
    indexing = true; tip = 109;
    const confirmed = jest.fn(async () => undefined);
    blocks.setNewAsyncBlockCallback(confirmed);
    expect(await blocks.$updateBlocks()).toBe(0);
    expect(blocks.getCurrentBlockHeight()).toBe(109);
    expect(blocks.getBlocks().map(entry => entry.id)).toEqual(['canonical-108', 'canonical-109']);
    expect(database.$invalidateCanonicalBlocksAboveHeight).toHaveBeenCalledWith(109);
    expect(websocket.handleReorg).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
  });

  test('does not replay an unchanged canonical tip', async () => {
    blocks.setBlocks(Array.from(chain.values()));
    expect(await blocks.$updateBlocks()).toBe(0);
    expect(core.$getBlockHash).toHaveBeenCalledWith(110);
    expect(websocket.handleReorg).not.toHaveBeenCalled();
    expect(blocks.$getTransactionsExtended).not.toHaveBeenCalled();
  });

  test('replays every block when the common ancestor is genesis', async () => {
    tip = 3;
    chain = new Map([0, 1, 2, 3].map(height => [height, block(height, `canonical-${height}`, `canonical-${height - 1}`)]));
    blocks.currentBlockHeight = 3;
    blocks.setBlocks([chain.get(0), block(1, 'old-1', 'canonical-0'), block(2, 'old-2', 'old-1'), block(3, 'old-3', 'old-2')]);
    const observed: number[] = [];
    blocks.setNewAsyncBlockCallback(async entry => { observed.push(entry.height); });
    expect(await blocks.$updateBlocks()).toBe(3);
    expect(observed).toEqual([1, 2, 3]);
  });
});
