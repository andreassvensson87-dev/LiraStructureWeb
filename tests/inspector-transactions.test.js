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
