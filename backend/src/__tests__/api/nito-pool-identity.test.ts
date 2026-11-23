import { poolDisplayNames } from '../../api/mining/pool-display-names';

describe('trusted Nito pool identities', () => {
  const payoutAddress = '168h2xMi1YeZAE4p13BorJwFA5xSM8X2AN';
  const shortenedAddress = '168h2xMi...X2AN';
  let blocks: any;
  let poolsRepository: any;

  const hex = (value: string): string => Buffer.from(value, 'ascii').toString('hex');
  const coinbase = (label: string): any => ({
    vin: [{ scriptsig: hex(label) }],
    vout: [{
      scriptpubkey_address: payoutAddress,
      scriptpubkey_type: 'p2pkh',
      value: '100000000',
    }],
  });

  beforeEach(() => {
    jest.resetModules();
    for (const path of [
      '../../api/disk-cache', '../../api/bitcoin/bitcoin-client', '../../api/bitcoin/bitcoin-api',
      '../../repositories/BlocksRepository', '../../api/loading-indicators', '../../repositories/HashratesRepository',
      '../../indexer', '../../api/pools-parser', '../../repositories/BlocksSummariesRepository',
      '../../repositories/BlocksAuditsRepository', '../../repositories/CpfpRepository', '../../api/mining/mining',
      '../../repositories/DifficultyAdjustmentsRepository', '../../repositories/PricesRepository', '../../tasks/price-updater',
      '../../api/chain-tips', '../../api/websocket-handler', '../../api/redis-cache', '../../api/rbf-cache',
      '../../api/difficulty-adjustment', '../../repositories/AccelerationRepository', '../../api/cpfp', '../../database',
    ]) {
      jest.doMock(path, () => ({ __esModule: true, default: {} }));
    }
    poolsRepository = {
      $getPoolByAddress: jest.fn().mockResolvedValue(null),
      $autoRegisterPool: jest.fn(async (name, slug, addresses, marker) => ({
        id: 100, uniqueId: 100, name, slug, addresses: JSON.stringify(addresses),
        regexes: JSON.stringify(marker ? [marker] : []), link: '',
      })),
      $updatePoolNameIfNewer: jest.fn().mockResolvedValue(true),
      $getPools: jest.fn().mockResolvedValue([]),
      $getUnknownPool: jest.fn().mockResolvedValue({ id: 0, name: 'Unknown', slug: 'unknown' }),
    };
    jest.doMock('../../repositories/PoolsRepository', () => ({ __esModule: true, default: poolsRepository }));
    jest.doMock('../../config', () => ({
      __esModule: true,
      default: { DATABASE: { ENABLED: true }, MEMPOOL: { BACKEND: 'electrum' } },
    }));
    jest.doMock('../../logger', () => ({
      __esModule: true,
      default: { debug: jest.fn(), err: jest.fn(), info: jest.fn(), warn: jest.fn() },
    }));
    jest.doMock('../../api/common', () => ({ Common: { isLiquid: () => false } }));
    jest.doMock('../../api/mempool', () => ({ __esModule: true, default: { getMempool: () => ({}) } }));
    jest.doMock('../../api/bitcoin/bitcoin-api-factory', () => ({
      __esModule: true, default: {}, bitcoinCoreApi: {},
    }));

    blocks = require('../../api/blocks').default;
  });

  test.each([
    ['NitroPool', 'NitroPool'],
    ['zpool', 'zpool'],
    ['mined by eu.stratum.nitopool.online worker 7', 'eu.stratum.nitopool.online'],
  ])('accepts the trusted identity %s', (label, expected) => {
    expect(blocks.$extractCoinbaseText(hex(label))).toBe(expected);
  });

  test.each([
    'You are a Butthole. Sir.',
    'Epstein',
    'Mined by a completely arbitrary miner',
  ])('rejects arbitrary coinbase prose: %s', (label) => {
    expect(blocks.$extractCoinbaseText(hex(label))).toBeNull();
  });

  test('persists a shortened payout address instead of arbitrary coinbase prose', async () => {
    const pool = await blocks.$findBlockMiner(coinbase('You are a Butthole. Sir.'), 1111000);

    expect(poolsRepository.$autoRegisterPool).toHaveBeenCalledWith(
      shortenedAddress,
      'addr_xsm8x2an',
      [payoutAddress],
      '',
    );
    expect(pool.name).toBe(shortenedAddress);
  });

  test('repairs an older dynamic pool name derived from arbitrary prose', async () => {
    poolsRepository.$getPoolByAddress.mockResolvedValueOnce({
      id: 42,
      uniqueId: 42,
      name: 'You are a Butthole. Sir.',
      slug: 'you-are-a-butthole-sir_xsm8x2an',
      addresses: JSON.stringify([payoutAddress]),
      regexes: JSON.stringify(['You are a Butthole. Sir.']),
      link: '',
    });

    const pool = await blocks.$findBlockMiner(coinbase('You are a Butthole. Sir.'), 1111001);

    expect(poolsRepository.$updatePoolNameIfNewer).toHaveBeenCalledWith(42, shortenedAddress, 1111001);
    expect(pool.name).toBe(shortenedAddress);
  });

  test('does not let a coinbase domain rename a curated pool', async () => {
    poolsRepository.$getPoolByAddress.mockResolvedValueOnce({
      id: 15,
      uniqueId: 15,
      name: 'NitroPool',
      slug: 'nitropool',
      addresses: JSON.stringify([payoutAddress]),
      regexes: JSON.stringify(['NitroPool']),
      link: 'https://nitropool.example',
    });

    const pool = await blocks.$findBlockMiner(coinbase('attacker.example'), 1111002);

    expect(poolsRepository.$updatePoolNameIfNewer).not.toHaveBeenCalled();
    expect(pool.name).toBe('NitroPool');
  });

  test('keeps distinct active identities for miners using the same software marker', () => {
    const name = 'Mined with RMT Node on Umbrel';
    const labels = poolDisplayNames([
      { poolId: 7, name, slug: 'umbrel_aaaaaa01' },
      { poolId: 8, name, slug: 'umbrel_aaaaaa02' },
      { poolId: 9, name: 'Other Pool', slug: 'other-pool' },
    ]);
    expect([...labels]).toEqual([
      [7, `…aaaaaa01 · ${name}`],
      [8, `…aaaaaa02 · ${name}`],
      [9, 'Other Pool'],
    ]);
  });

  test('does not register a payout identity from an orphan', async () => {
    const pool = await blocks.$findBlockMiner(coinbase('Mined with RMT Node on Umbrel'), 1111003, false);
    expect(pool.slug).toBe('unknown');
    expect(poolsRepository.$autoRegisterPool).not.toHaveBeenCalled();
  });
});
