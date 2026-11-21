import { formatCurrency, getCurrencySymbol } from '@angular/common';
import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';

@Pipe({
  name: 'fiatCurrency',
  standalone: false,
})
export class FiatCurrencyPipe implements PipeTransform {
  fiatSubscription: Subscription;
  currency: string;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private stateService: StateService,
  ) {
    this.fiatSubscription = this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.currency = fiat;
    });
  }

  transform(num: number, ...args: any[]): unknown {
    const currency = args[1] || this.currency || 'USD';
    // For small prices (like NITO), show more significant digits
    const absNum = Math.abs(num);
    let maxFractionDigits = 2;
    let minFractionDigits = 2;
    if (absNum > 0 && absNum < 0.01) {
      maxFractionDigits = 8;
      minFractionDigits = 2;
    } else if (absNum >= 0.01 && absNum < 1) {
      maxFractionDigits = 4;
      minFractionDigits = 2;
    }
    return new Intl.NumberFormat(this.locale, { style: 'currency', currency, minimumFractionDigits: minFractionDigits, maximumFractionDigits: maxFractionDigits }).format(num);
  }
}
