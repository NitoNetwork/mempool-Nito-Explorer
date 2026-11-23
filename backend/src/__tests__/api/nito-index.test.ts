import ElectrumApi from '../../api/bitcoin/electrum-api';
import config from '../../config';
import { IndexUnavailableError } from '../../api/bitcoin/index-unavailable-error';
import DB from '../../database';
import loadingIndicators from '../../api/loading-indicators';

const txid = (value: number): string => value.toString(16).padStart(64, '0');
const TX = txid(1);
const FUND = txid(2);
const SELF = txid(3);
const NEW = txid(4);
const SEEN = txid(5);
const OLD = txid(6);
let indexSnapshot = { height: 100, hex: 'header' };

const mockIndex = {
  response: jest.fn(),
  subscribe: { emit: jest.fn() },
  initElectrum: jest.fn(async () => undefined),
  request: jest.fn(),
  blockchainScripthash_getBalance: jest.fn(async () => ({ confirmed: '0', unconfirmed: '42' })),
  blockchainScripthash_getHistory: jest.fn(async () => [{ tx_hash: TX, height: 0, fee: 0 }]),
  blockchainScripthash_listunspent: jest.fn(async () => [{ tx_hash: 'tx', tx_pos: 0, height: -1, value: 42 }]),
};

function useDefaultPagedHistory(): void {
  let scan: any[] = [];
  mockIndex.request.mockImplementation(async (method, params = []) => {
    if (method === 'blockchain.headers.subscribe') { return indexSnapshot; }
    if (method !== 'blockchain.nito.scripthash.get_history_page') { throw new Error(`unexpected method ${method}`); }
    const cursor = params[1] as number | null;
    const limit = params[2] as number;
    if (cursor === null) { scan = await mockIndex.blockchainScripthash_getHistory(); }
    const unconfirmed = cursor === null ? scan.filter(entry => entry.height <= 0) : [];
    const confirmed = scan.filter(entry => entry.height > 0)
      .map((entry, index, entries) => ({ ...entry, cursor: entries.length - index }));
    const start = cursor === null ? 0 : confirmed.findIndex(entry => entry.cursor < cursor);
    const offset = start < 0 ? confirmed.length : start;
    const page = confirmed.slice(offset, offset + limit);
    const has_more = offset + page.length < confirmed.length;
    return { confirmed: page, unconfirmed,
      cursor: has_more ? page[page.length - 1].cursor : null, has_more, total: confirmed.length };
  });
}
jest.mock('@mempool/electrum-client', () => jest.fn().mockImplementation(() => mockIndex));
jest.mock('../../api/blocks', () => ({}));
jest.mock('../../api/transaction-utils', () => ({}));
jest.mock('../../api/common', () => ({}));
jest.mock('../../api/loading-indicators', () => ({ setProgress: jest.fn() }));
jest.mock('../../api/memory-cache', () => ({ get: () => null, set: () => {} }));

function rpc() {
  return { getBlockchainInfo: jest.fn(async () => ({ chain: 'regtest', blocks: 100, bestblockhash: 'tip', initialblockdownload: false })),
    getBlockHash: jest.fn(async height => height === 100 ? 'tip' : `block-${height}`),
    getBlockHeader: jest.fn(async () => 'header'), validateAddress: jest.fn(async () => ({ isvalid: true, address: 'nrt1test', scriptPubKey: '00' })) };
}

