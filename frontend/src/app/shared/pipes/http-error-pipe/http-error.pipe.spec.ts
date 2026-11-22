import { HttpErrorResponse } from '@angular/common/http';
import { HttpErrorPipe } from './http-error.pipe';

describe('HttpErrorPipe', () => {
  const pipe = new HttpErrorPipe();

  it('does not present an HTTP/2 OK status text as part of an error', () => {
    const error = new HttpErrorResponse({
      status: 503,
      statusText: 'OK',
      error: { error: 'Core and ElectrumX height mismatch; index data unavailable' },
    });

    expect(pipe.transform(error)).toBe('HTTP 503: Core and ElectrumX height mismatch; index data unavailable');
  });

  it('keeps a useful status text when the response has no message', () => {
    const error = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });

    expect(pipe.transform(error)).toBe('HTTP 404: Not Found');
  });

  it('describes connection failures without a misleading HTTP status', () => {
    const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });

    expect(pipe.transform(error)).toBe('Network error: Request failed');
  });
});
