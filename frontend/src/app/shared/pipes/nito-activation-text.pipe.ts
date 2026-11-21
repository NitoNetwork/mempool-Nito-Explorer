import { Pipe, PipeTransform } from '@angular/core';
import { activationAwareText } from '@app/shared/nito-activation';

@Pipe({ name: 'nitoActivationText', standalone: false })
export class NitoActivationTextPipe implements PipeTransform {
  transform(text: string | null | undefined, activated: boolean): string {
    return activationAwareText(text, activated === true);
  }
}
