const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve('src/resources');
const destination = path.resolve('dist/mempool/browser/resources');

if (!fs.existsSync(source)) {
  throw new Error(`Missing bundled resource directory: ${source}`);
}

fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.cpSync(source, destination, {
  recursive: true,
  force: true,
});
console.log(`[public-assets] copied bundled resources to ${destination}`);
