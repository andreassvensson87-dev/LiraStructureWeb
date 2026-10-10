import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const core = [
  'model-editor',
  'model-placement',
  'model-session',
  'model-tools',
  'object-types',
  'transform',
  'rotation',
  'grips',
  'model-navigation',
  'model-selection-controller',
  'selection-mode',
  'snap',
  'grid-objects',
  'grid-geometry',
  'inspector-transactions',
  'project-state',
  'project-snapshots',
  'project-recovery',
  'numbering-workflow',
];
const mode = process.argv[2] || 'core';
if (!['core', 'all'].includes(mode)) throw new Error('Choose core or all.');
const files =
  mode === 'all'
    ? readdirSync(new URL('../tests/', import.meta.url))
        .filter((name) => name.endsWith('.test.js'))
        .sort()
    : core.map((name) => `${name}.test.js`);
console.log(
  `${mode === 'all' ? 'Full regression suite' : 'Core model workflows'} · ${files.length} files`,
);
const result = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-reporter=spec',
    ...files.map((name) => fileURLToPath(new URL(`../tests/${name}`, import.meta.url))),
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
