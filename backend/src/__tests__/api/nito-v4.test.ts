import { nitoshi, parseCoreJson, privateMetadataState, safeNitoshi } from '../../api/nito-values';
import { NitoPools } from '../../api/nito-pools';
import BitcoinApi from '../../api/bitcoin/bitcoin-api';
import { readFileSync } from 'fs';

jest.mock('../../api/blocks', () => ({ getCurrentBlockHeight: () => 100 }));
jest.mock('../../api/mempool', () => ({ getMempool: () => ({}), isInSync: () => true }));
jest.mock('../../api/transaction-utils', () => ({ convertScriptSigAsm: () => '', addInnerScriptsToVin: () => {} }));
jest.mock('../../api/common', () => ({ Common: { getTransactionFlags: () => 0 } }));

describe('Nito exact public amounts', () => {
  test('preserves large integers and decimals before JSON conversion', () => {
    const data = parseCoreJson('{"chainValueNitoshi":128456588999999999,"value":1284565889.99999999,"size":42,"text":"value:123 \\\"quoted\\\""}');
    expect(data.chainValueNitoshi).toBe('128456588999999999');
    expect(nitoshi(data.value)).toBe(128456588999999999n);
    expect(data.size).toBe(42);
    expect(data.text).toBe('value:123 "quoted"');
  });
  test.each(['0.00000001', '-0.00000001', '123.45678901'])('exact decimal %s', value => {
    expect(BigInt(safeNitoshi(value))).toBe(nitoshi(value));
  });
  test('returns full-range Nito transaction amounts exactly', () => {
    expect(safeNitoshi('1284565889.99999999')).toBe('128456588999999999');
    expect(safeNitoshi('1284565890.00000000')).toBe('128456589000000000');
    expect(() => nitoshi('0.000000001')).toThrow();
  });
  test('does not classify a private wire envelope with missing metadata as transparent', () => {
    expect(privateMetadataState({ hex: '02000000000600' })).toBe('incomplete');
    expect(privateMetadataState({ hex: '02000000000100' })).toBe('transparent');
  });
});

if (process.env.NITO_CORE_VECTORS) {
  describe('Actual Core V4 regtest transactions', () => {
    const vectors = JSON.parse(readFileSync(process.env.NITO_CORE_VECTORS!, 'utf8'));
    test.each<[number, any]>(vectors.map((vector, index) => [index, vector]))('vector %s matches Core fee and policy size', async (_index, vector: any) => {
      const api = new TestApi({ getMempoolEntry: async () => vector.mempool });
      jest.spyOn(api, '$getRawTransaction').mockImplementation(async txid => ({
        vout: vector.parents[txid].vout.map(output => ({ value: safeNitoshi(output.value) }))
      } as any));
      const live = await api.convert(vector.raw, true);
      expect(live.fee).toBe(safeNitoshi(vector.mempool.fees.base));
      expect(live.policy_vsize).toBe(vector.mempool.vsize);
      expect(live.wtxid).toBe(vector.mempool.wtxid);
      expect(live.private_metadata_status).toBe('complete');
      const confirmed = await api.convert(vector.confirmed, true);
      expect(confirmed.fee).toBe(live.fee);
      expect(confirmed.private_bundle).toEqual(live.private_bundle);
      const before = vector.pools_before.orchard.chainValueNitoshi;
      const after = vector.pools_after.orchard.chainValueNitoshi;
      expect(BigInt(after) - BigInt(before)).toBe(-nitoshi(live.private_bundle!.value_balance));
    });
  });
}

function poolRpc() {
  const value = { chain: 'regtest', blocks: 100, bestblockhash: 'a'.repeat(64), privateTxActivationHeight: 10, activated: true,
    transparent: { monitored: true, chainValueNitoshi: '9007199254740993' },
    orchard: { monitored: true, chainValueNitoshi: '12' },
    total: { monitored: true, chainValueNitoshi: '9007199254741005' } };
  return {
    value,
    getBlockchainInfo: jest.fn(async () => ({ chain: 'regtest', blocks: 100, bestblockhash: 'a'.repeat(64), initialblockdownload: false, privateTxActivationHeight: 10, activated: true })),
    getIndexInfo: jest.fn(async () => ({ coinstatsindex: { synced: true, best_block_height: 100 } })),
    getOrchardPools: jest.fn(async () => structuredClone(value)),
    getBestBlockHash: jest.fn(async () => 'a'.repeat(64)),
  };
}

