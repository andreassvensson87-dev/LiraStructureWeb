import { componentDefinition } from '../src/components/definitions.js';
import { componentInspectorSchema } from '../src/inspector/component-schemas.js';
import { createAttributeSelection } from '../src/inspector/attributes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boltedEndplateDefaults } from '../src/components/bolted-endplate.js';
import { updateComponents } from '../src/components/fit.js';
import { copyComponentProperties, componentCopyKeys } from '../src/components/property-copy.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { modelKeyboardCommand } from '../src/model/keyboard-command.js';
import { pointerCommand } from '../src/model/pointer-controller.js';
const column = {
  id: 'column',
  type: 'sweep',
  name: 'Pelare',
  profile: 'i',
  width: 300,
  height: 300,
  thickness: 15,
  rotation: 90,
  start: [0, 0, 0],
  end: [0, 0, 3000],
};
const beam = {
  ...column,
  id: 'beam',
  name: 'Balk',
  width: 200,
  rotation: 0,
  start: [1000, 0, 1500],
  end: [0, 0, 1500],
};
const spec = (length = 60, standard = 'ISO 4017') => ({
  id: `m16-${standard}-${length}`,
  revision: 1,
  name: `${standard} M16×${length}`,
  kind: 'bolt',
  standard,
  diameter: 16,
  length,
  head: { kind: 'hex', diameter: 24, height: 10 },
  nut: { acrossFlats: 24, thickness: 13 },
  washer: { innerDiameter: 18, outerDiameter: 30, thickness: 3 },
  thread: { length: standard === 'ISO 4014' ? 38 : length, pitch: 2 },
});
const draft = (changes = {}) => ({
  id: 'joint',
  type: 'component',
  kind: 'boltedEndplate',
  ...boltedEndplateDefaults,
  endB: 'end',
  boltSpec: spec(80),
  lengthOptions: [spec(80)],
  references: ['column', 'beam'],
  ...changes,
});

const members = [
  column,
  beam,
  { ...column, id: 'column2', start: [0, 3000, 0], end: [0, 3000, 3000] },
  { ...beam, id: 'beam2', width: 180, start: [0, 3000, 1500], end: [1000, 3000, 1500] },
];
const fixture = () =>
  updateComponents(
    [],
    [
      ...members,
      draft({ id: 'source', thickness: 20 }),
      draft({
        id: 'target',
        references: ['column2', 'beam2'],
        endB: 'start',
        thickness: 10,
        gap: 4,
      }),
    ],
  );
test('connection copying preserves members, end, identity and unchosen parameters and rebuilds target parts', () => {
  const objects = fixture(),
    source = objects.find((s) => s.id === 'source'),
    target = objects.find((s) => s.id === 'target');
  const before = structuredClone(objects);
  const result = copyComponentProperties(source, target, ['thickness', 'outstandX'], objects);
  assert.deepEqual(result.references, target.references);
  assert.equal(result.endB, 'start');
  assert.equal(result.id, 'target');
  assert.equal(result.gap, 4);
  assert.equal(result.thickness, 20);
  assert.notDeepEqual(result.position, source.position);
  const next = applyObjectBatch(objects, [result]).objects;
  assert.equal(next.find((s) => s.generatedBy === 'target' && s.type === 'plate').thickness, 20);
  assert.deepEqual(objects, before);
});
test('connection copying validates matching kinds and disallows references', () => {
  const objects = fixture(),
    source = objects.find((s) => s.id === 'source'),
    target = objects.find((s) => s.id === 'target');
  assert.throws(() => copyComponentProperties(source, target, ['references'], objects));
  assert.ok(componentCopyKeys('boltedEndplate').includes('endB'));
  assert.throws(() =>
    copyComponentProperties(source, { ...target, kind: 'fit' }, ['thickness'], objects),
  );
  assert.throws(() => copyComponentProperties(source, target, [], objects));
  assert.ok(componentCopyKeys('fit').includes('mode'));
});
test('invalid copied values leave the complete model unchanged', () => {
  const objects = fixture(),
    before = structuredClone(objects),
    source = objects.find((s) => s.id === 'source'),
    target = objects.find((s) => s.id === 'target');
  assert.throws(() =>
    copyComponentProperties({ ...source, spacingX: 9999 }, target, ['spacingX'], objects),
  );
  assert.deepEqual(objects, before);
});
test('copying a screw spec copies its detached length options snapshot', () => {
  const objects = fixture(),
    source = objects.find((s) => s.id === 'source'),
    target = objects.find((s) => s.id === 'target');
  const result = copyComponentProperties(source, target, ['boltSpec'], objects);
  assert.deepEqual(result.boltSpec, source.boltSpec);
  assert.notEqual(result.boltSpec, source.boltSpec);
  assert.deepEqual(result.lengthOptions, source.lengthOptions);
  assert.notEqual(result.lengthOptions, source.lengthOptions);
});
test('connection copying routes target clicks and Enter while blocking unrelated edits', () => {
  assert.equal(pointerCommand({ mode: 'componentProperties' }), 'component-property-target');
  assert.equal(
    modelKeyboardCommand({ key: 'Enter' }, { mode: 'componentProperties' }),
    'confirm-component-properties',
  );
  assert.equal(
    modelKeyboardCommand({ key: 'Delete' }, { mode: 'componentProperties', hasSelection: true }),
    null,
  );
  assert.equal(modelKeyboardCommand({ key: 'Escape' }, { mode: 'componentProperties' }), 'cancel');
});

