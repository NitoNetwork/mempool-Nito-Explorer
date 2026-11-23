import feeApi from '../../api/fee-api';
import config from '../../config';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import mempool from '../../api/mempool';
import projectedBlocks from '../../api/mempool-blocks';

jest.mock('../../api/bitcoin/bitcoin-client', () => ({ getMempoolInfo: jest.fn(), estimateSmartFee: jest.fn() }));
jest.mock('../../api/mempool', () => ({ getMempoolInfo: jest.fn() }));
jest.mock('../../api/mempool-blocks', () => ({ getMempoolBlocks: jest.fn() }));

const settle = () => new Promise(resolve => setImmediate(resolve));

describe('Nito recommendation availability', () => {
  beforeEach(() => {
    config.MEMPOOL.BACKEND = 'electrum';
    config.MEMPOOL.BLOCK_WEIGHT_UNITS = 800_000;
    jest.clearAllMocks();
    feeApi.invalidate();
    bitcoinClient.getMempoolInfo.mockResolvedValue({ mempoolminfee: 0.00001 });
    bitcoinClient.estimateSmartFee.mockResolvedValue({ feerate: 0.00002 });
    jest.mocked(mempool.getMempoolInfo).mockReturnValue({ loaded: true, size: 1,
      mempoolminfee: 0.00001, minrelaytxfee: 0.00001 } as ReturnType<typeof mempool.getMempoolInfo>);
    jest.mocked(projectedBlocks.getMempoolBlocks).mockReturnValue([]);
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

  test('recommends 2 for low priorities only when the qualified template has room', async () => {
    bitcoinClient.estimateSmartFee.mockResolvedValue({ feerate: 0.00005 });
    feeApi.getRecommendedFee();
    await settle();
    expect(feeApi.getRecommendedFee()).toMatchObject({ economyFee: 5, hourFee: 5 });
    jest.mocked(projectedBlocks.getMempoolBlocks).mockReturnValue([{ nTx: 1, blockVSize: 500 } as ReturnType<typeof projectedBlocks.getMempoolBlocks>[number]]);
    expect(feeApi.getRecommendedFee()).toEqual({ economyFee: 2, hourFee: 2, halfHourFee: 5, fastestFee: 5, minimumFee: 1 });
  });
});