describe('Confirmed pools', () => {
  test('coalesces concurrent requests and caches by block without rounding', async () => {
    const rpc = poolRpc(); const service = new NitoPools(rpc, 'regtest');
    const results = await Promise.all([service.get(), service.get(), service.get()]);
    expect(results[0].total.chainValueNitoshi).toBe('9007199254741005');
    expect(results[0].total.chainValue).toBe('90071992.54741005');
    await service.get();
    expect(rpc.getOrchardPools).toHaveBeenCalledTimes(1);
  });
  test('an invalidated collection cannot replace a fresh exact snapshot', async () => {
    const rpc = poolRpc();
    const service = new NitoPools(rpc, 'regtest');
    let started!: () => void;
    let complete!: (value: typeof rpc.value) => void;
    const collecting = new Promise<void>(resolve => { started = resolve; });
    const oldResponse = structuredClone(rpc.value);
    rpc.getOrchardPools.mockImplementationOnce(() => {
      started();
      return new Promise(resolve => { complete = resolve; });
    });
    const oldRequest = service.get();
    const oldRejection = expect(oldRequest).rejects.toThrow('snapshot changed');
    const coalescedRejection = expect(service.get()).rejects.toThrow('snapshot changed');
    await collecting;
    service.invalidate();
    expect(() => service.snapshot()).toThrow('unavailable');

    rpc.value.transparent.chainValueNitoshi = '128456588999999999';
    rpc.value.orchard.chainValueNitoshi = '1';
    rpc.value.total.chainValueNitoshi = '128456589000000000';
    const fresh = await service.get();
    expect(fresh.transparent.chainValueNitoshi).toBe('128456588999999999');
    expect(fresh.orchard.chainValueNitoshi).toBe('1');
    expect(fresh.total.chainValueNitoshi).toBe('128456589000000000');
    expect(fresh.total.chainValue).toBe('1284565890.00000000');

    complete(oldResponse);
    await Promise.all([oldRejection, coalescedRejection]);
    expect(service.snapshot()).toBe(fresh);
    expect((await service.get()).total.chainValueNitoshi).toBe('128456589000000000');
    expect(rpc.getOrchardPools).toHaveBeenCalledTimes(2);
  });
  test('requires coinstatsindex, never requests a UTXO scan', async () => {
    const rpc = poolRpc(); rpc.getIndexInfo.mockResolvedValue({} as any);
    await expect(new NitoPools(rpc, 'regtest').get()).rejects.toThrow('coinstatsindex');
    expect(rpc.getOrchardPools).not.toHaveBeenCalled();
  });
  test('rejects wrong networks', async () => {
    await expect(new NitoPools(poolRpc(), 'mainnet').get()).rejects.toThrow('network');
  });
  test('rejects a changed tip', async () => {
    const rpc = poolRpc(); rpc.getBestBlockHash.mockResolvedValue('b');
    await expect(new NitoPools(rpc, 'regtest').get()).rejects.toThrow('tip');
  });
  test('rejects nonconserving totals', async () => {
    const rpc = poolRpc(); rpc.value.orchard.chainValueNitoshi = '13';
    await expect(new NitoPools(rpc, 'regtest').get()).rejects.toThrow('invariant');
  });
  test('rejects already rounded RPC data', async () => {
    const rpc = poolRpc(); (rpc.value.total as any).chainValueNitoshi = 9007199254741005;
    await expect(new NitoPools(rpc, 'regtest').get()).rejects.toThrow('inexact');
  });
  test('does not reinterpret monitored pools as activated before H', async () => {
    const rpc = poolRpc();
    rpc.value.privateTxActivationHeight = 101; rpc.value.activated = false;
    rpc.getBlockchainInfo.mockResolvedValue({ chain: 'regtest', blocks: 100, bestblockhash: 'a'.repeat(64),
      initialblockdownload: false, privateTxActivationHeight: 101, activated: false });
    const result = await new NitoPools(rpc, 'regtest').get();
    expect(result.activated).toBe(false);
    expect(result.orchard.monitored).toBe(true);
    expect(result.total.chainValueNitoshi).toBe('9007199254741005');
  });
  test('rejects disagreement between lightweight activation and pool RPC metadata', async () => {
    const rpc = poolRpc(); rpc.value.activated = false;
    await expect(new NitoPools(rpc, 'regtest').get()).rejects.toThrow('activation changed');
  });
});

