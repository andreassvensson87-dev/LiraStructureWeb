import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { InsertionPoints } from '../src/insertion-points.js';
import { retainsSelectionGrips, selectionGrips } from '../src/model/grips.js';
import { createModelPicking } from '../src/model/ui/model-picking.js';
import { createProject } from '../src/project/project-state.js';
import { defaultFasteners } from '../src/fasteners/default-catalog.js';

const bolt = {
  id: 'bolt',
  type: 'fastener',
  spec: defaultFasteners().find((s) => s.standard === 'ISO 4017' && s.diameter === 12),
  start: [0, 0, 297.5],
  end: [0, 0, 217.5],
  holes: [],
  group: { id: 'g' },
  layout: { frame: { origin: [0, 0, 300], u: [1, 0, 0], v: [0, 1, 0] }, xLength: 500 },
};
function fakeDocument(t) {
  const previous = globalThis.document;
  const element = (tag) => ({
    tagName: tag.toUpperCase(),
    style: {},
    children: [],
    append(...nodes) {
      this.children.push(...nodes);
    },
    setAttribute() {},
    addEventListener() {},
    remove() {},
    contains() {
      return false;
    },
  });
  globalThis.document = { createElement: element, getElementById: () => ({ textContent: '' }) };
  t.after(() => {
    globalThis.document = previous;
  });
  return element;
}

test('Move and Copy preserve all native grip families as passive markers, then restore editing', (t) => {
  const element = fakeDocument(t);
  const sources = [
    { id: 'sweep', type: 'sweep', start: [0, 0, 0], end: [100, 0, 0] },
    { id: 'item', type: 'item', start: [200, 0, 0], end: [300, 0, 0] },
    { id: 'line', type: 'helperline', start: [400, 0, 0], end: [500, 0, 0] },
    { id: 'grid', type: 'gridline', start: [600, 0, 0], end: [700, 0, 0] },
    {
      id: 'poly',
      type: 'polysweep',
      points: [
        [0, 100, 0],
        [100, 100, 0],
        [100, 200, 0],
      ],
    },
    {
      id: 'plate',
      type: 'plate',
      frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
      polygon: [
        [200, 200],
        [300, 200],
        [300, 300],
      ],
    },
    bolt,
  ];
  const ids = new Set(sources.map((s) => s.id));
  const expected = selectionGrips(sources, ids).flatMap((g) => g.refs);
  const camera = new THREE.OrthographicCamera(-1000, 1000, 1000, -1000, 1, 3000);
  camera.position.set(0, 0, 1500);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const overlay = new InsertionPoints(element('div'), () =>
    assert.fail('a passive marker activated editing'),
  );
  overlay.update(camera, 600, 600, sources, ids, false);
  assert.ok([...overlay.markers.values()].some((m) => m.tagName === 'BUTTON'));
  for (const operation of [
    { mode: 'move' },
    { mode: 'copy' },
    { mode: 'move', linearId: 'l' },
    { mode: 'copy', planeId: 'p' },
  ]) {
    overlay.update(
      camera,
      600,
      600,
      sources,
      ids,
      true,
      [0, 0, 0],
      [50, 0, 0],
      [],
      [],
      retainsSelectionGrips(operation),
    );
    const markers = [...overlay.markers.values()];
    assert.deepEqual(
      markers.flatMap((m) => m.grip.refs),
      expected,
    );
    assert.ok(markers.every((m) => m.tagName === 'SPAN' && !m.onclick && !m.oncontextmenu));
    assert.deepEqual(
      overlay.refsInRect({ x: 0, y: 0 }, { x: 600, y: 600 }),
      [],
      'Alt rectangle cannot select grips during the command',
    );
  }
  overlay.update(camera, 600, 600, sources, ids, true);
  assert.equal(overlay.markers.size, 0, 'unrelated creation still hides selection grips');
  overlay.update(camera, 600, 600, sources, ids, false);
  assert.ok(
    [...overlay.markers.values()].filter((m) => m.grip).every((m) => m.tagName === 'BUTTON'),
  );
  overlay.update(camera, 600, 600, sources, ids, false, null, null, [], [], false, true);
  assert.ok([...overlay.markers.values()].every((m) => m.tagName === 'SPAN'));
  assert.deepEqual(
    overlay.refsInRect({ x: 0, y: 0 }, { x: 600, y: 600 }),
    expected,
    'passive marquee markers still support explicit Alt rectangle selection of grips',
  );
});

test('shared model snap resolves the visible group datum outside body bounds during Move and Copy', (t) => {
  fakeDocument(t);
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [bolt];
  for (const key of Object.keys(project.snap)) project.snap[key] = false;
  project.snap.endpoints = true;
  const tools = { operation: { mode: 'move' } };
  const camera = new THREE.OrthographicCamera(-300, 300, 300, -300, 1, 3000);
  camera.position.set(500, 0, 1300);
  camera.lookAt(500, 0, 300);
  camera.updateMatrixWorld();
  let visible = true;
  const picking = createModelPicking({
    project,
    tools,
    ui: { selectedIds: new Set([bolt.id]) },
    camera,
    objects: new THREE.Group(),
    host: {
      clientWidth: 600,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 }),
    },
    isVisible: () => visible,
    getSnapIndex: () => ({ query: () => [], nearbyContext: () => null }),
    getReferences: () => null,
    updateSnapOverlay() {},
  });
  for (const mode of ['move', 'copy']) {
    tools.operation = { mode };
    assert.deepEqual(picking.point({ clientX: 300, clientY: 300 }), [500, 0, 300]);
    assert.equal(tools.activeSnap.kind, 'point');
  }
  tools.nextPointSnap = 'nearest';
  picking.point({ clientX: 300, clientY: 300 });
  assert.equal(
    tools.activeSnap.point,
    null,
    'an explicit different next-point snap remains exclusive',
  );
  tools.nextPointSnap = null;
  visible = false;
  picking.point({ clientX: 300, clientY: 300 });
  assert.notEqual(tools.activeSnap.kind, 'point', 'hidden source datums cannot snap');
  visible = true;
  tools.operation = null;
  picking.point({ clientX: 300, clientY: 300 });
  assert.notEqual(tools.activeSnap.kind, 'point', 'command-only datums are cleared on exit');
});
