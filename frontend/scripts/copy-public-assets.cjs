const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve('src/resources');
const output = path.resolve('dist/mempool/browser');
const qualifiedLocales = ['en-US', 'fr'];

if (!fs.existsSync(source)) {
  throw new Error(`Missing bundled resource directory: ${source}`);
}

for (const locale of qualifiedLocales) {
  const localeOutput = path.join(output, locale);
  if (!fs.existsSync(path.join(localeOutput, 'index.html'))) {
    throw new Error(`Missing qualified locale output: ${locale}`);
  }
  const destination = path.join(localeOutput, 'resources');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

// Keep the canonical English UI at `/`, while preserving the locale directory
// produced by Angular so the artifact remains complete and inspectable.
const englishOutput = path.join(output, 'en-US');
for (const entry of fs.readdirSync(englishOutput)) {
  fs.cpSync(path.join(englishOutput, entry), path.join(output, entry), {
    recursive: true,
    force: true,
  });
}

const rootResources = path.join(output, 'resources');
fs.rmSync(rootResources, { recursive: true, force: true });
fs.cpSync(source, rootResources, { recursive: true, force: true });
console.log(`[public-assets] prepared ${qualifiedLocales.join(', ')} and promoted en-US to /`);
