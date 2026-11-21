const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const french = fs.readFileSync(path.join(root, 'src/locale/messages.fr.xlf'), 'utf8');
const units = [...french.matchAll(/<trans-unit\b[^>]*>([\s\S]*?)<\/trans-unit>/g)].map(match => match[1]);

function text(unit, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(unit);
  return match ? match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

const mismatches = [];
for (const unit of units) {
  const source = text(unit, 'source');
  const target = text(unit, 'target');
  if (!target) continue;
  if (/\b(?:NITO|Nito|Nitocoin)\b/i.test(source) && /\b(?:BTC|Bitcoin)\b/i.test(target)) {
    mismatches.push({ source, target });
  }
  if (/nitoshi/i.test(source) && /\b(?:sat|sats|satoshi|satoshis)\b/i.test(target)) {
    mismatches.push({ source, target });
  }
}

assert.deepEqual(mismatches, [], `French locale contains legacy-unit mismatches:\n${JSON.stringify(mismatches, null, 2)}`);
for (const expected of ['Rechercher', 'Transaction', 'Adresse']) {
  assert.ok(french.includes(expected), `French locale is missing reviewed text: ${expected}`);
}

console.log(`PASS qualified locales: en-US source plus reviewed French targets (${units.length} units, English fallback for missing Nito strings)`);
