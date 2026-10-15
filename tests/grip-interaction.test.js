import test from 'node:test';
import assert from 'node:assert/strict';
import { createGripInteraction } from '../src/model/ui/grip-interaction-controller.js';
function fixture(t) {
  const events = () => ({
    handlers: new Map(),
    addEventListener(type, fn) {
      this.handlers.set(type, fn);
    },
    removeEventListener(type) {
      this.handlers.delete(type);
    },
  });
  const root = events(),
    host = events(),
    controls = { enabled: true },
    log = [];
  host.ownerDocument = root;
  root.defaultView = events();
  let captured;
  host.setPointerCapture = (id) => {
    captured = id;
  };
  host.hasPointerCapture = (id) => captured === id;
  host.releasePointerCapture = () => {
    captured = null;
  };
  host.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: 300 });
  const controller = createGripInteraction({
    host,
    getGrip: (target) => target?.grip,
    canStart: () => true,
    select: (grip) => log.push(['select', grip]),
    beginBox: () => log.push(['box']),
    begin: (grip) => {
      log.push(['begin', grip]);
      return true;
    },
    preview: () => log.push(['preview']),
    commit: () => {
      log.push(['commit']);
      return true;
    },
    cancel: () => log.push(['cancel']),
    getControls: () => controls,
  });
  const grip = { point: [0, 0, 0], refs: [{ id: 'poly', kind: 1 }] };
  const e = (x = 10, y = 10, other = {}) => ({
    pointerId: 1,
    button: 0,
    clientX: x,
    clientY: y,
    target: { grip },
    preventDefault() {},
    stopImmediatePropagation() {},
    ...other,
  });
  t.after(() => controller.dispose());
  return { host, root, controls, log, e, grip };
}
test('grip click selects, drag previews and releases exactly one commit, fast release uses the same path', (t) => {
  const f = fixture(t);
  f.host.handlers.get('pointerdown')(f.e());
  f.root.handlers.get('pointerup')(f.e(12));
  assert.deepEqual(
    f.log.map((x) => x[0]),
    ['select'],
  );
  assert.equal(f.controls.enabled, true);
  f.log.length = 0;
  f.host.handlers.get('pointerdown')(f.e());
  f.root.handlers.get('pointermove')(f.e(40));
  f.root.handlers.get('pointerup')(f.e(60));
  assert.deepEqual(
    f.log.map((x) => x[0]),
    ['begin', 'preview', 'commit'],
  );
  f.log.length = 0;
  f.host.handlers.get('pointerdown')(f.e());
  f.root.handlers.get('pointerup')(f.e(50));
  assert.deepEqual(
    f.log.map((x) => x[0]),
    ['begin', 'preview', 'commit'],
  );
});
test('Alt starts the shared rectangle; Escape, capture loss, blur and outside release cancel without commit', (t) => {
  const f = fixture(t);
  f.host.handlers.get('pointerdown')(f.e(10, 10, { altKey: true }));
  assert.deepEqual(
    f.log.map((x) => x[0]),
    ['box'],
  );
  for (const reason of ['escape', 'capture', 'blur', 'outside']) {
    f.log.length = 0;
    f.host.handlers.get('pointerdown')(f.e());
    f.root.handlers.get('pointermove')(f.e(40));
    f.root.handlers.get('pointerup')(f.e(40, 10, { pointerId: 9 }));
    if (reason === 'escape') f.root.handlers.get('keydown')(f.e(40, 10, { key: 'Escape' }));
    if (reason === 'capture') f.host.handlers.get('lostpointercapture')(f.e());
    if (reason === 'blur') f.root.defaultView.handlers.get('blur')();
    if (reason === 'outside') f.root.handlers.get('pointerup')(f.e(500));
    assert.equal(f.log.filter((x) => x[0] === 'commit').length, 0, reason);
    assert.equal(f.log.filter((x) => x[0] === 'cancel').length, 1, reason);
    assert.equal(f.controls.enabled, true);
  }
});
