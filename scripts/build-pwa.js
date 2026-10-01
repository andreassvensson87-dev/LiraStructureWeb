import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const out = fileURLToPath(new URL('../dist/', import.meta.url));
const files = (await readdir(out))
  .filter((f) => /\.(html|js|css|svg|png|webmanifest|wasm)$/.test(f) && f !== 'sw.js')
  .sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(join(out, file)));
const version = hash.digest('hex').slice(0, 16);
const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
await writeFile(
  join(out, 'sw.js'),
  template
    .replace('__VERSION__', JSON.stringify(version))
    .replace('__FILES__', JSON.stringify(files)),
);
await writeFile(join(out, '.nojekyll'), '');
console.log('Installerbar release: ' + version);
