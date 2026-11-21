import config from '../../config';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ $getRawTransaction: jest.fn() }));
jest.mock('../../api/redis-cache', () => ({}));
jest.mock('../../api/common', () => ({ Common: {
  stripTransaction: tx => ({ ...tx, value: '0', vsize: tx.vsize ?? 100 }),
} }));

describe('Restored Nito replacement confirmation', () => {
  let cache: any;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    config.MEMPOOL.BACKEND = 'electrum';
    jest.isolateModules(() => { cache = jest.requireActual('../../api/rbf-cache').default; });
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  test('normalizes Core transactions before marking the replacement tree mined', async () => {
    const old = { txid: 'old', fee: '9007199254740992', vin: [{ sequence: 0 }], vout: [] };
    const replacement = { txid: 'new', fee: '9007199254740993', vin: [{ sequence: 0 }], vout: [] };
    cache.add([old], replacement);
    (bitcoinApi.$getRawTransaction as jest.Mock).mockImplementation(async (txid, skipConversion) => {
      if (txid === 'old') { throw new Error('No such mempool or blockchain transaction'); }
      return skipConversion ? { txid, confirmations: 1 }
        : { txid, fee: replacement.fee, status: { confirmed: true, block_height: 101, block_hash: 'block' } };
    });

    await cache.checkTrees();

    expect(bitcoinApi.$getRawTransaction).toHaveBeenCalledWith('new', false, false);
    expect(cache.getRbfTree('new').mined).toBe(true);
    expect(cache.getRbfTree('new').tx.mined).toBe(true);
    expect(cache.getLatestRbfSummary()[0]).toMatchObject({
      mined: true, oldFee: '9007199254740992', newFee: '9007199254740993',
    });
  });

  test('uses Core policy sizes for Orchard replacement fee rates', () => {
    const original = { txid: 'old', fee: '7000', vin: [], vout: [], vsize: 2400, has_private_bundle: true, policy_vsize: 7000 };
    const replacement = { ...original, txid: 'new', fee: '14002', policy_vsize: 7001 };
    cache.add([original], replacement);
    expect(cache.getLatestRbfSummary()[0]).toMatchObject({ oldFee: '7000', oldVsize: 7000, newFee: '14002', newVsize: 7001 });
  });

  test('retains unknown private policy size and unknown cumulative fee explicitly', () => {
    const original = { txid: 'old', fee: '-1', vin: [], vout: [], vsize: 2400, has_private_bundle: true };
    const transparent = { txid: 'transparent', fee: '1000', vin: [], vout: [], vsize: 100 };
    const replacement = { ...original, txid: 'new', fee: '2000' };
    cache.add([original, transparent], replacement);
    expect(cache.getLatestRbfSummary()[0]).toMatchObject({ oldFee: '-1', oldVsize: -1, newFee: '2000', newVsize: -1 });
  });
});
