const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function evaluate(file, imports = {}, env = {}) {
  const context = { exports: {}, window: { __env: env }, require: request => {
    if (imports[request]) { return imports[request]; }
    return new Proxy({}, { get: () => class {} });
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText, context, { filename: file });
  return context.exports;
}
const features = evaluate('frontend/src/app/shared/feature-routes.ts');
const apiDocs = [
  { fragment: 'get-price' },
  { fragment: 'get-historical-price' },
  { fragment: 'get-block-audit-score' },
  { fragment: 'get-blocks-audit-scores' },
  { fragment: 'get-block-audit-summary' },
  { fragment: 'how-do-block-audits-work' },
  { fragment: 'get-block' },
];
assert.equal(features.configuredApiDocs(apiDocs, {}).map(item => item.fragment).join(','), 'get-block');
assert.equal(
  features.configuredApiDocs(apiDocs, { HISTORICAL_PRICE: true }).map(item => item.fragment).join(','),
  'get-price,get-historical-price,get-block',
);
assert.equal(
  features.configuredApiDocs(apiDocs, { AUDIT: true }).map(item => item.fragment).join(','),
  'get-block-audit-score,get-blocks-audit-scores,get-block-audit-summary,how-do-block-audits-work,get-block',
);
assert.equal(
  features.configuredApiDocs(apiDocs, { HISTORICAL_PRICE: true, AUDIT: true }).map(item => item.fragment).join(','),
  apiDocs.map(item => item.fragment).join(','),
);
for (const file of ['components/transaction/transaction.component.html', 'components/block/block.component.html']) {
  const template = fs.readFileSync(path.join(root, 'frontend/src/app', file), 'utf8');
  const expression = /href="{{ (.*?) }}\/api\//.exec(template)[1];
  const apiPrefix = new Function('network', 'stateService', 'return ' + expression);
  assert.equal(apiPrefix('regtest', { env: { ROOT_NETWORK: 'regtest' } }), '');
  assert.equal(apiPrefix('testnet', { env: { ROOT_NETWORK: 'mainnet' } }), '/testnet');
  assert.equal(apiPrefix('', { env: { ROOT_NETWORK: 'mainnet' } }), '');
}
function routes(file, env) {
  let result;
  evaluate(file, {
    '@app/shared/feature-routes': features,
    '@angular/core': { NgModule: () => target => target },
    '@angular/router': { RouterModule: { forChild: value => { result = value; } } },
  }, env);
  return result;
}
function paths(routes, prefix = '') {
  return routes.flatMap(route => {
    const here = [prefix, route.path].filter(Boolean).join('/');
    return [here, ...paths(route.children || [], here)];
  });
}
const files = ['master-page.module.ts', 'graphs/graphs.routing.module.ts', 'previews.routing.module.ts'];
const sample = JSON.parse(fs.readFileSync(path.join(root, 'frontend/mempool-frontend-config.sample.json'), 'utf8'));
for (const field of ['LIGHTNING', 'LIQUID_ENABLED', 'LIQUID_TESTNET_ENABLED', 'ACCELERATOR', 'PUBLIC_ACCELERATIONS', 'STRATUM_ENABLED', 'WALLETS_ENABLED', 'HISTORICAL_PRICE', 'AUDIT']) {
  assert.equal(sample[field], false, field + ' must be disabled in the delivered Nito profile');
}
const configured = { ...sample, LIGHTNING: true, ACCELERATOR: true, STRATUM_ENABLED: true,
  WALLETS_ENABLED: true, HISTORICAL_PRICE: true, AUDIT: true, OFFICIAL_MEMPOOL_SPACE: true };
const disabledPaths = files.flatMap(file => paths(routes('frontend/src/app/' + file, sample)));
const configuredPaths = files.flatMap(file => paths(routes('frontend/src/app/' + file, configured)));
for (const forbidden of ['lightning', 'graphs/lightning', 'acceleration', 'acceleration/list/:page', 'graphs/acceleration/fees',
  'wallet/:wallet', 'treasuries', 'stratum', 'graphs/price', 'graphs/mining/block-health']) {
  assert.equal(disabledPaths.includes(forbidden), false, forbidden + ' is reachable while unconfigured');
  assert.equal(configuredPaths.includes(forbidden), true, forbidden + ' must retain its explicit configuration gate');
}
for (const retained of ['tx', 'block', 'address/:id', 'rbf', 'blocks/:page', 'mining', 'graphs/mining/block-fees',
  'graphs/mining/block-fees-subsidy', 'graphs/mining/block-rewards', 'tools/calculator']) {
  assert.equal(disabledPaths.includes(retained), true, retained + ' must remain functional');
}
const source = ts.createSourceFile('config.ts', fs.readFileSync(path.join(root, 'backend/src/config.ts'), 'utf8'), ts.ScriptTarget.ES2022, true);
let defaults;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'defaults') { defaults = node.initializer; }
  ts.forEachChild(node, visit);
}
visit(source);
function setting(...keys) {
  let node = defaults;
  for (const key of keys) { node = node.properties.find(prop => prop.name.text === key).initializer; }
  return node.getText(source);
}
assert.equal(setting('FIAT_PRICE', 'ENABLED'), 'false');
assert.equal(setting('MEMPOOL', 'RUST_GBT'), 'false');
assert.equal(setting('MEMPOOL', 'AUTOMATIC_POOLS_UPDATE'), 'false');
assert.equal(setting('MEMPOOL', 'POOLS_JSON_TREE_URL'), "''");
for (const file of ['mempool-config.json.sample', 'backend/mempool-config.sample.json']) {
  const config = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  assert.equal(config.FIAT_PRICE.ENABLED, false);
  assert.equal(config.MEMPOOL.RUST_GBT, false);
  assert.equal(config.MEMPOOL.AUTOMATIC_POOLS_UPDATE, false);
  assert.equal(config.MEMPOOL.POOLS_JSON_TREE_URL, '');
}
const entrypoint = fs.readFileSync(path.join(root, 'docker/backend/start.sh'), 'utf8');
const configRenderer = fs.readFileSync(path.join(root, 'docker/backend/render-config.mjs'), 'utf8');
for (const key of ['FIAT_PRICE_ENABLED', 'MEMPOOL_RUST_GBT', 'MEMPOOL_AUTOMATIC_POOLS_UPDATE']) {
  assert.ok(configRenderer.includes(key + ': false'));
}
assert.ok(entrypoint.includes('render-config.mjs'));
assert.equal(entrypoint.includes('sed -i'), false);
const emission = evaluate('frontend/src/app/shared/nito-emission.ts');
for (const [height, before, after] of [[530000,512,256], [1042400,256,128], [1576800,128,64],
  [5256000,64,32], [10512000,32,16], [26280000,16,2], [105120001,2,0]]) {
  assert.equal(emission.getNitoSubsidy(height - 1), before * 100000000);
  assert.equal(emission.getNitoSubsidy(height), after * 100000000);
  assert.equal(emission.getNextHalvingHeight(height - 1), height);
}
assert.equal(emission.getNextHalvingHeight(105120001), -1);
assert.equal(emission.getSubsidyAfterHalving(105120001), 0);

