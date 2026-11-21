jest.mock('../../utils/axios-query', () => ({
  query: jest.fn(),
}));

import { query } from '../../utils/axios-query';
import CoinpaprikaApi from '../../tasks/price-feeds/coinpaprika-api';

const queryMock = query as jest.MockedFunction<typeof query>;

describe('Nito Coinpaprika price feed', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test('uses the Nito ticker and serves only direct current quotes', async () => {
    queryMock.mockResolvedValueOnce({
      quotes: {
        USD: { price: 0.0000268 },
        EUR: { price: 0.0000244 },
        GBP: { price: 0.0000205 },
        CAD: { price: 0.0000376 },
      },
    }).mockResolvedValueOnce({
      quotes: {
        CHF: { price: 0.0000213 },
        AUD: { price: 0.0000412 },
        JPY: { price: 0.00419 },
      },
    });
    const feed = new CoinpaprikaApi();

    await expect(feed.$fetchPrice('USD')).resolves.toBe(0.0000268);
    await expect(feed.$fetchPrice('CAD')).resolves.toBe(0.0000376);
    await expect(feed.$fetchPrice('JPY')).resolves.toBe(0.00419);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls.map(call => call[0])).toEqual([
      'https://api.coinpaprika.com/v1/tickers/nito-nito-coin?quotes=USD,EUR,GBP,CAD',
      'https://api.coinpaprika.com/v1/tickers/nito-nito-coin?quotes=CHF,AUD,JPY',
    ]);
  });

  test('does not invent a quote that the provider omitted', async () => {
    queryMock
      .mockResolvedValueOnce({ quotes: { USD: { price: 0.0000268 } } })
      .mockResolvedValueOnce({ quotes: {} });
    const feed = new CoinpaprikaApi();

    await expect(feed.$fetchPrice('CAD')).resolves.toBe(-1);
  });

  test('keeps the primary Nito quote when an additional quote request fails', async () => {
    queryMock
      .mockResolvedValueOnce({ quotes: { USD: { price: 0.0000268 } } })
      .mockRejectedValueOnce(new Error('temporary provider failure'));
    const feed = new CoinpaprikaApi();

    await expect(feed.$fetchPrice('USD')).resolves.toBe(0.0000268);
    await expect(feed.$fetchPrice('CHF')).resolves.toBe(-1);
  });

  test('keeps historical data in its provider currency instead of estimating FX', async () => {
    queryMock.mockResolvedValue([{
      timestamp: '2026-11-21T00:00:00Z',
      price: 0.0000268,
    }]);
    const feed = new CoinpaprikaApi();

    const history = await feed.$fetchRecentPrice(['USD', 'EUR'], 'day');
    const point = history[Math.floor(new Date('2026-11-21T00:00:00Z').getTime() / 1000)];
    expect(point.USD).toBe(0.0000268);
    expect(point.EUR).toBe(-1);
    expect(point.CAD).toBe(-1);
  });
});
