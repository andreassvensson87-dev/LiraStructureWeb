import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { SelectionScope } from '../src/inspector/selection-scope.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
const hooks = registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { Inspector } = await import('../src/inspector.js');
hooks.deregister();
const sweep = {
  id: 's',
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [0, 0, 0],
  end: [1000, 0, 0],
};
const plate = {
  id: 'p',
  type: 'plate',
  thickness: 10,
  side: 'center',
  polygon: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
};
function harness(type) {
  let objects = structuredClone([sweep, plate, { ...sweep, id: 'outside' }]);
  const selectedIds = ['s', 'p'];
  const inspector = Object.create(Inspector.prototype);
  Object.assign(inspector, {
    scope: new SelectionScope(),
    session: null,
    busy: false,
    rawState: () => ({ selected: objects.filter((s) => selectedIds.includes(s.id)) }),
    getState() {
      return { selected: this.scope.sync(this.rawState().selected) };
    },
    validate: () => '',
    preview(batch) {
      this.previewBatch = batch;
    },
    cancel() {
      this.previewBatch = null;
    },
    commit(batch) {
      objects = applyObjectBatch(objects, batch).objects;
    },
    fill: () => {},
    sync: () => {},
    scopeChanged: () => {},
    $: () => ({ textContent: '' }),
  });
  inspector.scope.sync(inspector.rawState().selected);
  inspector.scope.choose(type, inspector.rawState().selected);
  return { inspector, objects: () => objects, selectedIds };
}
test('Plate transaction previews and commits only scoped plates while keeping full selection', () => {
  const h = harness('plate'),
    before = structuredClone(h.objects());
  h.inspector.stage((s) => ({ ...s, thickness: 18, side: 'positive', contourOffset: 5 }));
  assert.deepEqual(h.objects(), before);
  assert.deepEqual(
    h.inspector.previewBatch.map((s) => s.id),
    ['p'],
  );
  h.inspector.finish();
  assert.equal(h.objects()[1].thickness, 18);
  assert.equal(h.objects()[1].side, 'positive');
  assert.equal(h.objects()[1].contourOffset, 5);
  assert.deepEqual(h.objects()[0], before[0]);
  assert.deepEqual(h.objects()[2], before[2]);
  assert.deepEqual(h.selectedIds, ['s', 'p']);
});
test('reset and scope switch discard drafts without changing objects or selection', () => {
  const h = harness('plate'),
    before = structuredClone(h.objects());
  h.inspector.stage((s) => ({ ...s, thickness: 18 }));
  h.inspector.rollback();
  assert.equal(h.inspector.session, null);
  assert.equal(h.inspector.previewBatch, null);
  h.inspector.stage((s) => ({ ...s, thickness: 20 }));
  h.inspector.show = () => {};
  h.inspector.chooseScope('sweep');
  assert.equal(h.inspector.session, null);
  assert.equal(h.inspector.scope.type, 'sweep');
  assert.deepEqual(h.objects(), before);
  assert.deepEqual(h.selectedIds, ['s', 'p']);
});
test('library profile remains a draft, can be reset, and commits only selected sweeps', () => {
  const h = harness('sweep'),
    before = structuredClone(h.objects());
  const section = { name: 'Library profile', revision: 1 };
  const apply = (s) => ({ ...s, profile: 'custom', section: structuredClone(section) });
  h.inspector.stage(apply);
  assert.equal(h.inspector.editingObjects()[0].section.name, section.name);
  assert.deepEqual(h.objects(), before);
  h.inspector.rollback();
  assert.equal(h.inspector.editingObjects()[0].profile, 'rect');
  h.inspector.stage(apply);
  h.inspector.finish();
  assert.equal(h.objects()[0].profile, 'custom');
  assert.deepEqual(h.objects()[1], before[1]);
  assert.deepEqual(h.objects()[2], before[2]);
  assert.deepEqual(h.selectedIds, ['s', 'p']);
});

test('homogeneous selections and a selected type scope use their standard inspector', () => {
  const h = harness('');
  assert.equal(h.inspector.standardType, null);
  h.inspector.scope.choose('plate', h.inspector.rawState().selected);
  assert.equal(h.inspector.standardType, 'plate');
  h.selectedIds.splice(0, 2, 's', 'outside');
  assert.equal(h.inspector.standardType, 'sweep');
});