describe('Electrum index consistency', () => {
  beforeEach(() => {
    config.MEMPOOL.NETWORK = 'regtest'; jest.clearAllMocks();
    config.DATABASE.ENABLED = false;
    indexSnapshot = { height: 100, hex: 'header' };
    mockIndex.request.mockReset(); useDefaultPagedHistory();
    mockIndex.blockchainScripthash_getBalance.mockReset().mockResolvedValue({ confirmed: '0', unconfirmed: '42' });
    mockIndex.blockchainScripthash_getHistory.mockReset().mockResolvedValue([{ tx_hash: TX, height: 0, fee: 0 }]);
    mockIndex.blockchainScripthash_listunspent.mockReset().mockResolvedValue([{ tx_hash: 'tx', tx_pos: 0, height: -1, value: 42 }]);
  });
  afterEach(() => {
    config.DATABASE.ENABLED = false;
    jest.restoreAllMocks();
  });
  test('zero-fee unconfirmed history stays unconfirmed', async () => {
    const api = new ElectrumApi(rpc());
    jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({ vin: [], vout: [{ scriptpubkey: '00', value: '42' }] } as any);
    const address = await api.$getAddress('nrt1test');
    expect(mockIndex.request).toHaveBeenCalledWith('blockchain.headers.subscribe', []);
    expect(address.chain_stats.tx_count).toBe(0);
    expect(address.mempool_stats.tx_count).toBe(1);
  });
  test('refuses a rebuilding or lagging index before reading balances', async () => {
    mockIndex.request.mockResolvedValue({ height: 99, hex: 'header' });
    await expect(new ElectrumApi(rpc()).$getAddress('nrt1test')).rejects.toThrow('height mismatch');
    expect(mockIndex.blockchainScripthash_getBalance).not.toHaveBeenCalled();
  });
  test('refuses equal heights on different tips', async () => {
    mockIndex.request.mockResolvedValue({ height: 100, hex: 'other' });
    await expect(new ElectrumApi(rpc()).$getAddress('nrt1test')).rejects.toThrow('tips differ');
  });
  test('refuses an address without a public script, including Bech32x', async () => {
    const core = rpc(); core.validateAddress.mockResolvedValue({ isvalid: true } as any);
    await expect(new ElectrumApi(core).$getAddress('nrt1xprivate')).rejects.toThrow('not public');
    expect(mockIndex.blockchainScripthash_getBalance).not.toHaveBeenCalled();
  });
  test('height -1 is an unconfirmed UTXO', async () => {
    const result = await new ElectrumApi(rpc()).$getScriptHashUtxos('hash');
    expect(result[0].status.confirmed).toBe(false);
  });
  test('retries a tip change during a read and returns only the fresh complete result', async () => {
    const core = rpc(); core.getBlockchainInfo.mockResolvedValueOnce({ chain: 'regtest', blocks: 100, bestblockhash: 'old', initialblockdownload: false });
    const api = new ElectrumApi(core);
    jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({ vin: [], vout: [{ scriptpubkey: '00', value: '42' }] } as any);
    const result = await api.$getAddress('nrt1test');
    expect(result.mempool_stats.funded_txo_sum).toBe('42');
    expect(result.stats_complete).toBe(true);
    expect(core.validateAddress).toHaveBeenCalledTimes(2);
    expect((api as any).transparentEffects).toHaveBeenCalledTimes(1);
  });
  test('bounds repeated tip changes to three attempts and preserves a transient error', async () => {
    const core = rpc(); let sequence = 0;
    core.getBlockchainInfo.mockImplementation(async () => ({ chain: 'regtest', blocks: 100,
      bestblockhash: `tip-${sequence++}`, initialblockdownload: false }));
    const api = new ElectrumApi(core);
    jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({ vin: [], vout: [{ scriptpubkey: '00', value: '42' }] } as any);
    await expect(api.$getAddress('nrt1test')).rejects.toBeInstanceOf(IndexUnavailableError);
    expect(core.validateAddress).toHaveBeenCalledTimes(3);
    expect(core.getBlockchainInfo).toHaveBeenCalledTimes(6);
  });
  test('does not multiply an upstream transport timeout into three full RPC deadlines', async () => {
    const core = rpc(); core.getBlockchainInfo.mockRejectedValue(new Error('ETIMEDOUT'));
    await expect(new ElectrumApi(core).$getAddress('nrt1test')).rejects.toMatchObject({ retryable: false });
    expect(core.getBlockchainInfo).toHaveBeenCalledTimes(1);
    expect(core.validateAddress).not.toHaveBeenCalled();
  });
  test('retries a changing balance without discarding exact cached contributions', async () => {
    const api = new ElectrumApi(rpc());
    jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({ vin: [], vout: [{ scriptpubkey: '00', value: '42' }] } as any);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: '0', unconfirmed: '41' });
    expect((await api.$getAddress('nrt1test')).mempool_stats.funded_txo_sum).toBe('42');
    expect((api as any).transparentEffects).toHaveBeenCalledTimes(1);
    expect(mockIndex.blockchainScripthash_getBalance).toHaveBeenCalledTimes(2);
  });
  test('coalesces a cold 21186-transaction scan across a new block and reuses every exact contribution', async () => {
    const count = 21186;
    const txidForFirst = txid(100);
    const expected = (9007199254740993n + BigInt(count - 1)).toString();
    mockIndex.blockchainScripthash_getHistory.mockResolvedValue(Array.from(
      { length: count }, (_, index) => ({ tx_hash: txid(index + 100), height: 1 })) as any);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValue({ confirmed: expected, unconfirmed: '0' });
    let started!: () => void; let finish!: () => void;
    const collecting = new Promise<void>(resolve => { started = resolve; });
    const slowFirstRead = new Promise<void>(resolve => { finish = resolve; });
    const core = { ...rpc(), getRawTransaction: jest.fn(async txid => {
      if (txid === txidForFirst) { started(); await slowFirstRead; }
      return { txid, vin: [], vout: [{ value: txid === txidForFirst ? '90071992.54740993' : '0.00000001', scriptPubKey: { hex: '00' } }] };
    }) };
    const api = new ElectrumApi(core);
    const visitors = Promise.all(Array.from({ length: 20 }, () => api.$getAddress('nrt1test')));
    await collecting;
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 101, bestblockhash: 'next', initialblockdownload: false });
    indexSnapshot = { height: 101, hex: 'header' };
    finish();
    for (const result of await visitors) {
      expect(result.chain_stats).toMatchObject({ tx_count: count, funded_txo_count: count, funded_txo_sum: expected, spent_txo_sum: '0' });
      expect(result.stats_complete).toBe(true);
    }
    expect(core.getRawTransaction).toHaveBeenCalledTimes(count);
    expect(core.validateAddress).toHaveBeenCalledTimes(2);
    expect(mockIndex.blockchainScripthash_getHistory).toHaveBeenCalledTimes(2);
  }, 15000);
  test('preserves the JSON integer before the Electrum client callback', () => {
    const api = new ElectrumApi(rpc());
    (api as any).electrumClient.onMessage('{"id":1,"result":{"confirmed":9007199254740993,"unconfirmed":-1}}');
    expect(mockIndex.response).toHaveBeenCalledWith({ id: 1, result: { confirmed: '9007199254740993', unconfirmed: '-1' } });
  });
  test('returns exact UTXOs above 2^53', async () => {
    mockIndex.blockchainScripthash_listunspent.mockResolvedValueOnce([{ tx_hash: 'large', tx_pos: 0, height: -1, value: '128456589000000000' }] as any);
    const result = await new ElectrumApi(rpc()).$getScriptHashUtxos('hash');
    expect(result[0].value).toBe('128456589000000000');
  });
  test('uses bounded Electrum pages for a large address transaction page', async () => {
    (mockIndex.request as jest.Mock).mockImplementation(async (method, params) => {
      if (method === 'blockchain.headers.subscribe') { return { height: 100, hex: 'header' }; }
      if (method === 'blockchain.nito.scripthash.get_history_page') {
        if (params[1] === null) {
          const confirmed = Array.from({ length: 99 }, (_, index) => ({
            tx_hash: index === 0 ? NEW : txid(1000 + index), height: 100, cursor: 200 - index,
          }));
          confirmed.push({ tx_hash: SEEN, height: 99, cursor: 101 });
          return { confirmed, unconfirmed: [], cursor: 101, has_more: true, total: 101 };
        }
        return { confirmed: [{ tx_hash: OLD, height: 98, cursor: 100 }],
          unconfirmed: [], cursor: null, has_more: false, total: 101 };
      }
      throw new Error(`unexpected method ${method}`);
    });
    const api = new ElectrumApi(rpc());
    jest.spyOn(api as any, '$getRawTransaction').mockImplementation(async txid => ({ txid }));
    const transactions = await api.$getAddressTransactions('nrt1test', SEEN);
    expect(transactions).toEqual([{ txid: OLD }]);
    expect(mockIndex.blockchainScripthash_getHistory).not.toHaveBeenCalled();
    expect(mockIndex.request).toHaveBeenCalledWith(
      'blockchain.nito.scripthash.get_history_page', [expect.any(String), 101, 100]);
  });
  test('bounds an unknown continuation on a large history to ten Electrum pages', async () => {
    mockIndex.blockchainScripthash_getHistory.mockResolvedValue(Array.from(
      { length: 2000 }, (_, index) => ({ tx_hash: txid(index + 10_000), height: 100 })) as any);
    const api = new ElectrumApi(rpc());
    await expect(api.$getAddressTransactions('nrt1test', txid(999_999)))
      .rejects.toThrow('too old or unknown');
    const pageCalls = mockIndex.request.mock.calls.filter(call =>
      call[0] === 'blockchain.nito.scripthash.get_history_page');
    expect(pageCalls).toHaveLength(10);
  });
  test('resumes a deep page from a shared persistent cursor after restart', async () => {
    const tip100 = 'aa'.repeat(32);
    config.DATABASE.ENABLED = true;
    const query = jest.spyOn(DB, 'query').mockImplementation(async (sql: any) =>
      String(sql).includes('SELECT tx_num')
        ? [[{ tx_num: '1900', tip_hash: tip100, tip_height: 100 }], []] as any
        : [[], []] as any);
    mockIndex.request.mockImplementation(async (method, params) => {
      if (method === 'blockchain.headers.subscribe') { return { height: 100, hex: 'header' }; }
      if (method === 'blockchain.nito.scripthash.get_history_page') {
        expect(params[1]).toBe(1900);
        const confirmed = Array.from({ length: 100 }, (_, index) => ({
          tx_hash: txid(20_000 + index), height: 99, cursor: 1899 - index,
        }));
        return { confirmed, unconfirmed: [], cursor: 1800, has_more: true, total: 2000 };
      }
      throw new Error(`unexpected method ${method}`);
    });
    const core = rpc();
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 100, bestblockhash: tip100, initialblockdownload: false });
    const api = new ElectrumApi(core);
    jest.spyOn(api as any, '$getRawTransaction').mockImplementation(async hash => ({ txid: hash }));
    const result = await api.$getAddressTransactions('nrt1test', SEEN);
    expect(result.map(transaction => transaction.txid)).toEqual(
      Array.from({ length: 10 }, (_, index) => txid(20_000 + index)));
    expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO address_history_cursors'))).toBe(true);
  });
  test('does not persist trivial address statistics from public probes', async () => {
    config.DATABASE.ENABLED = true;
    const query = jest.spyOn(DB, 'query').mockResolvedValue([[], []] as any);
    const api = new ElectrumApi(rpc());
    jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({
      vin: [], vout: [{ scriptpubkey: '00', value: '42' }],
    });
    await api.$getAddress('nrt1test');
    expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO address_stats_cache'))).toBe(false);
  });
  test('completes loading indicators for empty address and scripthash transaction pages', async () => {
    mockIndex.blockchainScripthash_getHistory.mockResolvedValue([]);
    const api = new ElectrumApi(rpc());
    await expect(api.$getAddressTransactions('nrt1test', '')).resolves.toEqual([]);
    expect(loadingIndicators.setProgress).toHaveBeenLastCalledWith('address-nrt1test', 100);
    await expect(api.$getScriptHashTransactions('00'.repeat(32))).resolves.toEqual([]);
    expect(loadingIndicators.setProgress).toHaveBeenLastCalledWith(`address-${'00'.repeat(32)}`, 100);
  });
  test('separates confirmed genesis height zero from unconfirmed height zero', async () => {
    mockIndex.request.mockImplementation(async (method) => {
      if (method === 'blockchain.headers.subscribe') { return { height: 100, hex: 'header' }; }
      if (method === 'blockchain.nito.scripthash.get_history_page') {
        return { confirmed: [{ tx_hash: FUND, height: 0, cursor: 1 }],
          unconfirmed: [{ tx_hash: SELF, height: 0, fee: 0 }], cursor: null, has_more: false, total: 1 };
      }
      throw new Error(`unexpected method ${method}`);
    });
    mockIndex.blockchainScripthash_getBalance.mockResolvedValue({ confirmed: '42', unconfirmed: '7' });
    const api = new ElectrumApi(rpc());
    jest.spyOn(api as any, 'transparentEffects').mockImplementation(async hash => ({
      vin: [], vout: [{ scriptpubkey: '00', value: hash === FUND ? '42' : '7' }],
    }));
    const result = await api.$getAddress('nrt1test');
    expect(result.chain_stats).toMatchObject({ tx_count: 1, funded_txo_sum: '42' });
    expect(result.mempool_stats).toMatchObject({ tx_count: 1, funded_txo_sum: '7' });
  });
  test('serves a completed exact address snapshot during a proven forward indexing lag', async () => {
    const core = rpc();
    const api = new ElectrumApi(core);
    jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({ vin: [], vout: [{ scriptpubkey: '00', value: '42' }] } as any);
    const warm = await api.$getAddress('nrt1test');
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 101, bestblockhash: 'next', initialblockdownload: false });
    core.getBlockHash.mockImplementation(async height => height === 100 ? 'tip' : 'next');
    const stale = await api.$getAddress('nrt1test');
    expect(stale).toEqual(warm);
    expect(stale.stats_complete).toBe(true);
  });
  test('does not serve a cached address snapshot when its tip is no longer active', async () => {
    const core = rpc();
    const api = new ElectrumApi(core);
    jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({ vin: [], vout: [{ scriptpubkey: '00', value: '42' }] } as any);
    await api.$getAddress('nrt1test');
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 101, bestblockhash: 'reorg-tip', initialblockdownload: false });
    core.getBlockHash.mockResolvedValue('different-active-hash');
    await expect(api.$getAddress('nrt1test')).rejects.toBeInstanceOf(IndexUnavailableError);
  });
  test('does not serve an H snapshot once Electrum has advanced to H+1 behind Core H+2', async () => {
    const core = rpc();
    const api = new ElectrumApi(core);
    jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({ vin: [], vout: [{ scriptpubkey: '00', value: '42' }] } as any);
    await api.$getAddress('nrt1test');
    indexSnapshot = { height: 101, hex: 'header-101' };
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 102, bestblockhash: 'tip-102', initialblockdownload: false });
    await expect(api.$getAddress('nrt1test')).rejects.toBeInstanceOf(IndexUnavailableError);
  });
  test('reuses a persisted active-chain prefix after restart and scans only appended transactions', async () => {
    const tip100 = 'aa'.repeat(32), tip101 = 'bb'.repeat(32);
    config.DATABASE.ENABLED = true;
    jest.spyOn(DB, 'query').mockImplementation(async (sql: any) => String(sql).includes('SELECT')
      ? [[{ fingerprint: '11'.repeat(32), tip_hash: tip100, tip_height: 100,
        chain_stats: { funded_txo_count: 1, funded_txo_sum: '42', spent_txo_count: 0, spent_txo_sum: '0', tx_count: 1 },
        mempool_stats: { funded_txo_count: 0, funded_txo_sum: '0', spent_txo_count: 0, spent_txo_sum: '0', tx_count: 0 } }], []] as any
      : [[], []] as any);
    indexSnapshot = { height: 101, hex: 'header' };
    mockIndex.blockchainScripthash_getHistory.mockResolvedValue([
      { tx_hash: SELF, height: 101 }, { tx_hash: FUND, height: 100 },
    ] as any);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValue({ confirmed: '43', unconfirmed: '0' });
    const core = rpc();
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 101, bestblockhash: tip101, initialblockdownload: false });
    core.getBlockHash.mockImplementation(async height => height === 100 ? tip100 : tip101);
    const api = new ElectrumApi(core);
    const effects = jest.spyOn(api as any, 'transparentEffects').mockImplementation(async hash => ({
      vin: [], vout: [{ scriptpubkey: '00', value: hash === SELF ? '1' : '42' }],
    }));
    const result = await api.$getAddress('nrt1test');
    expect(result.chain_stats).toMatchObject({ tx_count: 2, funded_txo_sum: '43' });
    expect(effects).toHaveBeenCalledTimes(1);
    expect(effects).toHaveBeenCalledWith(SELF, false);
  });
  test('recalculates mutable mempool stats while reusing persisted confirmed stats', async () => {
    const tip100 = 'aa'.repeat(32);
    config.DATABASE.ENABLED = true;
    jest.spyOn(DB, 'query').mockImplementation(async (sql: any) => String(sql).includes('SELECT')
      ? [[{ fingerprint: '22'.repeat(32), tip_hash: tip100, tip_height: 100,
        chain_stats: { funded_txo_count: 1, funded_txo_sum: '42', spent_txo_count: 0, spent_txo_sum: '0', tx_count: 1 },
        mempool_stats: { funded_txo_count: 1, funded_txo_sum: '5', spent_txo_count: 0, spent_txo_sum: '0', tx_count: 1 } }], []] as any
      : [[], []] as any);
    mockIndex.blockchainScripthash_getHistory.mockResolvedValue([
      { tx_hash: FUND, height: 100 }, { tx_hash: SELF, height: 0, fee: 0 },
    ] as any);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValue({ confirmed: '42', unconfirmed: '7' });
    const core = rpc();
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 100, bestblockhash: tip100, initialblockdownload: false });
    const api = new ElectrumApi(core);
    const effects = jest.spyOn(api as any, 'transparentEffects').mockResolvedValue({
      vin: [], vout: [{ scriptpubkey: '00', value: '7' }],
    });
    const result = await api.$getAddress('nrt1test');
    expect(result.chain_stats.funded_txo_sum).toBe('42');
    expect(result.mempool_stats).toMatchObject({ tx_count: 1, funded_txo_sum: '7' });
    expect(effects).toHaveBeenCalledTimes(1);
    expect(effects).toHaveBeenCalledWith(SELF, false);
  });
  test('rejects persisted-prefix reuse after a reorg and performs a full exact scan', async () => {
    const oldTip100 = 'aa'.repeat(32), active100 = 'cc'.repeat(32), tip101 = 'bb'.repeat(32);
    config.DATABASE.ENABLED = true;
    jest.spyOn(DB, 'query').mockImplementation(async (sql: any) => String(sql).includes('SELECT')
      ? [[{ fingerprint: '33'.repeat(32), tip_hash: oldTip100, tip_height: 100,
        chain_stats: { funded_txo_count: 1, funded_txo_sum: '42', spent_txo_count: 0, spent_txo_sum: '0', tx_count: 1 },
        mempool_stats: { funded_txo_count: 0, funded_txo_sum: '0', spent_txo_count: 0, spent_txo_sum: '0', tx_count: 0 } }], []] as any
      : [[], []] as any);
    indexSnapshot = { height: 101, hex: 'header' };
    mockIndex.blockchainScripthash_getHistory.mockResolvedValue([
      { tx_hash: SELF, height: 101 }, { tx_hash: FUND, height: 99 },
    ] as any);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValue({ confirmed: '43', unconfirmed: '0' });
    const core = rpc();
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 101, bestblockhash: tip101, initialblockdownload: false });
    core.getBlockHash.mockImplementation(async height => height === 100 ? active100 : tip101);
    const api = new ElectrumApi(core);
    const effects = jest.spyOn(api as any, 'transparentEffects').mockImplementation(async hash => ({
      vin: [], vout: [{ scriptpubkey: '00', value: hash === SELF ? '1' : '42' }],
    }));
    const result = await api.$getAddress('nrt1test');
    expect(result.chain_stats).toMatchObject({ tx_count: 2, funded_txo_sum: '43' });
    expect(effects).toHaveBeenCalledTimes(2);
    expect(new Set(effects.mock.calls.map(call => call[0]))).toEqual(new Set([FUND, SELF]));
  });
  test('returns real cumulative funded/spent totals above MAX_MONEY without rounding', async () => {
    const max = '128456589000000000', remainder = '128456588999999999';
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: remainder, unconfirmed: '0' });
    mockIndex.blockchainScripthash_getHistory.mockResolvedValueOnce([{ tx_hash: FUND, height: 1 }, { tx_hash: SELF, height: 2 }] as any);
    const api = new ElectrumApi(rpc());
    jest.spyOn(api as any, 'transparentEffects').mockImplementation(async txid => txid === FUND
      ? ({ vin: [], vout: [{ scriptpubkey: '00', value: max }] } as any)
      : ({ vin: [{ is_coinbase: false, txid: FUND, vout: 0 }], vout: [{ scriptpubkey: '00', value: remainder }] } as any));
    const result = await api.$getAddress('nrt1test');
    expect(result.chain_stats.funded_txo_sum).toBe('256913177999999999');
    expect(result.chain_stats.spent_txo_sum).toBe(max);
    expect(result.chain_stats.funded_txo_count).toBe(2);
    expect(result.chain_stats.spent_txo_count).toBe(1);
    expect(result.stats_complete).toBe(true);
  });
  test('reuses immutable effects for incremental history, confirmation and reorg', async () => {
    const core = { ...rpc(), getRawTransaction: jest.fn(async txid => txid === FUND
      ? { txid, vin: [{ coinbase: '01' }], vout: [{ value: '1284565890.00000000', scriptPubKey: { hex: '00' } }] }
      : { txid, vin: [{ txid: FUND, vout: 0 }], vout: [{ value: '1284565889.99999999', scriptPubKey: { hex: '00' } }] }) };
    const api = new ElectrumApi(core);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: '128456589000000000', unconfirmed: '0' });
    mockIndex.blockchainScripthash_getHistory.mockResolvedValueOnce([{ tx_hash: FUND, height: 1 }] as any);
    await api.$getAddress('nrt1test');
    expect(core.getRawTransaction).toHaveBeenCalledTimes(1);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: '128456588999999999', unconfirmed: '0' });
    mockIndex.blockchainScripthash_getHistory.mockResolvedValueOnce([{ tx_hash: FUND, height: 1 }, { tx_hash: SELF, height: 2 }] as any);
    const confirmed = await api.$getAddress('nrt1test');
    expect(core.getRawTransaction).toHaveBeenCalledTimes(2);
    expect(confirmed.chain_stats.funded_txo_sum).toBe('256913177999999999');
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: '128456589000000000', unconfirmed: '-1' });
    mockIndex.blockchainScripthash_getHistory.mockResolvedValueOnce([{ tx_hash: FUND, height: 1 }, { tx_hash: SELF, height: 0 }] as any);
    const returned = await api.$getAddress('nrt1test');
    expect(core.getRawTransaction).toHaveBeenCalledTimes(2);
    expect(returned.chain_stats.funded_txo_sum).toBe('128456589000000000');
    expect(BigInt(returned.mempool_stats.funded_txo_sum) - BigInt(returned.mempool_stats.spent_txo_sum)).toBe(-1n);
  });
});
