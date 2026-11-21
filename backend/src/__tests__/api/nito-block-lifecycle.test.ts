describe('Nito confirmed block lifecycle', () => {
  let blocks: any;
  let api: any;

  beforeEach(() => {
    jest.resetModules();
    for (const path of [
      '../../api/disk-cache', '../../api/bitcoin/bitcoin-client', '../../api/bitcoin/bitcoin-api',
      '../../repositories/PoolsRepository', '../../repositories/BlocksRepository', '../../api/loading-indicators',
      '../../repositories/HashratesRepository', '../../indexer', '../../api/pools-parser',
      '../../repositories/BlocksSummariesRepository', '../../repositories/BlocksAuditsRepository',
      '../../repositories/CpfpRepository', '../../api/mining/mining', '../../repositories/DifficultyAdjustmentsRepository',
      '../../repositories/PricesRepository', '../../tasks/price-updater', '../../api/chain-tips',
      '../../api/websocket-handler', '../../api/redis-cache', '../../api/rbf-cache', '../../api/difficulty-adjustment',
      '../../repositories/AccelerationRepository', '../../api/cpfp', '../../database',
    ]) {
      jest.doMock(path, () => ({ __esModule: true, default: {} }));
    }
    jest.doMock('../../config', () => ({ __esModule: true, default: { MEMPOOL: { BACKEND: 'electrum' } } }));
    jest.doMock('../../logger', () => ({ __esModule: true, default: { debug: jest.fn(), err: jest.fn() } }));
    jest.doMock('../../api/common', () => ({ Common: { isLiquid: () => false } }));
    jest.doMock('../../api/mempool', () => ({ __esModule: true, default: { getMempool: () => ({}) } }));
    api = { $getTxsForBlock: jest.fn(), $getRawTransaction: jest.fn() };
    jest.doMock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: api, bitcoinCoreApi: {} }));
    blocks = require('../../api/blocks').default;
  });

  test('bulk block indexing retains confirmed Orchard without falling back to individual RPCs', async () => {
    const common = { version: 2, locktime: 0, weight: 9600, vin: [], vout: [], status: { confirmed: true } };
    api.$getTxsForBlock.mockResolvedValue([
      { ...common, txid: 'aa'.repeat(32), fee: '0', vin: [{ is_coinbase: true, scriptsig_asm: '' }] },
      { ...common, txid: 'bb'.repeat(32), has_private_bundle: true, private_metadata_status: 'complete', fee: '9007199254740993' },
    ]);
    const result = await blocks.$getTransactionsExtended('blockhash', 100, 123, false,
      ['aa'.repeat(32), 'bb'.repeat(32)], true, true);
    expect(result).toHaveLength(2);
    expect(result[1].fee).toBe('9007199254740993');
    expect(result[1].feePerVsize).toBe(-1);
    expect(result[1].effectiveFeePerVsize).toBe(-1);
    expect(api.$getRawTransaction).not.toHaveBeenCalled();
  });

  test('callback rejection is observed immediately while other block work is pending', async () => {
    const failure = new Error('RBF callback failed');
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      blocks.setNewAsyncBlockCallback(async () => { throw failure; });
      const pending = blocks.startAsyncBlockCallbacks({}, [], []);
      await new Promise(resolve => setImmediate(resolve));
      expect(unhandled).not.toHaveBeenCalled();
      expect(await pending).toEqual([{ status: 'rejected', reason: failure }]);
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  test('a synchronous callback throw is collected and remaining callbacks still execute', async () => {
    const failure = new Error('synchronous callback failed');
    const later = jest.fn(async () => undefined);
    blocks.setNewAsyncBlockCallback(() => { throw failure; });
    blocks.setNewAsyncBlockCallback(later);
    expect(await blocks.startAsyncBlockCallbacks({}, ['txid'], [])).toEqual([
      { status: 'rejected', reason: failure }, { status: 'fulfilled', value: undefined },
    ]);
    expect(later).toHaveBeenCalledWith({}, ['txid'], []);
  });
});