test('standard plate fields show mixed values and retain the current draft input', (t) => {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: () => ({ dataset: {} }),
  };
  t.after(() => {
    globalThis.document = previous;
  });
  const fields = new Map();
  for (const id of [
    'plate-thickness',
    'plate-side',
    'plate-contour-offset',
    'plate-stage',
    'plate-plane-fields',
  ]) {
    fields.set(id, {
      tagName: id === 'plate-side' ? 'SELECT' : 'INPUT',
      querySelector: () => null,
      prepend() {},
    });
  }
  const objects = [
    structuredClone(plate),
    { ...structuredClone(plate), id: 'other', thickness: 20 },
  ];
  const inspector = Object.create(Inspector.prototype);
  Object.assign(inspector, {
    rawState: () => ({ selected: objects }),
    getState: () => ({ selected: objects }),
    $: (id) => fields.get(id),
    fillStandard: () => {},
    session: null,
  });
  inspector.fillStandardFields();
  assert.equal(fields.get('plate-thickness').value, '');
  assert.equal(fields.get('plate-thickness').placeholder, 'Blandat');
  assert.equal(fields.get('plate-side').value, 'center');
  assert.equal(fields.get('plate-contour-offset').value, 0);
  const input = fields.get('plate-thickness');
  input.value = '30';
  inspector.session = { input, batch: objects.map((s) => ({ ...s, thickness: 30 })) };
  inspector.fillStandardFields();
  assert.equal(input.value, '30');
  assert.equal(objects[0].thickness, 10);
  assert.equal(objects[1].thickness, 20);
});

test('standard sweep input modifies every scoped sweep while preserving each axis', () => {
  const h = harness('');
  h.selectedIds.splice(0, 2, 's', 'outside');
  const before = structuredClone(h.objects());
  const input = {
    id: 'width',
    type: 'number',
    value: '180',
    dataset: {},
    matches: () => true,
  };
  h.inspector.actions = { querySelector: () => ({}) };
  h.inspector.input({ target: input });
  assert.deepEqual(h.objects(), before);
  assert.deepEqual(
    h.inspector.previewBatch.map((s) => s.width),
    [180, 180],
  );
  h.inspector.finish();
  assert.equal(h.objects()[0].width, 180);
  assert.equal(h.objects()[2].width, 180);
  assert.deepEqual(h.objects()[0].start, before[0].start);
  assert.deepEqual(h.objects()[2].end, before[2].end);
  assert.deepEqual(h.objects()[1], before[1]);
});

test('grid dimensions and labels use the ordinary inspector preview, commit and rollback', () => {
  let object = {
    id: 'grid',
    type: 'gridline',
    name: '1',
    gridAxis: 'x',
    bubbleEnds: 'both',
    start: [0, 0, 0],
    end: [0, 1000, 0],
  };
  const inspector = Object.create(Inspector.prototype);
  Object.assign(inspector, {
    scope: new SelectionScope(),
    session: null,
    busy: false,
    rawState: () => ({ selected: [object] }),
    getState: () => ({ selected: [object] }),
    validate: () => '',
    preview(batch) {
      this.previewBatch = batch;
    },
    cancel() {
      this.previewBatch = null;
    },
    commit(batch) {
      object = batch[0];
    },
    fill() {},
    sync() {},
    scopeChanged() {},
    $: () => ({ textContent: '' }),
  });
  const input = (key, value, type = 'number') =>
    inspector.input({
      target: { id: key, dataset: { common: key }, type, value, matches: () => true },
    });
  input('gridAngle', '45');
  assert.deepEqual(object.end, [0, 1000, 0]);
  assert.ok(Math.abs(inspector.previewBatch[0].end[0] - inspector.previewBatch[0].end[1]) < 1e-8);
  inspector.finish();
  assert.ok(Math.abs(object.end[0] - 1000 / Math.sqrt(2)) < 1e-8);
  input('name', 'S1', 'text');
  inspector.finish();
  assert.equal(object.name, 'S1');
  input('gridLength', '0');
  assert.match(inspector.session.error, /minst 1 mm/);
  inspector.rollback();
  assert.ok(Math.abs(Math.hypot(...object.end) - 1000) < 1e-8);
});
