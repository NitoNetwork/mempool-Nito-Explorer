import ElectrumApi from '../../api/bitcoin/electrum-api';
import config from '../../config';
import { IndexUnavailableError } from '../../api/bitcoin/index-unavailable-error';

const mockIndex = {
  response: jest.fn(),
  subscribe: { emit: jest.fn() },
  initElectrum: jest.fn(async () => undefined),
  request: jest.fn(async () => ({ height: 100, hex: 'header' })),
  blockchainScripthash_getBalance: jest.fn(async () => ({ confirmed: '0', unconfirmed: '42' })),
  blockchainScripthash_getHistory: jest.fn(async () => [{ tx_hash: 'tx', height: 0, fee: 0 }]),
  blockchainScripthash_listunspent: jest.fn(async () => [{ tx_hash: 'tx', tx_pos: 0, height: -1, value: 42 }]),
};
jest.mock('@mempool/electrum-client', () => jest.fn().mockImplementation(() => mockIndex));
jest.mock('../../api/blocks', () => ({}));
jest.mock('../../api/transaction-utils', () => ({}));
jest.mock('../../api/common', () => ({}));
jest.mock('../../api/loading-indicators', () => ({ setProgress: jest.fn() }));
jest.mock('../../api/memory-cache', () => ({ get: () => null, set: () => {} }));

function rpc() {
  return { getBlockchainInfo: jest.fn(async () => ({ chain: 'regtest', blocks: 100, bestblockhash: 'tip', initialblockdownload: false })),
    getBlockHeader: jest.fn(async () => 'header'), validateAddress: jest.fn(async () => ({ isvalid: true, address: 'nrt1test', scriptPubKey: '00' })) };
}

describe('Electrum index consistency', () => {
  beforeEach(() => {
    config.MEMPOOL.NETWORK = 'regtest'; jest.clearAllMocks();
    mockIndex.request.mockReset().mockResolvedValue({ height: 100, hex: 'header' });
    mockIndex.blockchainScripthash_getBalance.mockReset().mockResolvedValue({ confirmed: '0', unconfirmed: '42' });
    mockIndex.blockchainScripthash_getHistory.mockReset().mockResolvedValue([{ tx_hash: 'tx', height: 0, fee: 0 }]);
    mockIndex.blockchainScripthash_listunspent.mockReset().mockResolvedValue([{ tx_hash: 'tx', tx_pos: 0, height: -1, value: 42 }]);
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
    const expected = (9007199254740993n + BigInt(count - 1)).toString();
    mockIndex.blockchainScripthash_getHistory.mockResolvedValue(Array.from({ length: count }, (_, index) => ({ tx_hash: `tx${index}`, height: 1 })) as any);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValue({ confirmed: expected, unconfirmed: '0' });
    let started!: () => void; let finish!: () => void;
    const collecting = new Promise<void>(resolve => { started = resolve; });
    const slowFirstRead = new Promise<void>(resolve => { finish = resolve; });
    const core = { ...rpc(), getRawTransaction: jest.fn(async txid => {
      if (txid === 'tx0') { started(); await slowFirstRead; }
      return { txid, vin: [], vout: [{ value: txid === 'tx0' ? '90071992.54740993' : '0.00000001', scriptPubKey: { hex: '00' } }] };
    }) };
    const api = new ElectrumApi(core);
    const visitors = Promise.all(Array.from({ length: 20 }, () => api.$getAddress('nrt1test')));
    await collecting;
    core.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 101, bestblockhash: 'next', initialblockdownload: false });
    mockIndex.request.mockResolvedValue({ height: 101, hex: 'header' });
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
  test('returns real cumulative funded/spent totals above MAX_MONEY without rounding', async () => {
    const max = '128456589000000000', remainder = '128456588999999999';
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: remainder, unconfirmed: '0' });
    mockIndex.blockchainScripthash_getHistory.mockResolvedValueOnce([{ tx_hash: 'fund', height: 1 }, { tx_hash: 'self', height: 2 }] as any);
    const api = new ElectrumApi(rpc());
    jest.spyOn(api as any, 'transparentEffects').mockImplementation(async txid => txid === 'fund'
      ? ({ vin: [], vout: [{ scriptpubkey: '00', value: max }] } as any)
      : ({ vin: [{ is_coinbase: false, txid: 'fund', vout: 0 }], vout: [{ scriptpubkey: '00', value: remainder }] } as any));
    const result = await api.$getAddress('nrt1test');
    expect(result.chain_stats.funded_txo_sum).toBe('256913177999999999');
    expect(result.chain_stats.spent_txo_sum).toBe(max);
    expect(result.chain_stats.funded_txo_count).toBe(2);
    expect(result.chain_stats.spent_txo_count).toBe(1);
    expect(result.stats_complete).toBe(true);
  });
  test('reuses immutable effects for incremental history, confirmation and reorg', async () => {
    const core = { ...rpc(), getRawTransaction: jest.fn(async txid => txid === 'fund'
      ? { txid, vin: [{ coinbase: '01' }], vout: [{ value: '1284565890.00000000', scriptPubKey: { hex: '00' } }] }
      : { txid, vin: [{ txid: 'fund', vout: 0 }], vout: [{ value: '1284565889.99999999', scriptPubKey: { hex: '00' } }] }) };
    const api = new ElectrumApi(core);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: '128456589000000000', unconfirmed: '0' });
    mockIndex.blockchainScripthash_getHistory.mockResolvedValueOnce([{ tx_hash: 'fund', height: 1 }] as any);
    await api.$getAddress('nrt1test');
    expect(core.getRawTransaction).toHaveBeenCalledTimes(1);
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: '128456588999999999', unconfirmed: '0' });
    mockIndex.blockchainScripthash_getHistory.mockResolvedValueOnce([{ tx_hash: 'fund', height: 1 }, { tx_hash: 'self', height: 2 }] as any);
    const confirmed = await api.$getAddress('nrt1test');
    expect(core.getRawTransaction).toHaveBeenCalledTimes(2);
    expect(confirmed.chain_stats.funded_txo_sum).toBe('256913177999999999');
    mockIndex.blockchainScripthash_getBalance.mockResolvedValueOnce({ confirmed: '128456589000000000', unconfirmed: '-1' });
    mockIndex.blockchainScripthash_getHistory.mockResolvedValueOnce([{ tx_hash: 'fund', height: 1 }, { tx_hash: 'self', height: 0 }] as any);
    const returned = await api.$getAddress('nrt1test');
    expect(core.getRawTransaction).toHaveBeenCalledTimes(2);
    expect(returned.chain_stats.funded_txo_sum).toBe('128456589000000000');
    expect(BigInt(returned.mempool_stats.funded_txo_sum) - BigInt(returned.mempool_stats.spent_txo_sum)).toBe(-1n);
  });
});
