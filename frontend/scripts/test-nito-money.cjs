/* Focused regression coverage for the actual frontend money and transaction code. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require('@angular/compiler');
const frontend = path.resolve(__dirname, '..');
const loaded = new Map();
globalThis.window = { __env: {} };
globalThis.$localize = (parts, ...values) => parts.reduce((text, part, i) => text + part + (values[i] ?? ''), '');
function load(relative) {
  const file = path.resolve(frontend, relative);
  if (loaded.has(file)) { return loaded.get(file).exports; }
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  loaded.set(file, mod);
  const nativeRequire = mod.require.bind(mod);
  mod.require = (request) => {
    let target;
    if (request.startsWith('@app/')) { target = path.join(frontend, 'src/app', request.slice(5)); }
    else if (request.startsWith('@environments/')) { target = path.join(frontend, 'src/environments', request.slice(14)); }
    else if (request.startsWith('@components/')) { target = path.join(frontend, 'src/app/components', request.slice(12)); }
    else if (request.startsWith('@interfaces/')) { target = path.join(frontend, 'src/app/interfaces', request.slice(12)); }
    else if (request.startsWith('.')) { target = path.resolve(path.dirname(file), request); }
    if (target && fs.existsSync(target + '.ts')) { return load(target + '.ts'); }
    return nativeRequire(request);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, useDefineForClassFields: false },
  }).outputText, file);
  return mod.exports;
}
const { money } = load('src/app/shared/nito-money.ts');
const max = 128456589000000000n;
const boundaryValues = [0n, 1n, (2n ** 53n) - 1n, 2n ** 53n, (2n ** 53n) + 1n, max - 1n, max];
for (const n of boundaryValues) {
  const text = n.toString();
  assert.equal(money.atoms(text), n);
  assert.equal(money.fromCoins(money.coins(text)), text);
  assert.equal(money.format(text, 'en-US', '1.0-0', 0).replaceAll(',', ''), text);
  assert.equal(money.format(text).replaceAll(',', ''), money.coins(text));
  assert.equal(money.subtract(money.sum(text, '1'), '1'), text);
  assert.equal(JSON.parse(JSON.stringify({ value: text })).value, text);
}
assert.equal(money.format('9007199254740993'), '90,071,992.54740993');
assert.equal(money.format('9007199254740993', 'fr-FR'), '90\u202f071\u202f992,54740993');
assert.equal(money.format('-9007199254740993'), '-90,071,992.54740993');
assert.equal(money.fromCoins('1284565889.99999999'), (max - 1n).toString());
assert.equal(money.fromCoins('1e-8'), '1');
assert.equal(money.fromCoins('1.'), '100000000');
assert.equal(money.fromCoins('-0.00000001'), '-1');
assert.equal(money.compare('-1', 0), -1);
assert.equal(money.average('18014398509481987', 2), '9007199254740993');
assert.equal(money.sum(max.toString(), max.toString(), max.toString()), (max * 3n).toString());
assert.throws(() => money.atoms(Number(2n ** 53n)), /exact integer strings/);
assert.throws(() => money.fromCoins('0.000000001'), /Sub-nitoshi/);

const privateFeeTx = { fee: '70000', weight: 14288, vsize: 3572, has_private_bundle: true, policy_vsize: 7000 };
assert.equal(money.feeRate(privateFeeTx), 10);
assert.equal(money.feeRate({ ...privateFeeTx, policy_vsize: undefined }), -1);
assert.equal(money.feeRate({ ...privateFeeTx, fee: '-1' }), -1);
assert.equal(money.feeRate({ fee: '70000', weight: 28000 }), 10);
assert.equal(money.packageFeeRate([privateFeeTx, { fee: '10000', weight: 4000 }], true), -1);
assert.equal(money.packageFeeRate([privateFeeTx, { fee: '10000', policy_vsize: 1000 }], true), 10);
const { TxFeeRatingComponent } = load('src/app/components/tx-fee-rating/tx-fee-rating.component.ts');
const rating = new TxFeeRatingComponent({ env: { BLOCK_WEIGHT_UNITS: 4000000 } }, null, null);
rating.tx = { ...privateFeeTx, effectiveFeePerVsize: -1, policy_vsize: undefined };
rating.calculateRatings({ weight: 10000, extras: { medianFee: 1 } });
assert.equal(rating.feeRating, undefined);
rating.tx = privateFeeTx;
rating.calculateRatings({ weight: 10000, extras: { medianFee: 1 } });
assert.equal(rating.feeRating, 2);

const { WalletStats } = load('src/app/shared/wallet-stats.ts');
const stats = new WalletStats([
  { funded_txo_sum: max.toString(), spent_txo_sum: '9007199254740993', funded_txo_count: 1, spent_txo_count: 1, tx_count: 2 },
  { funded_txo_sum: max.toString(), spent_txo_sum: '0', funded_txo_count: 1, spent_txo_count: 0, tx_count: 1 },
], ['alice', 'bob']);
const before = stats.balance;
assert.equal(before, (2n * max - 9007199254740993n).toString());
const tx = { vin: [{ prevout: { scriptpubkey_address: 'alice', value: '9007199254740993' } }],
  vout: [{ scriptpubkey_address: 'bob', value: '9007199254740992' }] };
stats.addTx(tx);
assert.equal(stats.balance, (BigInt(before) - 1n).toString());
stats.removeTx(tx);
assert.equal(stats.balance, before);
assert.equal(stats.totalReceived, (max * 2n).toString());

const { decodeRawTransaction, serializeTransaction, uint8ArrayToHexString, encodePsbt, bigIntToBytes } = load('src/app/shared/transaction.utils.ts');
for (const value of boundaryValues) {
  const source = { version: 2, locktime: 0,
    vin: [{ txid: '00'.repeat(32), vout: 0xffffffff, scriptsig: '0101', sequence: 0xffffffff }],
    vout: [{ value: value.toString(), scriptpubkey: '51' }] };
  const hex = uint8ArrayToHexString(serializeTransaction(source, false));
  const decoded = decodeRawTransaction(hex, 'regtest').tx;
  assert.equal(decoded.vout[0].value, value.toString());
  assert.equal(uint8ArrayToHexString(serializeTransaction(decoded, false)), hex);
}
const unsigned = serializeTransaction({ version: 2, locktime: 0,
  vin: [{ txid: 'ab'.repeat(32), vout: 0, scriptsig: '', sequence: 0xffffffff }],
  vout: [{ value: '9007199254740993', scriptpubkey: '51' }] }, false);
const witnessUtxo = new Uint8Array([...bigIntToBytes(max, 8), 1, 0x51]);
const psbt = encodePsbt(unsigned, [new Map([[1, [{ keyData: new Uint8Array(), value: witnessUtxo }]]])], [new Map()]);
const decodedPsbt = decodeRawTransaction(uint8ArrayToHexString(psbt), 'regtest').tx;
assert.equal(decodedPsbt.vin[0].prevout.value, max.toString());
assert.equal(decodedPsbt.vout[0].value, '9007199254740993');

const { AddressTypeInfo, detectAddressType } = load('src/app/shared/address-utils.ts');
const { scriptPubKeyToAddress, addressToScriptPubKey } = load('src/app/shared/transaction.utils.ts');
const { getRegex } = load('src/app/shared/regex.utils.ts');
// Independent reference encoder declared as this test suite's own dev dependency.
const bitcoin = require('bitcoinjs-lib');
for (const [network, hrp] of [['mainnet', 'nito'], ['testnet', 'tn'], ['testnet4', 'tn'], ['signet', 'tn'], ['regtest', 'nrt']]) {
  for (const [script, type] of [['0014' + 'ab'.repeat(20), 'v0_p2wpkh'], ['0020' + 'cd'.repeat(32), 'v0_p2wsh'], ['5120' + 'ef'.repeat(32), 'v1_p2tr']]) {
    const address = bitcoin.address.toBech32(Buffer.from(script.slice(4), 'hex'), type === 'v1_p2tr' ? 1 : 0, hrp);
    assert.equal(scriptPubKeyToAddress(script, network).address, address);
    assert.equal(detectAddressType(address, network), type);
    assert.equal(new AddressTypeInfo(network, address).type, type);
    assert.equal(new AddressTypeInfo(network, address.toUpperCase()).type, type);
    assert.equal(getRegex('address', network).test(address), true);
    assert.deepEqual(addressToScriptPubKey(address, network), { scriptPubKey: script, type });
    assert.deepEqual(addressToScriptPubKey(address.toUpperCase(), network), { scriptPubKey: script, type });
    const raw = serializeTransaction({ version: 2, locktime: 0,
      vin: [{ txid: 'ab'.repeat(32), vout: 0, scriptsig: '', sequence: 0xffffffff }],
      vout: [{ value: max.toString(), scriptpubkey: script }] }, false);
    assert.equal(decodeRawTransaction(uint8ArrayToHexString(raw), network).tx.vout[0].scriptpubkey_address, address);
  }
  const privateAddress = hrp + '1x' + 'q'.repeat(100);
  assert.equal(detectAddressType(privateAddress, network), 'confidential');
  assert.equal(detectAddressType(privateAddress.toUpperCase(), network), 'confidential');
  assert.equal(addressToScriptPubKey(privateAddress, network).scriptPubKey, null);
  assert.equal(getRegex('address', network).test(privateAddress), false);
}
assert.equal(new AddressTypeInfo('regtest', 'nrt1qrwlz3gmtcm5k9x5hkw57f9r929mw0ymdzxdcl7').type, 'v0_p2wpkh');
assert.equal(new AddressTypeInfo('mainnet', 'nrt1qrwlz3gmtcm5k9x5hkw57f9r929mw0ymdzxdcl7').type, 'unknown');

const { uncompressTx, uncompressDeltaChange } = load('src/app/shared/common.utils.ts');
const wire = ['ab'.repeat(32), '9007199254740993', 250, max.toString(), 1, 0, 123, 0];
const compressed = JSON.parse(JSON.stringify(wire));
assert.equal(uncompressTx(compressed).fee, '9007199254740993');
assert.equal(uncompressTx(compressed).value, max.toString());
assert.equal(uncompressDeltaChange(0, { added: [compressed], removed: [], changed: [] }).added[0].value, max.toString());
const { TxBowtieGraphComponent } = load('src/app/components/tx-bowtie-graph/tx-bowtie-graph.component.ts');
const graph = new TxBowtieGraphComponent(null, null, { network: '' }, null, null, 'en-US');
graph.network = '';
graph.lineLimit = 1;
graph.tx = { fee: '9007199254740993', status: { confirmed: false },
  vin: [ { txid: '11'.repeat(32), prevout: { value: '9007199254740993' } },
    { txid: '22'.repeat(32), prevout: { value: '9007199254740993' } },
    { txid: '33'.repeat(32), prevout: { value: '9007199254740993' } } ],
  vout: [{ value: '9007199254740993' }, { value: '9007199254740993' }] };
graph.initGraph();
assert.equal(graph.outputData[0].displayValue, '9007199254740993');
assert.equal(graph.outputData[1].displayValue, '18014398509481986');
assert.equal(graph.inputData[1].displayValue, '18014398509481986');
assert.equal(graph.sumDisplayValues([{ displayValue: '1' }, { privateOrchard: true }]), undefined);
graph.tx.fee = '-1';
graph.initGraph();
assert.equal(graph.outputData.some(item => item.type === 'fee'), false);
graph.lineLimit = 10;
graph.tx = { ...graph.tx, has_private_bundle: true, private_bundle: { value_balance: '0.00000001' } };
graph.initGraph();
const privateSides = [...graph.inputData, ...graph.outputData].filter(item => item.privateOrchard);
assert.equal(privateSides.length, 2);
assert.deepEqual(privateSides.map(item => item.address), ['Private...', 'Private...']);
const { ScriptpubkeyTypePipe } = load('src/app/shared/pipes/scriptpubkey-type-pipe/scriptpubkey-type.pipe.ts');
assert.equal(new ScriptpubkeyTypePipe().transform('private_orchard'), 'Private');
const { BehaviorSubject } = require('rxjs');
const { WebsocketService } = load('src/app/services/websocket.service.ts');
const socket = Object.create(WebsocketService.prototype);
socket.stateService = {
  nitoStatus$: new BehaviorSubject({ available: true }),
  nitoActivation$: new BehaviorSubject(null),
  nitoPools$: new BehaviorSubject({ total: { chainValueNitoshi: max.toString() } }),
  recommendedFees$: new BehaviorSubject({ fastestFee: 10 }),
  mempoolBlocks$: new BehaviorSubject([{ totalFees: '70000' }]),
  connectionState$: new BehaviorSubject(2),
};
const assertUnavailable = () => {
  assert.equal(socket.stateService.nitoActivation$.value, null);
  assert.equal(socket.stateService.nitoPools$.value, null);
  assert.equal(socket.stateService.recommendedFees$.value, null);
  assert.deepEqual(socket.stateService.mempoolBlocks$.value, []);
};
socket.handleResponse({ nitoStatus: { available: false } });
assertUnavailable();
const live = { nitoPools: { total: { chainValueNitoshi: max.toString() } }, fees: { fastestFee: 10 }, 'mempool-blocks': [{ totalFees: '70000' }] };
socket.handleResponse({ ...live, nitoStatus: { available: false } });
assertUnavailable();
socket.handleResponse(live);
assertUnavailable();
socket.handleResponse({ ...live, nitoStatus: { available: true } });
assert.deepEqual(socket.stateService.nitoPools$.value, live.nitoPools);
assert.deepEqual(socket.stateService.recommendedFees$.value, live.fees);
assert.deepEqual(socket.stateService.mempoolBlocks$.value, live['mempool-blocks']);
const originalTimeout = globalThis.window.setTimeout;
globalThis.window.setTimeout = () => 0;
socket.goOffline();
globalThis.window.setTimeout = originalTimeout;
assertUnavailable();
assert.equal(socket.stateService.connectionState$.value, 0);
socket.stateService.isBrowser = false;
socket.stateService.rbfLatestSummary$ = new BehaviorSubject([]);
socket.apiService = { getRbfList$: () => require('rxjs').of([
  { tx: privateFeeTx, replaces: [{ tx: privateFeeTx }] },
  { tx: { ...privateFeeTx, policy_vsize: undefined }, replaces: [
    { tx: { ...privateFeeTx, fee: '-1', policy_vsize: undefined } }, { tx: privateFeeTx } ] },
]) };
socket.initRbfSummary().then(async () => {
  const [known, unknown] = socket.stateService.rbfLatestSummary$.value;
  assert.equal(known.oldVsize, 7000);
  assert.equal(known.newVsize, 7000);
  assert.equal(known.oldFee, '70000');
  assert.equal(unknown.oldVsize, -1);
  assert.equal(unknown.newVsize, -1);
  assert.equal(unknown.oldFee, '-1');
  const { orchardActivation$, isCoreOrchardActive, activationAwareText } = load('src/app/shared/nito-activation.ts');
  const coreActive = { status: 'active', activated: true, privateTxActivationHeight: 100, chain: 'regtest',
    blocks: 100, bestblockhash: 'ab'.repeat(32), source: 'core' };
  const networks = new BehaviorSubject('regtest');
  const tips = new BehaviorSubject([{ id: coreActive.bestblockhash, height: 100 }]);
  socket.stateService.orchardActivated$ = orchardActivation$(socket.stateService.nitoActivation$, networks, tips);
  socket.stateService.activeGoggles$ = new BehaviorSubject({ mode: 'and', filters: ['private_orchard', 'p2tr'], gradient: 'fee' });
  let displayedActive;
  const activationSubscription = socket.stateService.orchardActivated$.subscribe(value => { displayedActive = value; });
  const { BlockFiltersComponent } = load('src/app/components/block-filters/block-filters.component.ts');
  const filters = new BlockFiltersComponent(socket.stateService, { markForCheck() {} });
  filters.ngOnInit();
  const assertHidden = () => {
    assert.equal(displayedActive, false);
    assert.equal(filters.filterGroups.some(group => group.filters.some(filter => filter.key === 'private_orchard')), false);
    assert.deepEqual(filters.activeFilters, ['p2tr']);
  };
  assertHidden();
  // Height by itself never activates the feature, even above the announced threshold.
  socket.handleResponse({ nitoActivation: { ...coreActive, status: 'inactive', activated: false } });
  assertHidden();
  socket.handleResponse({ nitoActivation: coreActive });
  assert.equal(displayedActive, true);
  assert.equal(filters.activeFilters.includes('private_orchard'), true);
  networks.next('mainnet');
  assertHidden();
  networks.next('regtest');
  assert.equal(displayedActive, true);
  // Same-height reorg immediately invalidates the old activation snapshot.
  tips.next([{ id: 'cd'.repeat(32), height: 100 }]);
  assertHidden();
  socket.handleResponse({ nitoActivation: coreActive });
  assertHidden();
  // A new snapshot can arrive before its block; it is visible only once both agree.
  socket.handleResponse({ nitoActivation: { ...coreActive, blocks: 101, bestblockhash: 'ef'.repeat(32) } });
  assertHidden();
  tips.next([{ id: 'ef'.repeat(32), height: 101 }]);
  assert.equal(displayedActive, true);
  socket.handleResponse({ nitoStatus: { available: false }, nitoActivation: coreActive });
  assertHidden();
  assert.equal(socket.stateService.nitoActivation$.value, null);
  socket.handleResponse({ nitoActivation: coreActive });
  assertHidden();
  tips.next([{ id: coreActive.bestblockhash, height: 100 }]);
  socket.handleResponse({ nitoStatus: { available: true }, nitoActivation: coreActive });
  assert.equal(displayedActive, true);
  socket.handleResponse({ nitoActivation: { ...coreActive, status: 'unknown', activated: null } });
  assertHidden();
  assert.equal(isCoreOrchardActive({ ...coreActive, activated: 'true' }, 'regtest', tips.value[0]), false);
  assert.equal(isCoreOrchardActive({ ...coreActive, source: 'electrum' }, 'regtest', tips.value[0]), false);
  assert.equal(activationAwareText('Orchard policy error for Bech32x', false), 'private transaction policy error for private address');
  assert.equal(activationAwareText('Orchard', true), 'Orchard');
  // Core remains the authority for H-1 mempool admission: inactive UI cannot reject a valid raw transaction.
  const { TransactionRawComponent } = load('src/app/components/transaction/transaction-raw.component.ts');
  const preview = Object.create(TransactionRawComponent.prototype);
  preview.resetState = () => {};
  preview.offlineMode = false;
  preview.stateService = socket.stateService;
  preview.pushTxForm = { get: () => ({ value: '02000000000200' }) };
  let decodedCalls = 0;
  const accepted = { ...privateFeeTx, vout: [{ value: max.toString() }] };
  preview.apiService = { decodeNitoTransaction$: () => { decodedCalls++; return require('rxjs').of({ transaction: accepted, admission: { allowed: true } }); } };
  preview.processTransaction = transaction => { preview.transaction = transaction; };
  await preview.decodeTransaction();
  assert.equal(decodedCalls, 1);
  assert.equal(preview.transaction.vout[0].value, max.toString());
  assert.equal(preview.errorBroadcast, undefined);
  assert.equal(preview.error, undefined);

  // Render the actual relevant Angular templates, not a string replacement or replayed screenshot.
  const domino = require('domino');
  const dom = domino.createWindow('<!doctype html><html><body></body></html>', 'https://localhost/');
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.Node = dom.Node;
  globalThis.HTMLElement = dom.HTMLElement;
  const { TestBed } = require('@angular/core/testing');
  const { BrowserDynamicTestingModule, platformBrowserDynamicTesting } = require('@angular/platform-browser-dynamic/testing');
  const { Component, NO_ERRORS_SCHEMA, provideZonelessChangeDetection } = require('@angular/core');
  const { CommonModule } = require('@angular/common');
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const template = relative => fs.readFileSync(path.join(frontend, 'src/app', relative), 'utf8');
  const fixtures = [];
  const render = (source, context) => {
    class Harness { constructor() { Object.assign(this, context); } }
    Component({ selector: 'test-activation-view-' + fixtures.length, standalone: true, imports: [CommonModule],
      schemas: [NO_ERRORS_SCHEMA], template: source })(Harness);
    const fixture = TestBed.createComponent(Harness);
    fixture.detectChanges();
    fixtures.push(fixture);
    return fixture;
  };
  const poolTemplate = template('dashboard/dashboard.component.html').match(/<section[\s\S]*?<\/section>/)[0];
  const inactivePublicPools = { transparent: { chainValue: '1284565890.00000000' },
    total: { chainValue: '1284565890.00000000' }, blocks: 100, chain: 'regtest' };
  const publicPools$ = new BehaviorSubject(inactivePublicPools);
  const poolFixture = render(poolTemplate, { stateService: socket.stateService, nitoPools$: publicPools$ });
  const { TxFeaturesComponent } = load('src/app/components/tx-features/tx-features.component.ts');
  socket.stateService.network = 'regtest';
  const features = new TxFeaturesComponent(socket.stateService);
  features.tx = { ...accepted, vin: [], status: { confirmed: false } };
  features.ngOnChanges();
  const featureFixture = render(template('components/tx-features/tx-features.component.html'), features);
  const feesTemplate = template('components/fees-box/fees-box.component.html').match(/<p role="status">[\s\S]*?<\/p>/)[0];
  render(feesTemplate, { stateService: socket.stateService });
  const docsTemplate = template('docs/api-docs/api-docs.component.html').split('\n').find(line => line.includes('Bech32x Orchard'));
  render(docsTemplate, { stateService: socket.stateService });
  const tooltipTemplate = template('components/tx-bowtie-graph-tooltip/tx-bowtie-graph-tooltip.component.html')
    .split('\n').find(line => line.includes("stateService.orchardActivated$"));
  const tooltipFixture = render(tooltipTemplate, { stateService: socket.stateService });
  const privacyFixture = render(template('components/privacy-policy/privacy-policy.component.html'), {});
  const detailsTemplate = template('components/transaction/transaction-details/transaction-details.component.html').split('  <div class="row">')[0] + '</div>';
  render(detailsTemplate, { stateService: socket.stateService, tx: { ...accepted, private_metadata_status: 'incomplete' } });
  const { SearchFormComponent } = load('src/app/components/search-form/search-form.component.ts');
  const search = Object.create(SearchFormComponent.prototype);
  search.stateService = socket.stateService;
  search.navigate = () => { throw new Error('Private addresses must not request public history'); };
  search.search('nrt1x' + 'q'.repeat(100));
  assert.equal(search.privateAddressNotice, true);
  assert.equal(search.isSearching, false);
  const notice = template('components/search-form/search-form.component.html').split('\n').find(line => line.includes('privateAddressNotice'));
  const searchFixture = render(notice, search);
  const assertRendered = activated => {
    for (const fixture of fixtures) {
      fixture.detectChanges();
      if (fixture === searchFixture) {
        assert.equal(/Bech32x/.test(fixture.nativeElement.textContent), activated);
        assert.ok(fixture.nativeElement.textContent.includes('no public balance or transaction history'));
      } else if (fixture === tooltipFixture) {
        assert.equal(/Bech32x/.test(fixture.nativeElement.textContent), activated);
        assert.equal(/Private/.test(fixture.nativeElement.textContent), !activated);
      } else if (fixture === privacyFixture) {
        assert.doesNotMatch(fixture.nativeElement.textContent, /Orchard|Bech32x|nullifier/i);
        assert.match(fixture.nativeElement.textContent, /Private receivers and decrypted private notes/);
      } else {
        assert.equal(/Orchard/.test(fixture.nativeElement.textContent), activated, fixture.componentRef.componentType.name);
      }
    }
    assert.ok(poolFixture.nativeElement.textContent.includes('1284565890.00000000'));
    assert.equal(featureFixture.nativeElement.textContent.includes('Private'), !activated);
  };
  assertRendered(false);
  socket.handleResponse({ nitoActivation: coreActive });
  publicPools$.next({ ...inactivePublicPools, orchard: { chainValue: '0.00000000' } });
  assertRendered(true);
  tips.next([{ id: 'cd'.repeat(32), height: 99 }]);
  publicPools$.next(inactivePublicPools);
  assertRendered(false);
  socket.handleResponse({ nitoActivation: { ...coreActive, status: 'inactive', activated: false, blocks: 99, bestblockhash: 'cd'.repeat(32) } });
  assertRendered(false);
  for (const fixture of fixtures) { fixture.destroy(); }
  TestBed.resetTestingModule();

  // Exercise actual StateService construction at the mainnet root, where the
  // network name is the empty string and still must emit an initial value.
  const { StateService } = load('src/app/services/state.service.ts');
  Object.defineProperty(document, 'referrer', { value: '' });
  const storage = { getValue: key => key === 'view-amount-mode' ? 'fiat' : null, setValue() {}, removeItem() {} };
  const mainState = new StateService('browser', 'en-US', { events: new (require('rxjs').Subject)() }, storage);
  let mainNetwork, mainActivated;
  mainState.networkChanged$.subscribe(value => { mainNetwork = value; });
  mainState.orchardActivated$.subscribe(value => { mainActivated = value; });
  assert.equal(mainNetwork, '');
  assert.equal(mainState.viewAmountMode$.value, 'btc');
  const oldTip = { id: '11'.repeat(32), height: 110, tx_count: 1 };
  const ancestor = { id: '22'.repeat(32), height: 109, tx_count: 1 };
  const newTip = { id: '33'.repeat(32), height: 110, tx_count: 2 };
  const mainActivation = { ...coreActive, chain: 'main', blocks: 110, bestblockhash: oldTip.id };
  const realSocket = Object.create(WebsocketService.prototype);
  realSocket.stateService = mainState;
  const refreshes = [], confirmed = [];
  realSocket.websocketSubject = { next: value => refreshes.push(value) };
  mainState.txConfirmed$.subscribe(value => confirmed.push(value));
  const initialBlocks = [ancestor, oldTip];
  realSocket.handleResponse({ blocks: initialBlocks, nitoActivation: mainActivation });
  assert.equal(mainActivated, true);
  assert.equal(mainState.blocks[0].id, oldTip.id);
  assert.deepEqual(initialBlocks, [ancestor, oldTip]); // wire/cache arrays are not mutated
  realSocket.handleResponse({ block: newTip, txConfirmed: 'private-tx', nitoActivation: { ...mainActivation, bestblockhash: newTip.id } });
  assert.equal(mainState.blocks[0].id, newTip.id);
  assert.equal(mainState.blocks[0].tx_count, 2);
  assert.equal(mainState.latestBlockHeight, 110);
  assert.equal(mainActivated, true);
  assert.equal(refreshes.at(-1)['refresh-blocks'], true);
  assert.deepEqual(confirmed.at(-1), ['private-tx', newTip]);
  // A tracked transaction may confirm in a block already received by the UI.
  realSocket.handleResponse({ block: newTip, txConfirmed: 'second-tx' });
  assert.deepEqual(confirmed.at(-1), ['second-tx', newTip]);
  realSocket.handleResponse({ blocks: [ancestor], nitoActivation: { ...mainActivation, status: 'unknown', activated: null } });
  assert.equal(mainState.latestBlockHeight, 109);
  assert.equal(mainActivated, false);
  realSocket.handleResponse({ block: newTip, txConfirmed: 'private-tx', nitoActivation: { ...mainActivation, bestblockhash: newTip.id } });
  assert.equal(mainState.latestBlockHeight, 110);
  assert.equal(mainActivated, true);
  const lowerTip = { id: '44'.repeat(32), height: 108, tx_count: 1 };
  realSocket.handleResponse({ block: lowerTip });
  assert.equal(mainState.latestBlockHeight, 108);
  assert.equal(mainActivated, false);
  assert.deepEqual(confirmed.at(-1), [undefined, lowerTip]);
  realSocket.handleResponse({ blocks: [] });
  assert.equal(mainState.latestBlockHeight, -1);
  assert.deepEqual(mainState.blocks, []);
  assert.equal(mainActivated, false);
  realSocket.handleResponse({ blocks: [ancestor, newTip], nitoActivation: { ...mainActivation, bestblockhash: newTip.id } });
  assert.equal(mainState.latestBlockHeight, 110);
  assert.equal(mainActivated, true);

  // Recovery must restore the current snapshot even when no new block is mined.
  const recovery = { nitoActivation: { ...mainActivation, bestblockhash: newTip.id },
    nitoPools: { total: { chainValue: '1284565890.00000000' } }, fees: { fastestFee: 1 },
    'mempool-blocks': [{ blockVSize: 7000 }] };
  let recoveredFees, recoveredBlocks;
  const recoverySubscriptions = [mainState.recommendedFees$.subscribe(value => { recoveredFees = value; }),
    mainState.mempoolBlocks$.subscribe(value => { recoveredBlocks = value; })];
  realSocket.handleResponse({ nitoStatus: { available: false } });
  realSocket.handleResponse(recovery);
  assert.equal(mainActivated, false);
  assert.equal(mainState.nitoPools$.value, null);
  assert.equal(recoveredFees, null);
  assert.deepEqual(recoveredBlocks, []);
  realSocket.handleResponse({ nitoStatus: { available: true }, ...recovery });
  assert.equal(mainActivated, true);
  assert.equal(mainState.nitoPools$.value.total.chainValue, '1284565890.00000000');
  assert.equal(recoveredFees.fastestFee, 1);
  assert.equal(recoveredBlocks[0].blockVSize, 7000);
  recoverySubscriptions.forEach(subscription => subscription.unsubscribe());

  // Exercise the actual open-transaction lifecycle with controlled RPC responses.
  const rx = require('rxjs');
  const { TransactionComponent } = load('src/app/components/transaction/transaction.component.ts');
  const transaction = Object.create(TransactionComponent.prototype);
  const tracked = [], marks = [], requests = [];
  const confirmedTransaction = { txid: 'aa'.repeat(32), fee: '9007199254740993',
    status: { confirmed: true, block_height: 110, block_hash: oldTip.id, block_time: 1 }, price: { USD: 1 } };
  Object.assign(transaction, { network: '', transactionNetwork: '', txId: confirmedTransaction.txid,
    tx: confirmedTransaction, latestBlock: oldTip, reorgRefresh$: new rx.Subject(), txChanged$: new rx.Subject(),
    cacheService: { getTxFromCache: () => confirmedTransaction },
    electrsApiService: { getTransaction$: (txid, refresh) => { const response = new rx.Subject(); requests.push({ txid, refresh, response }); return response; } },
    stateService: { markBlock$: { next: value => marks.push(value) } },
    websocketService: { stopTrackingTransaction: () => tracked.push('stop'), startMultiTrackTransaction: txid => tracked.push(txid) },
    audioService: { playSound() {} }, fetchAcceleration$: new rx.Subject(), fetchMiningInfo$: new rx.Subject(),
    seoService: { logSoft404() {} }, pool: { id: 1 }, auditStatus: { seen: true },
  });
  const lifecycle = transaction.reorgRefresh$.pipe(rx.switchMap(() => transaction.loadTransactionForView$(true)))
    .subscribe(tx => { if (tx) { transaction.tx = tx; transaction.isLoadingTx = false; } });
  transaction.onCanonicalBlocks([{ id: '55'.repeat(32), height: 180 }]);
  assert.equal(requests.length, 0, 'a confirmation leaving the rolling window is still confirmed');
  transaction.onCanonicalBlocks([newTip, ancestor]);
  assert.equal(transaction.tx.status.confirmed, false);
  assert.equal(transaction.tx.price, undefined);
  assert.equal(transaction.pool, null);
  assert.equal(transaction.auditStatus, null);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].refresh, true, 'a proven orphan bypasses completed cached confirmation');
  assert.deepEqual(tracked, ['stop', confirmedTransaction.txid]);
  transaction.onCanonicalBlocks([newTip, ancestor]);
  assert.equal(requests.length, 1, 'duplicate snapshots cannot create a refresh loop');
  requests[0].response.next({ ...confirmedTransaction, status: { confirmed: false }, price: undefined });
  requests[0].response.complete();
  assert.equal(transaction.tx.fee, '9007199254740993');
  transaction.onTransactionConfirmed(confirmedTransaction.txid, { ...newTip, extras: { pool: { id: 2 } } });
  assert.equal(transaction.tx.status.confirmed, true);
  assert.equal(transaction.tx.status.block_hash, newTip.id);
  assert.equal(transaction.pool.id, 2);
  transaction.onCanonicalBlocks([ancestor]);
  assert.equal(transaction.tx.status.confirmed, false, 'rollback below confirmation returns the open view to pending');
  assert.equal(requests.length, 2);
  requests[1].response.error(new Error('Chain snapshot changed; retry'));
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(requests.length, 3, 'an intervening replacement block retries against a fresh generation');
  requests[2].response.next({ ...confirmedTransaction, status: { confirmed: false }, price: undefined });
  requests[2].response.complete();
  transaction.onTransactionConfirmed(confirmedTransaction.txid, { ...newTip, extras: { pool: { id: 2 } } });
  transaction.onCanonicalBlocks([newTip, ancestor]);
  transaction.onCanonicalBlocks([ancestor]);
  assert.equal(requests.length, 4, 'the same block can be detached again after reconfirmation');
  assert.equal(transaction.tx.status.confirmed, false);
  requests[3].response.next({ ...confirmedTransaction, status: { confirmed: false }, price: undefined });
  requests[3].response.complete();
  transaction.onTransactionConfirmed(confirmedTransaction.txid, { ...newTip, extras: { pool: { id: 2 } } });
  transaction.network = 'regtest';
  transaction.onCanonicalBlocks([]);
  assert.equal(requests.length, 4, 'a network change must not refresh the previous network transaction');
  lifecycle.unsubscribe();
  let refreshAttempts = 0;
  transaction.electrsApiService = { getTransaction$: () => { refreshAttempts++; return rx.throwError(() => new Error('Chain snapshot changed; retry')); } };
  assert.equal(await rx.firstValueFrom(transaction.loadTransactionForView$(true)), false);
  assert.equal(refreshAttempts, 3, 'continuous chain changes exhaust the bounded refresh instead of looping');

  transaction.tx = { ...privateFeeTx, status: { confirmed: false } };
  transaction.cpfpInfo = null;
  transaction.setCpfpInfo({ ancestors: [], adjustedVsize: 3687, sigops: 0, effectiveFeePerVsize: 10 });
  assert.equal(transaction.adjustedVsize, 7000, 'CPFP metadata cannot replace the Core private policy size with serialized size');
  delete transaction.tx.policy_vsize;
  transaction.setCpfpInfo({ ancestors: [], adjustedVsize: 3687, sigops: 0 });
  assert.equal(transaction.adjustedVsize, null, 'unknown private policy size stays unknown');

  // Disabled fiat remains absent from real selector templates, including a saved fiat preference.
  const { UntypedFormBuilder } = require('@angular/forms');
  const { AmountSelectorComponent } = load('src/app/components/amount-selector/amount-selector.component.ts');
  const { FiatSelectorComponent } = load('src/app/components/fiat-selector/fiat-selector.component.ts');
  const amountSelector = new AmountSelectorComponent(new UntypedFormBuilder(), mainState, storage);
  amountSelector.ngOnInit();
  assert.deepEqual(amountSelector.modes, ['btc', 'sats']);
  amountSelector.amountForm.get('mode').setValue('fiat');
  amountSelector.changeMode();
  assert.equal(mainState.viewAmountMode$.value, 'btc');
  const fiatSelector = new FiatSelectorComponent(new UntypedFormBuilder(), mainState, storage);
  fiatSelector.ngOnInit();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const amountFixture = render(template('components/amount-selector/amount-selector.component.html'), amountSelector);
  const fiatFixture = render(template('components/fiat-selector/fiat-selector.component.html'), fiatSelector);
  assert.deepEqual(Array.from(amountFixture.nativeElement.querySelectorAll('option')).map(option => option.value), ['btc', 'sats']);
  assert.equal(!!fiatFixture.nativeElement.querySelector('select'), false);
  amountFixture.destroy(); fiatFixture.destroy();
  mainState.env.HISTORICAL_PRICE = true;
  const enabledAmountFixture = render(template('components/amount-selector/amount-selector.component.html'), amountSelector);
  const enabledFiatFixture = render(template('components/fiat-selector/fiat-selector.component.html'), fiatSelector);
  assert.ok(enabledAmountFixture.nativeElement.querySelector('option[value="fiat"]'));
  assert.ok(enabledFiatFixture.nativeElement.querySelector('select'));
  enabledAmountFixture.destroy(); enabledFiatFixture.destroy();
  TestBed.resetTestingModule();
  filters.ngOnDestroy();
  activationSubscription.unsubscribe();
  console.log('PASS frontend exact money and activation: boundaries/raw/PSBT/WS, wallet updates, bowtie, SSR RBF, same-tip outage recovery, actual filters, Core flag+network+tip/reorg fencing, H-1 raw admission, rendered Angular views, mainnet initialization, repeated reorg/reconfirmation with bounded fresh reads, private policy size, disabled fiat selectors');
}).catch(error => { console.error(error); process.exitCode = 1; });
