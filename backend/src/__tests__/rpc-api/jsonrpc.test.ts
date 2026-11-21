import http from 'http';
import type { AddressInfo, Socket } from 'net';

const { JsonRPC } = require('../../rpc-api/jsonrpc');

describe('JsonRPC connection pooling', () => {
  let server: http.Server;
  let rpc;
  let connectionCount = 0;
  const sockets = new Set<Socket>();

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', chunk => body += chunk);
      request.on('end', () => {
        const payload = JSON.parse(body);
        if (payload.method === 'no-headers') { return; }
        if (['headers-stall', 'trickle', 'aborted'].includes(payload.method)) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.flushHeaders();
          if (payload.method === 'trickle') {
            const timer = setInterval(() => response.write(' '), 20);
            response.on('close', () => clearInterval(timer));
          } else if (payload.method === 'aborted') {
            response.write('{"result":');
            setImmediate(() => response.destroy());
          }
          return;
        }
        const result = JSON.stringify({ id: payload.id, result: payload.method, error: null });
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(result),
        });
        response.end(result);
      });
    });
    server.on('connection', socket => {
      connectionCount++;
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

    const address = server.address() as AddressInfo;
    rpc = new JsonRPC({ host: '127.0.0.1', port: address.port, timeout: 5000 });
  });

  afterAll(async () => {
    rpc.close();
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  test('reuses one socket for sequential RPC calls', async () => {
    for (let call = 0; call < 25; call++) {
      await expect(rpc.call(`method-${call}`, [])).resolves.toBe(`method-${call}`);
    }

    expect(connectionCount).toBe(1);
  });

  test.each(['no-headers', 'headers-stall', 'trickle'])('bounds the complete %s response and recovers', async method => {
    const address = server.address() as AddressInfo;
    const bounded = new JsonRPC({ host: '127.0.0.1', port: address.port, timeout: 200 });
    try {
      await expect(bounded.call(method, [])).rejects.toMatchObject({ code: expect.stringMatching(/TIMEDOUT$/) });
      await expect(bounded.call('recovered', [])).resolves.toBe('recovered');
    } finally { bounded.close(); }
  });

  test('rejects an interrupted response immediately and recovers', async () => {
    const address = server.address() as AddressInfo;
    const bounded = new JsonRPC({ host: '127.0.0.1', port: address.port, timeout: 1000 });
    try {
      await expect(bounded.call('aborted', [])).rejects.toMatchObject({ code: 'ECONNRESET' });
      await expect(bounded.call('recovered', [])).resolves.toBe('recovered');
    } finally { bounded.close(); }
  });
});
