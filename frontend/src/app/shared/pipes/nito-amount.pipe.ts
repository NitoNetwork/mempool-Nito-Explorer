import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { formatAmount, Nitoshi } from '../nito-money';

@Pipe({ name: 'nitoAmount', standalone: false })
export class NitoAmountPipe implements PipeTransform {
  constructor(@Inject(LOCALE_ID) private locale: string) {}
  transform(value: Nitoshi, digits = '1.8-8', scale = 8): string {
    return value == null ? '' : formatAmount(value, this.locale, digits, scale);
  }
}
