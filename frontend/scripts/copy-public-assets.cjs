const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve('src/resources');
const output = path.resolve('dist/mempool/browser');
const angularConfig = JSON.parse(fs.readFileSync(path.resolve('angular.json'), 'utf8'));
const project = angularConfig.projects?.mempool;
const sourceLocale = typeof project?.i18n?.sourceLocale === 'string'
  ? project.i18n.sourceLocale
  : project?.i18n?.sourceLocale?.code;
const publicLocales = project?.architect?.build?.configurations?.public?.localize;
const configuredLocales = new Set([sourceLocale, ...Object.keys(project?.i18n?.locales || {})]);

if (!sourceLocale || !Array.isArray(publicLocales) || publicLocales.length === 0) {
  throw new Error('angular.json must define a source locale and a non-empty public locale list');
}
if (new Set(publicLocales).size !== publicLocales.length) {
  throw new Error('The public locale list contains duplicates');
}
for (const locale of publicLocales) {
  if (!configuredLocales.has(locale)) {
    throw new Error(`Public locale is not configured in angular.json: ${locale}`);
  }
}
if (!publicLocales.includes(sourceLocale)) {
  throw new Error(`The public locale list must include the source locale: ${sourceLocale}`);
}

if (!fs.existsSync(source)) {
  throw new Error(`Missing bundled resource directory: ${source}`);
}

for (const locale of publicLocales) {
  const localeOutput = path.join(output, locale);
  if (!fs.existsSync(path.join(localeOutput, 'index.html'))) {
    throw new Error(`Missing public locale output: ${locale}`);
  }
  const destination = path.join(localeOutput, 'resources');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

// Keep the canonical English UI at `/`, while preserving the locale directory
// produced by Angular so the artifact remains complete and inspectable.
const englishOutput = path.join(output, sourceLocale);
for (const entry of fs.readdirSync(englishOutput)) {
  fs.cpSync(path.join(englishOutput, entry), path.join(output, entry), {
    recursive: true,
    force: true,
  });
}

const rootResources = path.join(output, 'resources');
fs.rmSync(rootResources, { recursive: true, force: true });
fs.cpSync(source, rootResources, { recursive: true, force: true });
console.log(`[public-assets] prepared ${publicLocales.join(', ')} and promoted ${sourceLocale} to /`);
