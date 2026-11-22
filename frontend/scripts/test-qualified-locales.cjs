const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const angularConfig = JSON.parse(fs.readFileSync(path.join(root, 'angular.json'), 'utf8'));
const project = angularConfig.projects.mempool;
const sourceLocale = typeof project.i18n.sourceLocale === 'string'
  ? project.i18n.sourceLocale
  : project.i18n.sourceLocale.code;
const publicConfig = project.architect.build.configurations.public;
const publicLocales = publicConfig.localize;
const constants = fs.readFileSync(path.join(root, 'src/app/app.constants.ts'), 'utf8');
const languagesBlock = /export const languages: Language\[\] = \[([\s\S]*?)\n\];/.exec(constants)?.[1];

assert.ok(languagesBlock, 'Cannot read the public language selector from app.constants.ts');
const selectorLocales = [...languagesBlock.matchAll(/code:\s*'([^']+)'/g)].map(match => match[1]);
const selectorBuildLocales = selectorLocales.map(locale => locale === 'en' ? sourceLocale : locale);

assert.equal(selectorLocales.length, 33, 'The restored public selector must expose the original 33 choices');
assert.equal(new Set(selectorLocales).size, selectorLocales.length, 'The language selector contains duplicates');
assert.deepEqual(publicLocales, selectorBuildLocales, 'The selector and public Angular build locales differ');
assert.equal(publicConfig.i18nMissingTranslation, 'warning', 'Missing community translations must visibly fall back to English');

function unitText(unit, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(unit);
  return match ? match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

const summaries = [];
for (const locale of publicLocales) {
  if (locale === sourceLocale) {
    summaries.push(`${locale}: source`);
    continue;
  }

  const localeConfig = project.i18n.locales[locale];
  assert.ok(localeConfig, `Public locale is not configured: ${locale}`);
  const translationPath = typeof localeConfig === 'string' ? localeConfig : localeConfig.translation;
  const translationFile = path.join(root, translationPath);
  assert.ok(fs.existsSync(translationFile), `Missing translation file for ${locale}: ${translationPath}`);

  const translation = fs.readFileSync(translationFile, 'utf8');
  const units = [...translation.matchAll(/<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g)];
  const ids = units.map(match => /\bid="([^"]+)"/.exec(match[1])?.[1]).filter(Boolean);
  assert.ok(units.length >= 800, `Locale ${locale} has unexpectedly little inherited coverage (${units.length} units)`);
  assert.equal(new Set(ids).size, ids.length, `Locale ${locale} contains duplicate translation identifiers`);

  const mismatches = [];
  for (const match of units) {
    const source = unitText(match[2], 'source');
    const target = unitText(match[2], 'target');
    if (!target) continue;
    if (/\b(?:NITO|Nito|Nitocoin)\b/i.test(source) && /\b(?:BTC|Bitcoin)\b/i.test(target)) {
      mismatches.push({ source, target });
    }
    if (/nitoshi/i.test(source) && /\bsat/i.test(target)) {
      mismatches.push({ source, target });
    }
  }
  assert.deepEqual(mismatches, [], `${locale} contains legacy Bitcoin-unit mismatches:\n${JSON.stringify(mismatches, null, 2)}`);
  summaries.push(`${locale}: ${units.length} units`);
}

const french = fs.readFileSync(path.join(root, project.i18n.locales.fr.translation), 'utf8');
for (const expected of ['Rechercher', 'Transaction', 'Adresse']) {
  assert.ok(french.includes(expected), `French locale is missing reviewed text: ${expected}`);
}

const rewardStats = fs.readFileSync(path.join(root, 'src/app/components/reward-stats/reward-stats.component.html'), 'utf8');
assert.equal((rewardStats.match(/@@mining\.avg-fee-title-4w/g) || []).length, 1, 'Average-fee title tooltip needs a unique translation id');
assert.equal((rewardStats.match(/@@mining\.avg-fee-desc-4w/g) || []).length, 1, 'Average-fee description tooltip needs a unique translation id');

console.log(`PASS public locales: ${publicLocales.length} builds / ${selectorLocales.length} selector choices`);
console.log(summaries.join(', '));
console.log('Missing current community strings intentionally fall back to the English source.');
