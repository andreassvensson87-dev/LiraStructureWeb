import test from 'node:test';
import assert from 'node:assert/strict';
import { propertyValues, commonPropertyValues } from '../src/property-transfer.js';
import { modelPropertyFields, applyModelProperties } from '../src/model/property-transfer.js';
import { drawingPropertyFields, applyDrawingProperties } from '../src/drawing-property-transfer.js';
import { createCreationDefaults } from '../src/inspector/creation-defaults.js';
import { createModelEditor } from '../src/app/model-editor.js';

const sweep = (id, width = 100) => ({
  id,
  type: 'sweep',
  name: id,
  profile: 'rect',
  width,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [0, 0, 0],
  end: [1000, 0, 0],
  prefix: 'B',
  number: 3,
  partSeries: { prefix: 'P', start: 100 },
});
test('property transfer keeps geometry, identity, marks and unchosen properties; validation precedes the model transaction', () => {
  const source = {
    ...sweep('source', 250),
    rotation: 45,
    number: 5,
    partSeries: { prefix: 'Q', start: 300 },
  };
  const target = sweep('target');
  const values = propertyValues(source, modelPropertyFields(source));
  const next = applyModelProperties(target, values, ['profile', 'series']);
  assert.deepEqual(next.start, target.start);
  assert.deepEqual(next.end, target.end);
  assert.equal(next.width, 250);
  assert.equal(next.rotation, 0);
  assert.equal(next.id, 'target');
  assert.equal(next.number, 3);
  assert.deepEqual(next.partSeries, source.partSeries);
  assert.equal(target.width, 100);
  const project = { objects: [source, target] };
  let before;
  let checkpoints = 0;
  const editor = createModelEditor({
    project,
    checkpoint: () => {
      checkpoints++;
      before = structuredClone(project.objects);
    },
  });
  editor.update([next]);
  assert.equal(project.objects[1].width, 250);
  assert.equal(before[1].width, 100);
  assert.equal(checkpoints, 1);
  assert.throws(() => editor.update([{ ...next, width: -1 }]));
  assert.equal(project.objects[1].width, 250);
  assert.equal(checkpoints, 1);
});
test('mixed defaults omit varying fields and persist detached properties without identities or geometry', () => {
  const sources = [sweep('a'), sweep('b', 300)];
  const common = commonPropertyValues(sources, modelPropertyFields(sources[0]));
  assert.equal(common.profile, undefined);
  assert.equal(common.name, undefined);
  assert.deepEqual(common.series, { partSeries: { prefix: 'P', start: 100 } });
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
  };
  const defaults = createCreationDefaults(storage);
  defaults.set('sweep', common);
  common.series.partSeries.start = 999;
  assert.equal(createCreationDefaults(storage).get('sweep').series.partSeries.start, 100);
  const text = [...entries.values()][0];
  assert.ok(!text.includes('"start":['));
  assert.ok(!text.includes('"id"'));
});
test('cross type copies offer shared properties without confusing plate and profile insertion', () => {
  const source = {
    ...sweep('source'),
    placement: { horizontalAlignment: 'left', verticalAlignment: 'top' },
    colorOverride: '#123456',
  };
  const plate = {
    type: 'plate',
    side: 'positive',
    thickness: 12,
    polygon: [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
  };
  const values = propertyValues(source, modelPropertyFields(source));
  const next = applyModelProperties(plate, values, ['color', 'profilePlacement']);
  assert.equal(next.colorOverride, '#123456');
  assert.equal(next.side, 'positive');
  assert.equal(next.thickness, 12);
  assert.deepEqual(next.polygon, plate.polygon);
});
test('drawing styles preserve text contents, model anchors, view IDs, paper positions and target hatch compatibility', () => {
  const source = {
    type: 'dimension',
    textSize: 4,
    precision: 1,
    comment: 'Source',
    points: [
      [0, 0],
      [10, 0],
    ],
    line: [0, 5],
  };
  const target = {
    ...source,
    id: 'target',
    view: 'v2',
    textSize: 2.5,
    comment: 'Target',
    points: [
      [20, 0],
      [30, 0],
    ],
    references: [{ source: 'beam', kind: 'end' }, null],
  };
  const values = propertyValues(source, drawingPropertyFields(source));
  const next = applyDrawingProperties(target, values, ['textSize', 'precision']);
  assert.equal(next.textSize, 4);
  assert.equal(next.precision, 1);
  assert.equal(next.comment, 'Target');
  assert.deepEqual(next.references, target.references);
  assert.deepEqual(next.points, target.points);
  assert.equal(next.view, 'v2');
  const text = {
    type: 'richtext',
    textSize: 2,
    points: [[5, 10]],
    width: 80,
    paragraphs: [{ runs: [{ text: 'Keep me' }], align: 'left' }],
  };
  assert.deepEqual(applyDrawingProperties(text, values, ['textSize']).paragraphs, text.paragraphs);
  assert.throws(() => applyDrawingProperties(target, { textSize: { textSize: -1 } }, ['textSize']));
  const polygon = {
    type: 'shape',
    shape: 'polygon',
    hatch: { pattern: 'solid' },
    strokeWidth: 0.3,
  };
  const line = {
    type: 'shape',
    shape: 'line',
    points: [
      [0, 0],
      [1, 1],
    ],
  };
  const copied = applyDrawingProperties(
    line,
    propertyValues(polygon, drawingPropertyFields(polygon)),
    ['hatch', 'strokeWidth'],
  );
  assert.equal(copied.hatch, undefined);
  assert.equal(copied.strokeWidth, 0.3);
});

test('copying a screw pattern rebuilds the target group against its own parts and retains existing cell/hole IDs', async () => {
  const { fastenerGroupBatch, replaceFastenerGroup } = await import('../src/fasteners/groups.js');
  const { fastenerPropertySource } = await import('../src/fasteners/property-transfer.js');
  const { prepareModelPropertyTransfer } = await import('../src/model/property-transfer.js');
  const plate = (id, x) => ({
    id,
    type: 'plate',
    name: id,
    thickness: 20,
    side: 'positive',
    frame: { origin: [x, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [-200, -200],
      [200, -200],
      [200, 200],
      [-200, 200],
    ],
  });
  const a = plate('a', 0),
    b = plate('b', 1000);
  const spec = {
    id: 'm12',
    revision: 1,
    name: 'M12',
    kind: 'bolt',
    standard: 'ISO 4017',
    diameter: 12,
    length: 50,
    thread: { length: 50 },
    head: { kind: 'hex', diameter: 18, height: 8 },
    nut: { acrossFlats: 18, thickness: 10 },
    washer: { innerDiameter: 13, outerDiameter: 24, thickness: 2.5 },
  };
  const group = (id, target, x, columns) => ({
    type: 'fastener',
    spec,
    start: [x, 0, 40],
    end: [x, 0, -10],
    holes: [
      {
        id: `${id}-hole`,
        targetId: target,
        kind: 'clearance',
        extent: 'profile',
        diameter: 14,
        offset: 0,
        depth: 20,
      },
    ],
    anchorId: target,
    assembly: { nearWasher: true, farWasher: true, nut: true },
    lengthMode: 'manual',
    group: {
      id,
      rows: 1,
      columns,
      spacingX: 60,
      spacingY: 60,
      rotation: 0,
      origin: [x, 0, 40],
      direction: [x, 0, 0],
      u: [1, 0, 0],
      row: 0,
      column: 0,
    },
  });
  let objects = [a, b];
  const sources = fastenerGroupBatch(group('source', 'a', 0, 3), objects);
  objects = replaceFastenerGroup(objects, sources);
  const targets = fastenerGroupBatch(group('target', 'b', 1000, 1), objects);
  objects = replaceFastenerGroup(objects, targets);
  const source = sources[0],
    target = targets[0],
    before = structuredClone(objects);
  const values = propertyValues(fastenerPropertySource(source), modelPropertyFields(source));
  const prepared = prepareModelPropertyTransfer({
    objects,
    source,
    targets: [target],
    values,
    keys: ['product', 'hardware', 'pattern', 'hole'],
  });
  assert.equal(prepared.changed.length, 3);
  assert.equal(prepared.changed[0].id, target.id);
  assert.equal(prepared.changed[0].holes[0].id, target.holes[0].id);
  assert.equal(new Set(prepared.changed.map((o) => [o.prefix, o.number].join(':'))).size, 3);
  for (const member of prepared.changed) {
    assert.equal(member.group.id, 'target');
    assert.equal(member.holes[0].targetId, 'b');
    assert.deepEqual(member.group.origin, target.group.origin);
    assert.equal(member.spec.length, 50);
  }
  assert.deepEqual(objects, before, 'preparation and preview do not mutate the model');
  const bad = structuredClone(values);
  bad.product.spec.length = -10;
  assert.throws(() =>
    prepareModelPropertyTransfer({
      objects,
      source,
      targets: [target],
      values: bad,
      keys: ['product'],
    }),
  );
  assert.deepEqual(objects, before, 'invalid changes leave all screws and bores untouched');
});

test('creation defaults are shared across editor instances without overwriting other object types', () => {
  const records = new Map();
  const storage = {
    getItem: (key) => records.get(key),
    setItem: (key, value) => records.set(key, value),
  };
  const model = createCreationDefaults(storage),
    singlePart = createCreationDefaults(storage),
    ga = createCreationDefaults(storage);
  model.set('sweep', { profile: { width: 175 } });
  singlePart.set('drawing:shape:line', { strokeWidth: { strokeWidth: 0.35 } });
  assert.deepEqual(ga.get('drawing:shape:line'), { strokeWidth: { strokeWidth: 0.35 } });
  ga.set('drawing:dimension', { textSize: { textSize: 4 } });
  assert.deepEqual(model.get('sweep'), { profile: { width: 175 } });
  assert.deepEqual(singlePart.get('drawing:dimension'), { textSize: { textSize: 4 } });
  const offline = createCreationDefaults({
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
  });
  offline.set('plate', { thickness: { thickness: 30 } });
  assert.deepEqual(offline.get('plate'), { thickness: { thickness: 30 } });
});

test('Item property rotation changes the orientation while preserving its own placement and definition', () => {
  const source = { type: 'item', rotation: 90 };
  const target = {
    type: 'item',
    rotation: 0,
    start: [100, 200, 300],
    end: [100, 200, 400],
    quaternion: [0, 0, 0, 1],
    item: { id: 'own-shape' },
  };
  const next = applyModelProperties(target, propertyValues(source, modelPropertyFields(source)), [
    'rotation',
  ]);
  assert.equal(next.rotation, 90);
  assert.ok(Math.abs(next.quaternion[2] - Math.SQRT1_2) < 1e-9);
  assert.deepEqual(next.item, target.item);
  assert.deepEqual(next.start, target.start);
  assert.deepEqual(next.end, target.end);
  assert.deepEqual(target.quaternion, [0, 0, 0, 1]);
});
