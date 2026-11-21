import transactionUtils from '../../api/transaction-utils';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true,
  default: { $getRawTransaction: jest.fn() }, bitcoinCoreApi: {} }));
jest.mock('../../api/common', () => ({ Common: { isLiquid: () => false } }));

describe('Orchard transaction API lifecycle', () => {
  const tx = (confirmed: boolean): any => ({ txid: 'a', has_private_bundle: true,
    private_metadata_status: 'complete', fee: 0, weight: 9600, vin: [], vout: [], status: { confirmed } });
  test('confirmed Orchard with unavailable policy size remains readable through the API', async () => {
    (bitcoinApi.$getRawTransaction as jest.Mock).mockResolvedValue(tx(true));
    const result = await transactionUtils.$getTransactionExtended('a', true, false, false, true);
    expect(result.fee).toBe(0); expect(result.feePerVsize).toBe(-1);
    expect(result.private_metadata_status).toBe('complete');
  });
  test('unconfirmed Orchard still requires an authoritative Core policy size', () => {
    expect(() => transactionUtils.extendMempoolTransaction(tx(false))).toThrow('policy size');
    const result = transactionUtils.extendMempoolTransaction({ ...tx(false), policy_vsize: 7000, fee: 140000 });
    expect(result.feePerVsize).toBe(20); expect(result.vsize).toBe(7000);
  });
  test('bulk confirmed Orchard extension preserves exact amounts without inventing policy rates', () => {
    const result = transactionUtils.extendMempoolTransaction({ ...tx(true), fee: '9007199254740993', effectiveFeePerVsize: 123 });
    expect(result.fee).toBe('9007199254740993');
    expect(result.feePerVsize).toBe(-1);
    expect(result.adjustedFeePerVsize).toBe(-1);
    expect(result.effectiveFeePerVsize).toBe(-1);
    expect(result.firstSeen).toBeUndefined();
  });
  test('unknown fees remain unknown after confirmation even with a policy size', () => {
    const result = transactionUtils.extendMempoolTransaction({ ...tx(true), fee: '-1', policy_vsize: 7000 });
    expect(result.fee).toBe('-1');
    expect(result.feePerVsize).toBe(-1);
    expect(result.adjustedFeePerVsize).toBe(-1);
    expect(result.effectiveFeePerVsize).toBe(-1);
  });
  test('known zero fees are retained and incomplete live private data is refused', () => {
    const result = transactionUtils.extendMempoolTransaction({ ...tx(true), fee: '0', policy_vsize: 7000, effectiveFeePerVsize: 0 });
    expect(result.feePerVsize).toBe(0);
    expect(result.effectiveFeePerVsize).toBe(0);
    expect(() => transactionUtils.extendMempoolTransaction({ ...tx(false), fee: '-1', policy_vsize: 7000 })).toThrow('policy size');
    expect(() => transactionUtils.extendMempoolTransaction({ ...tx(false), fee: undefined, policy_vsize: 7000 })).toThrow('policy size');
  });
});
