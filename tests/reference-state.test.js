import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  encodeReference,
  decodeReference,
  validateReferences,
} from '../src/references/reference-state.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
const entry = (format, id = format) => ({
  id,
  title: `Underlag ${format}`,
  fileName: `underlag.${format.toLowerCase()}`,
  format,
  folder: 'Underlag',
  source: encodeReference(Uint8Array.from([0, 127, 128, 255]).buffer),
  visible: false,
  locked: true,
  transparent: true,
  corners: false,
  edges: true,
  ...(format !== 'IFC'
    ? {
        layerVisibility: { Stomme: true, Mått: false },
        placement: { offset: [100, 200, 300], rotation: 37, scale: 2 },
        unitFactor: 1000,
        unitKnown: true,
      }
    : {}),
});
test('IFC, DXF and DWG originals and settings survive project serialization with empty groups', () => {
  const p = parseProjectFile(
    readFileSync(new URL('../examples/assemblytest.lira.json', import.meta.url), 'utf8'),
  );
  p.references = {
    folders: ['Standard', 'Underlag', 'Tom grupp'],
    models: ['IFC', 'DXF', 'DWG'].map((f) => entry(f)),
  };
  const restored = parseProjectFile(serializeProject(p));
  assert.deepEqual(restored.references, p.references);
  assert.deepEqual(
    [...new Uint8Array(decodeReference(restored.references.models[0].source))],
    [0, 127, 128, 255],
  );
  restored.references.models[1].placement.offset[0] = -1;
  assert.equal(p.references.models[1].placement.offset[0], 100);
});
test('legacy projects without references default to an empty reference list', () => {
  const file = JSON.parse(
    readFileSync(new URL('../examples/assemblytest.lira.json', import.meta.url), 'utf8'),
  );
  delete file.project.references;
  assert.deepEqual(parseProjectFile(JSON.stringify(file)).references, {
    folders: ['Standard'],
    models: [],
  });
});
test('invalid reference identities, sources, grouping and CAD placement are rejected', () => {
  const valid = { folders: ['Underlag'], models: [entry('DXF')] };
  for (const mutate of [
    (m) => (m.source = 'not a file'),
    (m) => (m.format = 'JS'),
    (m) => (m.folder = 'missing'),
    (m) => (m.visible = 'true'),
    (m) => (m.placement.offset = [0, 1]),
    (m) => (m.placement.scale = 0),
  ]) {
    const bad = structuredClone(valid);
    mutate(bad.models[0]);
    assert.throws(() => validateReferences(bad), /referenser/);
  }
  assert.throws(
    () => validateReferences({ ...valid, models: [entry('IFC', 'same'), entry('DXF', 'same')] }),
    /referenser/,
  );
});
