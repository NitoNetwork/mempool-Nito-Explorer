const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const errorPipe = read('src/app/shared/pipes/http-error-pipe/http-error.pipe.ts');
assert.match(errorPipe, /`HTTP \$\{e\.status\}: \$\{message\}`/);
assert.match(errorPipe, /\^\(\?:OK\|Unknown Error\)\$/);
assert.doesNotMatch(errorPipe, /\$\{e\.status\} \$\{e\.statusText\}/);

const difficultyTable = read('src/app/components/difficulty-adjustments-table/difficulty-adjustments-table.components.ts');
assert.match(difficultyTable, /getDifficultyAdjustments\$\('latest'\)/);
assert.doesNotMatch(difficultyTable, /getDifficultyAdjustments\$\('3m'\)/);

const sizesWeights = read('src/app/components/block-sizes-weights-graph/block-sizes-weights-graph.component.ts');
assert.match(sizesWeights, /BLOCK_WEIGHT_UNITS \/ 1_000_000/);
assert.match(sizesWeights, /formatter: `\$\{blockWeightLimitMwu\} MWU`/);
assert.doesNotMatch(sizesWeights, /formatter: `1 MB`/);

const feeRates = read('src/app/components/block-fee-rates-graph/block-fee-rates-graph.component.ts');
assert.match(feeRates, /nitoshi\/\$\{weightMode \? 'WU': 'vB'\}/);
assert.doesNotMatch(feeRates, / s\/\$\{weightMode/);

for (const file of [
  'src/app/components/amount-selector/amount-selector.component.html',
  'src/app/shared/components/sats/sats.component.html',
  'src/app/shared/components/btc/btc.component.ts',
  'src/app/shared/components/fee-rate/fee-rate.component.html',
]) {
  const source = read(file);
  assert.match(source, /nitoshi/);
  assert.doesNotMatch(source, />sats<|'sats'|>sat\/WU</);
}

for (const file of [
  'src/app/components/transactions-list/transactions-list.component.html',
  'src/app/components/transaction/transaction-preview.component.html',
  'src/app/components/transaction/transaction-details/transaction-details.component.html',
  'src/app/components/rbf-timeline/rbf-timeline-tooltip.component.html',
  'src/app/components/calculator/calculator.component.html',
  'src/app/components/rate-unit-selector/rate-unit-selector.component.ts',
  'src/app/components/push-transaction/push-transaction.component.html',
  'src/app/components/test-transactions/test-transactions.component.html',
  'src/app/components/treasuries/treasuries-graph/treasuries-graph.component.ts',
]) {
  const source = read(file);
  assert.match(source, /nitoshi/);
  assert.doesNotMatch(source, />sats<|sat\/WU|s\/vb|0 sat|\} sats`/i);
}

console.log('Nito visible UI unit and bounded-loading checks passed.');
