import { money, Nitoshi } from '@app/shared/nito-money';
import { Component, OnInit, OnDestroy, Input, Inject, LOCALE_ID, HostBinding, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Observable, Subscription } from 'rxjs';
import { Price } from '@app/services/price.service';

@Component({
  selector: 'app-amount',
  templateUrl: './amount.component.html',
  styleUrls: ['./amount.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AmountComponent implements OnInit, OnDestroy {
  conversions$: Observable<any>;
  currency: string;
  viewAmountMode$: Observable<'btc' | 'sats' | 'fiat'>;
  network = '';

  stateSubscription: Subscription;
  currencySubscription: Subscription;

  @Input() satoshis: Nitoshi;
  readonly money = money;
  @HostBinding("attr.title") get exactAmount(): string { return this.satoshis == null ? null : money.coins(this.satoshis) + " NITO"; }
  format(scale = 8): string {
    if (this.satoshis == null) { return ''; }
    // Large native values always expose every nitoshi, including in compact tables.
    const digits = scale === 0 ? '1.0-0' : money.compare(money.absolute(this.satoshis), Number.MAX_SAFE_INTEGER) > 0 ? '1.8-8' : this.digitsInfo;
    return money.format(this.satoshis, this.locale, digits, scale);
  }
  @Input() digitsInfo = '1.8-8';
  @Input() noFiat = false;
  @Input() addPlus = false;
  @Input() blockConversion: Price;
  @Input() forceBtc: boolean = false;
  @Input() ignoreViewMode: boolean = false;
  @Input() forceBlockConversion: boolean = false; // true = displays fiat price as 0 if blockConversion is undefined instead of falling back to conversions

  constructor(
    private stateService: StateService,
    @Inject(LOCALE_ID) private locale: string,
    private cd: ChangeDetectorRef,
  ) {
    this.currencySubscription = this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.currency = fiat;
      this.cd.markForCheck();
    });
  }

  rate(conversions: Record<string, number>): number | null {
    if (this.blockConversion) {
      const direct = this.blockConversion.price[this.currency];
      const usd = this.blockConversion.price.USD;
      const exchange = this.blockConversion.exchangeRates?.['USD' + this.currency];
      return direct > 0 ? direct : usd > 0 && exchange > 0 ? usd * exchange : null;
    }
    if (this.forceBlockConversion) { return null; }
    return conversions?.[this.currency] > 0 ? conversions[this.currency] : null;
  }

  ngOnInit() {
    this.viewAmountMode$ = this.stateService.viewAmountMode$.asObservable();
    this.conversions$ = this.stateService.conversions$.asObservable();
    this.stateSubscription = this.stateService.networkChanged$.subscribe((network) => this.network = network);
  }

  ngOnDestroy() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
    this.currencySubscription.unsubscribe();
  }

}
