import config from '../config';
import summaries from '../repositories/BlocksSummariesRepository';
import { setupTestDatabase, waitForDatabase, cleanupTestData } from './test-helpers';

describe('Orchard SQL summary compatibility', () => {
  beforeAll(async () => { await waitForDatabase(); await setupTestDatabase(); config.MEMPOOL.BACKEND = 'electrum'; }, 120000);
  afterAll(cleanupTestData);
  const id = 'ab'.repeat(32);
  const tx: any = { txid: 'cd'.repeat(32), wtxid: 'ef'.repeat(32), fee: '0', value: '42',
    weight: 9600, vsize: 7000, policy_vsize: 7000, serialized_vsize: 2400,
    flags: 0, private_metadata_status: 'complete', has_private_bundle: true,
    private_bundle: { version: 1, flags: 3, actions: 2, has_auth: true, value_balance: '0.00000001' } };
  test('reads no transparent interpretation from a legacy SQL summary', async () => {
    await summaries.$saveTransactions(1, id, [{ txid: tx.txid, fee: 0, vsize: 2400, value: 42, flags: 0 }], 1);
    expect(await summaries.$getByBlockId(id)).toBeUndefined();
  });
  test('replaces a legacy row and preserves Orchard metadata and zero fee', async () => {
    await summaries.$saveTransactions(1, id, [tx], 1);
    expect((await summaries.$getByBlockId(id))!.transactions).toEqual([tx]);
  });
  test('rejects legacy templates and round-trips a Core template', async () => {
    await summaries.$saveTemplate({ height: 1, version: 1, template: { id, transactions: [{ txid: tx.txid } as any] } });
    expect(await summaries.$getTemplate(id)).toBeUndefined();
    await summaries.$saveTemplate({ height: 1, version: 1, template: { id, transactions: [tx] } });
    expect((await summaries.$getTemplate(id))!.transactions).toEqual([tx]);
  });
});