const constantsSource = fs.readFileSync(path.join(root, 'frontend/src/app/app.constants.ts'), 'utf8');
assert.equal(constantsSource.includes('Genesis of Bitcoin'), false);
assert.equal(constantsSource.includes("Bitcoin's 1st Halving"), false);
assert.ok(constantsSource.includes('export const specialBlocks'));

const codeTemplate = fs.readFileSync(path.join(root, 'frontend/src/app/docs/code-template/code-template.component.html'), 'utf8');
const codeTemplateComponent = fs.readFileSync(path.join(root, 'frontend/src/app/docs/code-template/code-template.component.ts'), 'utf8');
assert.equal(codeTemplate.includes('CommonJS'), false);
assert.equal(codeTemplate.includes('ES Module'), false);
assert.equal(codeTemplateComponent.includes('@mempool/mempool.js'), false);
const githubUrls = [...codeTemplateComponent.matchAll(/https:\/\/github\.com\/[^'`"\s]+/g)].map(match => match[0]);
assert.ok(githubUrls.length > 0);
assert.deepEqual(new Set(githubUrls), new Set(['https://github.com/NitoNetwork/mempool-Nito-Explorer']));

const apiDocsData = fs.readFileSync(path.join(root, 'frontend/src/app/docs/api-docs/api-docs-data.ts'), 'utf8');
assert.equal(apiDocsData.includes('nito.exchange'), false);
assert.ok(apiDocsData.includes('https://github.com/NitoNetwork/Nito-core/blob/1d81bbd5f79d6b857c80420d5c81915ea326adff/src/merkleblock.h'));

const addressTemplate = fs.readFileSync(path.join(root, 'frontend/src/app/components/address/address.component.html'), 'utf8');
assert.equal(addressTemplate.includes('mempool.space/address'), false);
assert.equal(addressTemplate.includes('mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion'), false);
const transactionListTemplate = fs.readFileSync(path.join(root, 'frontend/src/app/components/transactions-list/transactions-list.component.html'), 'utf8');
const stateService = fs.readFileSync(path.join(root, 'frontend/src/app/services/state.service.ts'), 'utf8');
assert.equal(transactionListTemplate.includes('mempool.space/address'), false);
assert.equal(stateService.includes('mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion'), false);

const openGraphService = fs.readFileSync(path.join(root, 'frontend/src/app/services/opengraph.service.ts'), 'utf8');
assert.ok(openGraphService.includes('/resources/previews/nito-explorer-preview.png'));
assert.equal(openGraphService.includes('mempool.space/resources/previews'), false);

for (const removed of ['mempool-logo-bigger.png', 'mempool-space-logo-bigger.png', 'mempool-space-logo-horizontal.png',
  'mempool-space-preview.png', 'mempool-accelerator-sparkles-light.svg', 'mempool-block-visualization.png',
  'mempool-blocks-2-3-logo.jpeg', 'mempool-blocks-3-2-logo.jpeg', 'mempool-blocks.png',
  'mempool-holdings.png', 'mempool-preview.png', 'mempool-research.png', 'mempool-transaction.png',
  'mempool-tube.png', 'previews/accelerator.jpg', 'previews/mempool-space-preview.jpg',
  'previews/research.jpg', 'previews/research.png', 'previews/sponsor.jpg']) {
  assert.equal(fs.existsSync(path.join(root, 'frontend/src/resources', removed)), false,
    removed + ' must not be published in the source tree');
}

const blockFilters = fs.readFileSync(path.join(root, 'frontend/src/app/components/block-filters/block-filters.component.html'), 'utf8');
const faqTemplate = fs.readFileSync(path.join(root, 'frontend/src/app/docs/api-docs/api-docs.component.html'), 'utf8');
const faqData = fs.readFileSync(path.join(root, 'frontend/src/app/docs/api-docs/api-docs-data.ts'), 'utf8');
const dashboardTemplates = [
  'frontend/src/app/dashboard/dashboard.component.html',
  'frontend/src/app/components/custom-dashboard/custom-dashboard.component.html',
  'frontend/src/app/components/acceleration/accelerator-dashboard/accelerator-dashboard.component.html',
].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
for (const sourceText of [blockFilters, faqTemplate, faqData, dashboardTemplates]) {
  assert.equal(sourceText.includes('Nito Goggles'), false);
  assert.equal(sourceText.includes('Mempool Goggles'), false);
  assert.equal(sourceText.includes('how-do-mempool-goggles-work'), false);
}
assert.ok(blockFilters.includes('Transaction filters'));
assert.ok(blockFilters.includes("['fas', 'filter']"));
assert.ok(faqData.includes('how-do-transaction-filters-work'));

const svgImages = fs.readFileSync(path.join(root, 'frontend/src/app/components/svg-images/svg-images.component.html'), 'utf8');
for (const brandedCase of ['officialMempoolSpace', 'mempoolSpace', 'mempoolSquare', 'goggles', 'research',
  'accelerator', 'blocks-2-3', 'blocks-3-2']) {
  assert.equal(svgImages.includes(`*ngSwitchCase="'${brandedCase}'"`), false,
    brandedCase + ' trademarked SVG must not be published in the source tree');
}

console.log('PASS Nito qualification gates: routes, profiles, subsidy boundaries, public API examples, privacy fallbacks, metadata and asset exclusions');
