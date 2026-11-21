import { money, Nitoshi } from '@app/shared/nito-money';
import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Price } from '@app/services/price.service';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-fiat',
  templateUrl: './fiat.component.html',
  styleUrls: [],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiatComponent implements OnInit, OnDestroy {
  conversions$: Observable<any>;
  currencySubscription: Subscription;
  currency: string;

  @Input() value: Nitoshi;
  readonly money = money;
  @Input() digitsInfo = '1.2-2';
  @Input() blockConversion: Price;
  @Input() colorClass = 'green-color';

  constructor(
    private stateService: StateService,
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
    return conversions?.[this.currency] > 0 ? conversions[this.currency] : null;
  }

  ngOnInit(): void {
    this.conversions$ = this.stateService.conversions$.asObservable();
  }

  ngOnDestroy(): void {
    this.currencySubscription.unsubscribe();
  }

}
