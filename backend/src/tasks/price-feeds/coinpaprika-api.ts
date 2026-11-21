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

  public url: string = 'https://api.coinpaprika.com/v1/tickers/nito-nito-coin?quotes=USD,EUR,GBP';
  public urlHist: string = 'https://api.coinpaprika.com/v1/tickers/nito-nito-coin/historical?start={START}&interval=1d';

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
      const response = await query('https://api.coinpaprika.com/v1/tickers/nito-nito-coin?quotes=USD,EUR,GBP');
      if (response && response['quotes']) {
        for (const cur of Object.keys(response['quotes'])) {
          this.cachedPrices[cur] = response['quotes'][cur]['price'];
        }
        // Derive other currencies from USD using approximate rates
        const usd = this.cachedPrices['USD'] || 0;
        if (usd > 0) {
          const rates: { [key: string]: number } = {
            CAD: 1.36, CHF: 0.88, AUD: 1.53, JPY: 149.5
          };
          for (const [cur, rate] of Object.entries(rates)) {
            this.cachedPrices[cur] = usd * rate;
          }
        }
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
        // Derive other currencies from USD using approximate rates
        const usd = price.price;
        if (usd > 0) {
          priceHistory[timestamp]['EUR'] = usd * 0.92;
          priceHistory[timestamp]['GBP'] = usd * 0.79;
          priceHistory[timestamp]['CAD'] = usd * 1.36;
          priceHistory[timestamp]['CHF'] = usd * 0.88;
          priceHistory[timestamp]['AUD'] = usd * 1.53;
          priceHistory[timestamp]['JPY'] = usd * 149.5;
        }
      }
    } catch (e) {}
    return priceHistory;
  }
}

export default CoinpaprikaApi;
