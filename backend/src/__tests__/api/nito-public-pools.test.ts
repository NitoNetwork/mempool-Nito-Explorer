import { publicNitoPools } from '../../api/nito-public-pools';

const hash = 'ab'.repeat(32);
const activation = (active: boolean) => ({
  status: active ? 'active' as const : 'inactive' as const,
  activated: active,
  privateTxActivationHeight: 110,
  chain: 'regtest', blocks: 110, bestblockhash: hash, source: 'core' as const,
});
const pools = (active: boolean) => ({
  status: 'confirmed', source: 'core', includes_mempool: false, activated: active,
  privateTxActivationHeight: 110, chain: 'regtest', blocks: 110, bestblockhash: hash,
  transparent: { monitored: true, chainValueNitoshi: '9007199254740993', chainValue: '90071992.54740993' },
  orchard: { monitored: true, chainValueNitoshi: '1', chainValue: '0.00000001' },
  total: { monitored: true, chainValueNitoshi: '9007199254740994', chainValue: '90071992.54740994' },
});

test('omits every Orchard field and word before Core activation', () => {
  const result = publicNitoPools(pools(false), activation(false));
  expect(result).not.toBeNull();
  expect(result).not.toHaveProperty('orchard');
  expect(JSON.stringify(result)).not.toMatch(/orchard/i);
  expect(result.total.chainValueNitoshi).toBe('9007199254740994');
});

test('includes exact Orchard accounting immediately after qualified activation', () => {
  const result = publicNitoPools(pools(true), activation(true));
  expect(result.orchard.chainValueNitoshi).toBe('1');
  expect(JSON.stringify(result)).toMatch(/orchard/i);
});

test('fails closed for unknown or incoherent activation state', () => {
  expect(publicNitoPools(pools(false), { ...activation(false), status: 'unknown', activated: null })).toBeNull();
  expect(publicNitoPools(pools(true), { ...activation(true), bestblockhash: 'cd'.repeat(32) })).toBeNull();
});
