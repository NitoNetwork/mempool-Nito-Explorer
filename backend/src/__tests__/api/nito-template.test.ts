import mempoolBlocks from '../../api/mempool-blocks';
import config from '../../config';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import { Common } from '../../api/common';

jest.mock('../../api/bitcoin/bitcoin-client', () => ({ getBlockTemplate: jest.fn(), getBestBlockHash: jest.fn() }));
jest.mock('../../repositories/PoolsRepository', () => ({}));

describe('Core selected Nito next block', () => {
  beforeEach(() => { config.MEMPOOL.BACKEND = 'electrum'; config.MEMPOOL.NETWORK = 'regtest'; jest.clearAllMocks(); });
  const tx = (id: string) => ({ txid: id, wtxid: id + 'w', fee: 10000, weight: 9600, size: 9000,
    vsize: 7000, policy_vsize: 7000, adjustedVsize: 7000, effectiveFeePerVsize: 10000 / 7000,
    feePerVsize: 10000 / 7000, vin: [], vout: [], has_private_bundle: true,
    private_metadata_status: 'complete', private_bundle: { version: 1, actions: 2, flags: 3, value_balance: '0.00010000', has_auth: true } } as any);
  test('uses Core ordering, clears old positions and preserves compressed metadata', async () => {
    const a = tx('a'), b = tx('b'); a.position = { block: 0, vsize: 1 };
    bitcoinClient.getBlockTemplate.mockResolvedValue({ previousblockhash: 'tip', transactions: [{ txid: 'b', hash: 'bw' }] });
    bitcoinClient.getBestBlockHash.mockResolvedValue('tip');
    const blocks = await mempoolBlocks.$makeBlockTemplates(['a', 'b'], { a, b }, undefined, true);
    expect(blocks[0].transactionIds).toEqual(['b']); expect(a.position).toBeUndefined(); expect(b.position.block).toBe(0);
    const compressed = mempoolBlocks.compressTx(Common.classifyTransaction(b));
    expect(compressed[8]!.private_bundle).toEqual(b.private_bundle);
    expect(compressed[8]!.wtxid).toBe('bw'); expect(compressed[2]).toBe(2400);
    expect(compressed[8]!.policy_vsize).toBe(7000);
    expect(blocks[0].blockVSize).toBe(2400);
  });
  test.each(['mainnet', 'testnet', 'regtest', 'signet'] as const)('declares the mandatory Core template rules for %s', async network => {
    config.MEMPOOL.NETWORK = network;
    bitcoinClient.getBlockTemplate.mockResolvedValue({ previousblockhash: 'tip', transactions: [] });
    bitcoinClient.getBestBlockHash.mockResolvedValue('tip');
    await mempoolBlocks.$makeBlockTemplates([], {}, undefined, true);
    expect(bitcoinClient.getBlockTemplate).toHaveBeenCalledWith({ rules: network === 'signet' ? ['segwit', 'signet'] : ['segwit'] });
  });
  test('invalidates projection on Core failure instead of retaining eligibility', async () => {
    const a = tx('a'); a.position = { block: 0, vsize: 1 };
    bitcoinClient.getBlockTemplate.mockRejectedValue(new Error('RPC down'));
    expect(await mempoolBlocks.$makeBlockTemplates(['a'], { a }, undefined, true)).toEqual([]);
    expect(a.position).toBeUndefined(); expect(mempoolBlocks.getMempoolBlocks()).toEqual([]);
  });
  test('an invalidated in-flight template cannot restore transaction eligibility', async () => {
    const a = tx('a'); a.position = { block: 0, vsize: 1 };
    let complete!: (value: unknown) => void;
    bitcoinClient.getBlockTemplate.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    bitcoinClient.getBestBlockHash.mockResolvedValue('tip');
    const pending = mempoolBlocks.$makeBlockTemplates(['a'], { a }, undefined, true);
    mempoolBlocks.invalidate({ a });
    complete({ previousblockhash: 'tip', transactions: [{ txid: 'a', hash: 'aw' }] });
    expect(await pending).toEqual([]);
    expect(a.position).toBeUndefined();
    expect(mempoolBlocks.getMempoolBlocks()).toEqual([]);
  });
  test('summary and compressed WebSocket retain totals beyond binary64 precision', () => {
    const a = tx('a'); a.vout = [{ value: Number.MAX_SAFE_INTEGER }, { value: 1 }];
    a.fee = '9007199254740993';
    const summary = Common.stripTransaction(a);
    expect(summary.value).toBe('9007199254740992');
    expect(summary.fee).toBe('9007199254740993');
    const compressed = mempoolBlocks.compressTx({ ...summary, flags: 0 });
    expect(JSON.parse(JSON.stringify(compressed)).slice(1, 4)).toEqual(['9007199254740993', 2400, '9007199254740992']);
  });
  test('summary preserves zero fees and distinguishes absent fees', () => {
    const a = tx('a'); a.fee = 0;
    expect(Common.stripTransaction(a).fee).toBe('0');
    delete a.fee;
    expect(Common.stripTransaction(a).fee).toBe('-1');
  });
  test('does not invent a position for an incomplete transaction', async () => {
    const a = tx('a'); a.private_metadata_status = 'incomplete';
    bitcoinClient.getBlockTemplate.mockResolvedValue({ previousblockhash: 'tip', transactions: [{ txid: 'a', hash: 'aw' }] });
    bitcoinClient.getBestBlockHash.mockResolvedValue('tip');
    expect(await mempoolBlocks.$makeBlockTemplates(['a'], { a }, undefined, true)).toEqual([]);
  });
});
