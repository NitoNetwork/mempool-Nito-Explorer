import { query } from '../../utils/axios-query';
import { PriceFeed, PriceHistory } from '../price-updater';

function getEmptyPricesObj() {
  return {
    time: 0, USD: -1, EUR: -1, GBP: -1, CAD: -1, CHF: -1, AUD: -1, JPY: -1,
    BGN: -1, BRL: -1, CNY: -1, CZK: -1, DKK: -1, HKD: -1, HRK: -1, HUF: -1,
    IDR: -1, ILS: -1, INR: -1, ISK: -1, KRW: -1, MXN: -1, MYR: -1, NOK: -1,
    NZD: -1, PHP: -1, PLN: -1, RON: -1, RUB: -1, SEK: -1, SGD: -1, THB: -1,
    TRY: -1, ZAR: -1,
  };
}

class CoinpaprikaApi implements PriceFeed {
  public name: string = 'Coinpaprika';
  public currencies: string[] = ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY'];

  public url: string = 'https://api.coinpaprika.com/v1/tickers/nito-nito-coin?quotes=USD,EUR,GBP,CAD';
  public urlHist: string = 'https://api.coinpaprika.com/v1/tickers/nito-nito-coin/historical?start={START}&interval=1d';
  private additionalQuotesUrl: string = 'https://api.coinpaprika.com/v1/tickers/nito-nito-coin?quotes=CHF,AUD,JPY';

  private cachedPrices: { [key: string]: number } = {};
  private cacheTime: number = 0;

  constructor() {
  }

  /** @asyncSafe Network failures are contained and leave the cache unchanged. */
  private async fetchAllPrices(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheTime < 30000 && Object.keys(this.cachedPrices).length > 0) {
      return; // Cache valid for 30 seconds
    }

    try {
      const responses = await Promise.all([this.url, this.additionalQuotesUrl].map(async url => {
        try {
          return await query(url);
        } catch {
          return undefined;
        }
      }));
      let updated = false;
      for (const response of responses) {
        if (response && response['quotes']) {
          for (const cur of Object.keys(response['quotes'])) {
            this.cachedPrices[cur] = response['quotes'][cur]['price'];
            updated = true;
          }
        }
      }
      if (updated) {
        this.cacheTime = now;
      }
    } catch (e) {
      // Failed to fetch
    }
  }

  public async $fetchPrice(currency): Promise<number> {
    await this.fetchAllPrices();
    return this.cachedPrices[currency] ?? -1;
  }

  public async $fetchRecentPrice(currencies: string[], type: 'hour' | 'day'): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};
    try {
      const now = new Date();
      const start = new Date(now.getTime() - (type === 'hour' ? 24 * 3600000 : 30 * 86400000));
      const response = await query(this.urlHist.replace('{START}', start.toISOString()));
      const pricesRaw = response ? response : [];
      for (const price of pricesRaw as any[]) {
        const timestamp = Math.floor(new Date(price.timestamp).getTime() / 1000);
        if (priceHistory[timestamp] === undefined) {
          priceHistory[timestamp] = getEmptyPricesObj();
        }
        priceHistory[timestamp]['USD'] = price.price;
      }
    } catch (e) {}
    return priceHistory;
  }
}

export default CoinpaprikaApi;
