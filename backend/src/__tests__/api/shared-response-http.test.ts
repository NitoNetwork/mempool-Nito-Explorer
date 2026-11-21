import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import publicResponses from '../../api/shared-response-cache';

async function withServer(handler: (req: Request, res: Response) => void,
  check: (url: string, seen: () => number) => Promise<void>): Promise<void> {
  const app = express();
  let requests = 0;
  app.use((_req, _res, next) => { requests++; next(); });
  app.use(publicResponses.middleware);
  app.use(handler);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await check(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, () => requests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

beforeEach(() => {
  publicResponses.unavailable();
  publicResponses.observe('tip-a', []);
});

test.each(['/api/v1/statistics/2h', '/api/v1/mining/blocks/rewards/1m'])('shares one exact common-data response for %s', async path => {
  let loads = 0;
  await withServer((_req, res) => {
    loads++;
    res.json({ total: '128456589000000000' });
  }, async url => {
    const replies = await Promise.all(Array.from({ length: 20 }, () => fetch(url + path)));
    expect(loads).toBe(1);
    for (const reply of replies) {
      expect(reply.headers.get('cache-control')).toBe('no-store');
      expect(await reply.json()).toEqual({ total: '128456589000000000' });
    }
  });
});

test('never shares authorized, queried, address or wallet requests', async () => {
  let loads = 0;
  await withServer((_req, res) => { res.json({ sequence: ++loads }); }, async url => {
    for (const path of ['/api/v1/statistics/2h?variant=1', '/api/v1/address/public-address', '/api/v1/wallet/example']) {
      const first = await (await fetch(url + path)).json();
      const second = await (await fetch(url + path)).json();
      expect(second.sequence).toBe(first.sequence + 1);
    }
    const first = await (await fetch(url + '/api/v1/statistics/2h', { headers: { Authorization: 'Bearer user-a' } })).json();
    const second = await (await fetch(url + '/api/v1/statistics/2h', { headers: { Authorization: 'Bearer user-b' } })).json();
    expect(second.sequence).toBe(first.sequence + 1);
  });
});

test('fences in-flight HTTP work and refuses stale data until the new snapshot is ready', async () => {
  let finish: (() => void) | undefined;
  let loads = 0;
  await withServer((_req, res) => {
    loads++;
    finish = () => res.json({ total: '9007199254740993' });
  }, async (url, seen) => {
    const path = '/api/v1/statistics/2h';
    const first = fetch(url + path);
    const second = fetch(url + path);
    while (seen() < 2 || !finish) { await new Promise(resolve => setTimeout(resolve, 1)); }
    expect(loads).toBe(1);
    publicResponses.unavailable();
    finish();
    for (const reply of await Promise.all([first, second])) {
      expect(reply.status).toBe(503);
      expect(reply.headers.get('retry-after')).toBe('1');
    }
    expect((await fetch(url + path)).status).toBe(503);
    expect(loads).toBe(1);
    publicResponses.observe('tip-b', []);
    finish = undefined;
    const fresh = fetch(url + path);
    while (!finish) { await new Promise(resolve => setTimeout(resolve, 1)); }
    (finish as () => void)();
    expect((await fresh).status).toBe(200);
    expect(loads).toBe(2);
  });
});
