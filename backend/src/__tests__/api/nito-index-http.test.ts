import express from 'express';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { IndexUnavailableError } from '../../api/bitcoin/index-unavailable-error';
import { handleIndexUnavailable } from '../../utils/api';

test('inconsistent index responses are explicitly temporary, uncacheable and retryable over HTTP', async () => {
  const app = express();
  app.get('/address', (req, res) => {
    handleIndexUnavailable(req, res, new IndexUnavailableError('Chain tip changed during index read; retry'));
  });
  app.get('/invalid', (req, res) => {
    if (!handleIndexUnavailable(req, res, new Error('Invalid Bitcoin address'))) { res.status(400).send('Invalid Bitcoin address'); }
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(url + '/address', { headers: { Accept: 'application/json' } });
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('1');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Chain tip changed during index read; retry' });
    expect((await fetch(url + '/invalid')).status).toBe(400);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
