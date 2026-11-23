import feeApi from '../../api/fee-api';
import config from '../../config';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';

jest.mock('../../api/bitcoin/bitcoin-client', () => ({ getMempoolInfo: jest.fn(), estimateSmartFee: jest.fn() }));
jest.mock('../../api/mempool', () => ({}));
jest.mock('../../api/mempool-blocks', () => ({}));

const settle = () => new Promise(resolve => setImmediate(resolve));
const mempoolInfo = { mempoolminfee: 0.00001, minrelaytxfee: 0.00001 };

describe('Nito recommendation availability', () => {
  beforeEach(() => {
    config.MEMPOOL.BACKEND = 'electrum';
    jest.clearAllMocks();
    feeApi.invalidate();
    bitcoinClient.getMempoolInfo.mockResolvedValue(mempoolInfo);
    bitcoinClient.estimateSmartFee.mockImplementation(async target => ({ feerate: 0.00002, blocks: target }));
  });

  test('clears recommendations on upstream failure', async () => {
    expect(feeApi.getRecommendedFee()).toBeNull();
    await settle();
    expect(feeApi.getRecommendedFee()?.fastestFee).toBe(2);
    feeApi.invalidate();
    bitcoinClient.getMempoolInfo.mockRejectedValue(new Error('Core offline'));
    expect(feeApi.getRecommendedFee()).toBeNull();
    await settle();
    expect(feeApi.getRecommendedFee()).toBeNull();
  });

  test('does not restore a successful request started before invalidation', async () => {
    let complete!: (value: unknown) => void;
    bitcoinClient.getMempoolInfo.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    expect(feeApi.getRecommendedFee()).toBeNull();
    feeApi.invalidate();
    complete(mempoolInfo);
    await settle();
    // This read starts a fresh request and cannot expose the invalidated one.
    expect(feeApi.getRecommendedFee()).toBeNull();
    await settle();
    expect(feeApi.getRecommendedFee()?.fastestFee).toBe(2);
  });

  test('preserves identical Core estimates and reports the returned target rather than the requested target', async () => {
    bitcoinClient.estimateSmartFee.mockImplementation(async target => ({ feerate: '0.00005000', blocks: Math.min(target, 80) }));
    feeApi.getRecommendedFee();
    await settle();
    expect(feeApi.getRecommendedFee()).toEqual({
      economyFee: 5, hourFee: 5, halfHourFee: 5, fastestFee: 5, minimumFee: 1,
      targetBlocks: { economyFee: 80, hourFee: 60, halfHourFee: 30, fastestFee: 2 },
    });
    expect(feeApi.getPreciseRecommendedFee()).toEqual(feeApi.getRecommendedFee());
  });

  test('publishes independent Core estimates and the admission floor when some targets are unavailable', async () => {
    bitcoinClient.getMempoolInfo.mockResolvedValue({ ...mempoolInfo, mempoolminfee: '0.00003125' });
    bitcoinClient.estimateSmartFee
      .mockResolvedValueOnce({ feerate: '0.00008025', blocks: 2 })
      .mockResolvedValueOnce({ errors: ['Insufficient data'], blocks: 0 })
      .mockRejectedValueOnce(new Error('RPC timeout'))
      .mockResolvedValueOnce({ feerate: '0.00003200', blocks: 87 });
    feeApi.getRecommendedFee();
    await settle();
    expect(feeApi.getRecommendedFee()).toEqual({
      economyFee: 3.2, hourFee: null, halfHourFee: null, fastestFee: 8.025, minimumFee: 3.125,
      targetBlocks: { economyFee: 87, hourFee: null, halfHourFee: null, fastestFee: 2 },
    });
  });
});
