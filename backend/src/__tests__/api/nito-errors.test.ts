import { PRIVATE_ADDRESS_ERROR } from '../../api/nito-errors';

test('private address errors remain activation-neutral', () => {
  expect(PRIVATE_ADDRESS_ERROR).toBe('Private address balances are not public');
  expect(PRIVATE_ADDRESS_ERROR).not.toMatch(/Orchard|Bech32x/i);
});
