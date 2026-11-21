import { money, Nitoshi } from '@app/shared/nito-money';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'absolute',
  standalone: false,
})
export class AbsolutePipe implements PipeTransform {
  transform(nr: Nitoshi) {
    return typeof nr === "string" ? money.absolute(nr) : Math.abs(nr);
  }
}