for (const kind of ['fit', 'baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice']) {
  test(`${kind} copies default attributes against the target's own members and rebuilds a batch`, () => {
    if (kind === 'boltedEndplate') {
      const objects = fixture(),
        source = objects.find((s) => s.id === 'source'),
        target = objects.find((s) => s.id === 'target');
      const result = copyComponentProperties(
        source,
        target,
        createAttributeSelection(componentInspectorSchema(kind)).keys(),
        objects,
      );
      assert.equal(result.thickness, 20);
      assert.equal(result.endB, 'start');
      assert.equal(result.gap, 4);
      assert.deepEqual(result.references, target.references);
      return;
    }
    let refs = [structuredClone(kind === 'baseplate' ? column : beam)];
    refs[0].id = 'a';
    if (kind === 'fit') refs.push({ ...beam, id: 'b', start: [0, 1000, 1500], end: [0, 0, 1500] });
    if (kind === 'beamSplice') {
      refs[0].start = [-1000, 0, 1500];
      refs[0].end = [0, 0, 1500];
      refs.push({ ...beam, id: 'b', start: [0, 0, 1500], end: [1000, 0, 1500] });
    }
    const targets = refs.map((s) => ({
      ...s,
      id: s.id + '2',
      start: s.start.map((n, i) => n + (i === 1 ? 3000 : 0)),
      end: s.end.map((n, i) => n + (i === 1 ? 3000 : 0)),
    }));
    const source = {
      type: 'component',
      kind,
      id: 'src',
      name: 'Källa',
      ...componentDefinition(kind).defaults,
      references: refs.map((s) => s.id),
    };
    if (kind === 'endplate') source.endA = 'end';
    if (kind === 'beamSplice') {
      source.boltSpec = spec(80);
      source.lengthOptions = [spec(80)];
      source.endA = 'end';
      source.endB = 'start';
    }
    if (kind === 'fit') source.mode = 'abut';
    else source.thickness = 16;
    const target = {
      ...source,
      id: 'dst',
      name: 'Mål',
      references: targets.map((s) => s.id),
      ...(kind === 'fit' ? { mode: 'miter' } : { thickness: 8 }),
    };
    const objects = updateComponents([], [...refs, ...targets, source, target]),
      before = structuredClone(objects);
    const result = copyComponentProperties(
      objects.find((s) => s.id === 'src'),
      objects.find((s) => s.id === 'dst'),
      createAttributeSelection(componentInspectorSchema(kind)).keys(),
      objects,
    );
    assert.equal(result.id, 'dst');
    assert.equal(result.name, 'Mål');
    assert.deepEqual(result.references, target.references);
    assert.equal(kind === 'fit' ? result.mode : result.thickness, kind === 'fit' ? 'abut' : 16);
    const next = applyObjectBatch(objects, [result]).objects;
    assert.deepEqual(objects, before);
    if (kind !== 'fit')
      assert.equal(next.find((s) => s.generatedBy === 'dst' && s.type === 'plate').thickness, 16);
  });
}

test('local ends can be copied explicitly without copying member references', () => {
  const a = { ...beam, id: 'a' },
    b = { ...beam, id: 'b', start: [0, 1000, 1500], end: [0, 0, 1500] };
  const src = {
    type: 'component',
    kind: 'fit',
    id: 'src',
    ...componentDefinition('fit').defaults,
    references: ['a', 'b'],
  };
  const target = { ...src, id: 'dst', endA: 'start' };
  const result = copyComponentProperties(src, target, ['endA'], [a, b]);
  assert.equal(result.endA, 'end');
  assert.deepEqual(result.references, target.references);
});
