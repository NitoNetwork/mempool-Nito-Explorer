import { HttpErrorResponse } from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'httpErrorMsg',
  standalone: false,
})
export class HttpErrorPipe implements PipeTransform {
  transform(e: HttpErrorResponse | null): string {
    if (!e) {
      return '';
    }

    const responseMessage = typeof e.error === 'string' ? e.error : e.error?.error;
    const usefulStatusText = e.statusText && !/^(?:OK|Unknown Error)$/i.test(e.statusText)
      ? e.statusText
      : '';
    const message = responseMessage || usefulStatusText || 'Request failed';

    return e.status > 0
      ? `HTTP ${e.status}: ${message}`
      : `Network error: ${message}`;
  }
}