class TestApi extends BitcoinApi {
  convert(tx: any, prevouts = false) { return this.$convertTransaction(tx, prevouts); }
}
const rawTx = (balance?: string, vin: any[] = [], outputs: string[] = []) => ({
  txid: '1'.repeat(64), hash: '2'.repeat(64), version: 2, size: 9000, vsize: 2400, weight: 9600,
  locktime: 0, vin, vout: outputs.map(value => ({ value, scriptPubKey: { hex: '', type: 'pubkeyhash' } })), confirmations: 1,
  ...(balance == null ? {} : { has_private_bundle: true, private_bundle: { version: 1, flags: 3, actions: 2, value_balance: balance, has_auth: true } }),
});

describe('Core transaction conversion', () => {
  test.each(['-0.00000001', '1284565890.00000001'])('rejects a value beyond the actual consensus bound: %s', async value => {
    await expect(new TestApi({}).convert(rawTx(undefined, [], [value]))).rejects.toThrow('MoneyRange');
  });
  test.each(['9007199254740991', '9007199254740992', '9007199254740993', '128456588999999999'])('restitutes exact output %s and one-nitoshi fee', async output => {
    const coins = (BigInt(output) / 100000000n).toString() + '.' + (BigInt(output) % 100000000n).toString().padStart(8, '0');
    const api = new TestApi({});
    jest.spyOn(api, '$getRawTransaction').mockResolvedValue({ vout: [{ value: (BigInt(output) + 1n).toString() }] } as any);
    const tx = await api.convert(rawTx(undefined, [{ txid: 'parent', vout: 0 }], [coins]), true);
    expect(tx.vout[0].value).toBe(output);
    expect(tx.vin[0].prevout!.value).toBe((BigInt(output) + 1n).toString());
    expect(tx.fee).toBe('1');
    expect(JSON.parse(JSON.stringify(tx)).vout[0].value).toBe(output);
  });
  test.each([
    ['shield', '-0.99990000', true, []],
    ['unshield', '1.00000000', false, ['0.99990000']],
    ['private', '0.00010000', false, []],
    ['mixed', '-0.49990000', true, ['0.50000000']],
    ['transparent', undefined, true, ['0.99990000']],
  ])('%s fee follows Core public-balance equation', async (_kind, balance, input, outputs) => {
    const api = new TestApi({});
    jest.spyOn(api, '$getRawTransaction').mockResolvedValue({ vout: [{ value: 100000000 }] } as any);
    const tx = await api.convert(rawTx(balance as string, input ? [{ txid: 'parent', vout: 0 }] : [], outputs as string[]), true);
    expect(tx.fee).toBe('10000');
    expect(tx.wtxid).toBe('2'.repeat(64));
    expect(tx.serialized_vsize).toBe(2400);
  });
  test('mempool uses Core fee and policy vsize including proof cost', async () => {
    const api = new TestApi({ getMempoolEntry: async () => ({ fees: { base: '0.00010000' }, vsize: 7000, wtxid: '2'.repeat(64) }) });
    const tx = await api.convert({ ...rawTx('0.00010000'), confirmations: 0 });
    expect(tx.policy_vsize).toBe(7000); expect(tx.fee).toBe('10000'); expect(tx.fee_source).toBe('core');
  });
  test('missing metadata and fee remain unknown', async () => {
    const api = new TestApi({});
    const tx = await api.convert({ ...rawTx(), hex: '02000000000600' }, true);
    expect(tx.has_private_bundle).toBe(true); expect(tx.private_metadata_status).toBe('incomplete'); expect(tx.fee).toBe('-1');
  });
  test('an orphan is not confirmed', async () => {
    const tx = await new TestApi({}).convert({ ...rawTx(), confirmations: -1 });
    expect(tx.status.confirmed).toBe(false);
  });
  test('a zero fee supplied by Core remains known with missing private data', async () => {
    const tx = await new TestApi({}).convert({ ...rawTx(), fee: '0.00000000', has_private_bundle: true }, true);
    expect(tx.fee).toBe('0');
  });
});
