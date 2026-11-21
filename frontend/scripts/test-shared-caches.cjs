/* Execute the real services with RxJS and controllable HTTP/WS events. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const rx = require('rxjs');

function loadService(file, name) {
  const context = { exports: {}, console, Date, setTimeout, clearTimeout, require: id => {
    if (id === 'rxjs') return rx;
    if (id === '@angular/core') return { Injectable: () => target => target };
    if (id === '@angular/common/http') return { HttpParams: class { append() { return this; } } };
    return {};
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/services', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText, context, { filename: file });
  return context.exports[name];
}
const ElectrsApiService = loadService('electrs-api.service.ts', 'ElectrsApiService');
const CacheService = loadService('cache.service.ts', 'CacheService');
function state() {
  return { isBrowser: true, env: { ROOT_NETWORK: 'mainnet' },
    networkChanged$: new rx.BehaviorSubject('mainnet'), blocks$: new rx.Subject(),
    chainTip$: new rx.Subject(), connectionState$: new rx.BehaviorSubject(2), nitoStatus$: new rx.BehaviorSubject({ available: true }) };
}
function http() {
  const requests = [];
  return { requests, get: url => new rx.Observable(observer => {
    const request = { url, observer, cancelled: false };
    requests.push(request);
    return () => { request.cancelled = true; };
  }) };
}
function reply(request, value) { request.observer.next(value); request.observer.complete(); }
const result = observable => rx.firstValueFrom(observable).then(value => ({ value }), error => ({ error }));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

(async () => {
  let s = state(), transport = http(), api = new ElectrsApiService(transport, s);
  const first = result(api.getTransaction$('a')), second = result(api.getTransaction$('a'));
  assert.equal(transport.requests.length, 1, 'concurrent visitors/components share one request');
  reply(transport.requests[0], { txid: 'a', fee: '9007199254740993', status: { confirmed: true } });
  assert.equal((await first).value.fee, '9007199254740993');
  assert.equal((await second).value.fee, '9007199254740993');
  const refreshedFirst = result(api.getTransaction$('a', true)), refreshedSecond = result(api.getTransaction$('a', true));
  assert.equal(transport.requests.length, 2, 'explicit reorg refresh bypasses completed data but shares its in-flight request');
  reply(transport.requests[1], { txid: 'a', fee: '9007199254740993', status: { confirmed: false } });
  assert.equal((await refreshedFirst).value.status.confirmed, false);
  assert.equal((await refreshedSecond).value.status.confirmed, false);
  const completedReference = api.getTransaction$('a');
  s.blocks$.next([{ id: 'old-tip', height: 10 }]);
  assert.match((await result(completedReference)).error.message, /snapshot/);
  const stale = result(api.getTransaction$('b'));
  const oldRequest = transport.requests.at(-1);
  s.blocks$.next([{ id: 'replacement-tip', height: 10 }]);
  assert(oldRequest.cancelled, 'same-height reorg aborts pending HTTP');
  reply(oldRequest, { txid: 'b', status: { confirmed: true } });
  assert.match((await stale).error.message, /snapshot/);
  const fresh = result(api.getTransaction$('b'));
  reply(transport.requests.at(-1), { txid: 'b', status: { confirmed: false } });
  assert.equal((await fresh).value.status.confirmed, false);
  const confirmed = result(api.getTransaction$('confirmed'));
  reply(transport.requests.at(-1), { txid: 'confirmed', status: { confirmed: true } });
  await confirmed;
  const beforeExtension = transport.requests.length;
  s.blocks$.next([{ id: 'tip-11', height: 11 }, { id: 'replacement-tip', height: 10 }]);
  assert.equal((await result(api.getTransaction$('confirmed'))).value.status.confirmed, true);
  assert.equal(transport.requests.length, beforeExtension, 'ordinary extension retains confirmed public responses');
  const beforeRegression = result(api.getTransaction$('before-regression'));
  const regressionRequest = transport.requests.at(-1);
  s.blocks$.next([{ id: 'replacement-tip', height: 10 }]);
  assert(regressionRequest.cancelled, 'height regression aborts pending HTTP even when the lower block was already cached');
  assert.match((await beforeRegression).error.message, /snapshot/);
  const beforeEmpty = result(api.getTransaction$('before-empty'));
  const beforeEmptyRequest = transport.requests.at(-1);
  s.blocks$.next([]);
  assert(beforeEmptyRequest.cancelled, 'an empty canonical reorg snapshot also aborts stale reads');
  assert.match((await beforeEmpty).error.message, /snapshot/);

  const delayed = api.getBlock$('old-network');
  s.networkChanged$.next('testnet');
  const before = transport.requests.length;
  assert.match((await result(delayed)).error.message, /snapshot/);
  assert.equal(transport.requests.length, before, 'old deferred observable cannot request the new network');
  const networkRequest = result(api.getBlock$('new-network'));
  assert.equal(transport.requests.at(-1).url, '/testnet/api/block/new-network');
  reply(transport.requests.at(-1), { id: 'new-network' });
  await networkRequest;

  const offline = result(api.getTransaction$('offline'));
  const offlineRequest = transport.requests.at(-1);
  s.nitoStatus$.next({ available: false }); // WebSocket is still connected.
  assert.equal(s.connectionState$.value, 2);
  assert(offlineRequest.cancelled);
  assert.match((await offline).error.message, /snapshot/);
  const unavailableCount = transport.requests.length;
  assert.match((await result(api.getBlock$('new-network'))).error.message, /snapshot/);
  assert.equal(transport.requests.length, unavailableCount, 'known outage cannot serve retained data or dispatch work');
  s.nitoStatus$.next({ available: true });
  const batch = result(api.cachedRequest(api.getOutspendsBatched$, 250, ['a']));
  s.connectionState$.next(0);
  assert.match((await batch).error.message, /snapshot/);
  assert(transport.requests.at(-1).cancelled);

  s = state();
  let attempts = 0;
  api = new ElectrsApiService({ get: () => rx.defer(() => ++attempts < 3 ? rx.throwError(() => ({ status: 503 })) : rx.of({ txid: 'retry' })) }, s);
  assert.equal((await result(api.getTransaction$('retry'))).value.txid, 'retry');
  assert.equal(attempts, 3, 'only two transient 503 retries');
  attempts = 0;
  api = new ElectrsApiService({ get: () => rx.defer(() => { attempts++; return rx.throwError(() => ({ status: 500 })); }) }, state());
  assert.equal((await result(api.getTransaction$('failed'))).error.status, 500);
  assert.equal(attempts, 1, 'non-transition errors are observable immediately');
  for (let i = 0; i < 300; i++) api.getTransaction$('bounded-' + i);
  assert.equal(api.publicCache.size, 256, 'unsubscribed unique requests cannot grow the public cache unbounded');

  s = state(); transport = http();
  const service = new CacheService(s, { blockAuditLoaded: {}, getBlocks$: height => transport.get('/blocks/' + height) });
  const tx = { txid: 'cached', status: { confirmed: true } };
  const pendingTx = { txid: 'pending', status: { confirmed: false } };
  service.setTxCache([tx]);
  assert.equal(service.getTxFromCache('cached'), tx);
  service.setTxCache([pendingTx]);
  s.blocks$.next([{ id: 'tip-100', height: 100 }]);
  assert.equal(service.getTxFromCache('cached'), tx, 'normal tips retain immutable confirmed transactions');
  assert.equal(service.getTxFromCache('pending'), null, 'normal tips discard only mutable unconfirmed transactions');
  service.setTxCache([tx]);
  s.blocks$.next([{ id: 'replacement-tip-100', height: 100 }]);
  assert.equal(service.getTxFromCache('cached'), null, 'same-height reorg clears confirmed transaction cache');
  s.blocks$.next([{ id: 'tip-102', height: 102 }, { id: 'replacement-tip-100', height: 100 }]);
  service.setTxCache([tx]);
  s.blocks$.next([{ id: 'replacement-tip-100', height: 100 }]);
  assert.equal(service.getTxFromCache('cached'), null, 'height regression clears confirmed transaction cache even when the lower block is known');
  const oldLoad = service.loadBlock(10);
  const oldBlockRequest = transport.requests.at(-1);
  s.nitoStatus$.next({ available: false });
  service.setTxCache([tx]);
  assert.equal(service.getTxFromCache('cached'), null);
  s.nitoStatus$.next({ available: true });
  const newLoad = service.loadBlock(10);
  const newBlockRequest = transport.requests.at(-1);
  reply(oldBlockRequest, [{ height: 10, id: 'obsolete' }]);
  await oldLoad;
  assert.equal(service.getCachedBlock(10), undefined);
  assert.equal(service.blockLoading[10], true, 'old completion must not clear the replacement request');
  reply(newBlockRequest, [{ height: 10, id: 'canonical' }]);
  await newLoad;
  assert.equal(service.getCachedBlock(10).id, 'canonical');
  service.setTxCache([tx]);
  s.connectionState$.next(0);
  assert.equal(service.getTxFromCache('cached'), null);
  assert.equal(service.getCachedBlock(10), undefined);
  await tick();
  console.log('PASS shared caches: exact sharing, normal-tip retention, same-height reorg, stale/deferred response fences, backend/WS outage, bounded 503 retries, historical block races');
})().catch(error => { console.error(error); process.exitCode = 1; });
