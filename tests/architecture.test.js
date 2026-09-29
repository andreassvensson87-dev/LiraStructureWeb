import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../src/', import.meta.url);
test('project domain does not depend on DOM, storage or application editors', () => {
  for (const file of readdirSync(new URL('project/', root))) {
    if (!file.endsWith('.js')) continue;
    const source = readFileSync(new URL('project/' + file, root), 'utf8');
    assert.doesNotMatch(source, /\b(document|window|localStorage|sessionStorage)\s*\./, file);
    assert.doesNotMatch(source, /from\s+['"][^'"]*(editor|controller|main\.js)/, file);
  }
});
test('geometry and drawing tool feedback cannot reach into global application state', () => {
  const geometry = readFileSync(new URL('model-object.js', root), 'utf8');
  assert.doesNotMatch(geometry, /setGeometryModel|let records\s*=/);
  const feedback = readFileSync(new URL('drawing-tool-feedback.js', root), 'utf8');
  assert.doesNotMatch(feedback, /querySelector\([^)]*snap-polar/);
});
