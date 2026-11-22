jest.mock('../../database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));
jest.mock('../../config', () => ({
  __esModule: true,
  default: { FIAT_PRICE: { API_KEY: '' } },
}));
jest.mock('../../tasks/price-updater', () => ({
  __esModule: true,
  default: { getEmptyPricesObj: jest.fn() },
}));

import DB from '../../database';
import PricesRepository, { ApiPrice } from '../../repositories/PricesRepository';

const queryMock = DB.query as jest.MockedFunction<typeof DB.query>;
const prices = {
  USD: 0.0000268,
  EUR: 0.0000244,
  GBP: 0.0000205,
  CAD: 0.0000376,
  CHF: 0.0000213,
  AUD: 0.0000412,
  JPY: 0.00419,
} as ApiPrice;

describe('idempotent Nito price persistence', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test('reports a new hourly price as inserted', async () => {
    queryMock.mockResolvedValueOnce([{}, []] as never);

    await expect(PricesRepository.$savePrices(1795219200, { ...prices })).resolves.toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  test('treats an existing timestamp as a successful no-op', async () => {
    const duplicate = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY', errno: 1062 });
    queryMock.mockRejectedValueOnce(duplicate);

    await expect(PricesRepository.$savePrices(1795219200, { ...prices })).resolves.toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  test('still propagates database failures unrelated to a duplicate timestamp', async () => {
    queryMock.mockRejectedValueOnce(new Error('connection lost'));

    await expect(PricesRepository.$savePrices(1795219200, { ...prices })).rejects.toThrow('connection lost');
  });
});
