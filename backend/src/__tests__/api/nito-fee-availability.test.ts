import feeApi from '../../api/fee-api';
import config from '../../config';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';

jest.mock('../../api/bitcoin/bitcoin-client', () => ({ getMempoolInfo: jest.fn(), estimateSmartFee: jest.fn() }));
jest.mock('../../api/mempool', () => ({}));
jest.mock('../../api/mempool-blocks', () => ({}));

const settle = () => new Promise(resolve => setImmediate(resolve));

describe('Nito recommendation availability', () => {
  beforeEach(() => {
    config.MEMPOOL.BACKEND = 'electrum';
    jest.clearAllMocks();
    feeApi.invalidate();
    bitcoinClient.getMempoolInfo.mockResolvedValue({ mempoolminfee: 0.00001 });
    bitcoinClient.estimateSmartFee.mockResolvedValue({ feerate: 0.00002 });
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
    complete({ mempoolminfee: 0.00001 });
    await settle();
    // This read starts a fresh request and cannot expose the invalidated one.
    expect(feeApi.getRecommendedFee()).toBeNull();
    await settle();
    expect(feeApi.getRecommendedFee()?.fastestFee).toBe(2);
  });
});
