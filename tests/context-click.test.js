import test from 'node:test';
import assert from 'node:assert/strict';
import { installContextClick } from '../src/ui/context-click.js';

function fixture(options) {
  const surface = new EventTarget();
  const document = new EventTarget();
  surface.ownerDocument = document;
  const opened = [];
  installContextClick(surface, (event) => opened.push([event.clientX, event.clientY]), options);
  const send = (target, type, props = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      button: 2,
      clientX: 100,
      clientY: 200,
      ...props,
    });
    target.dispatchEvent(event);
    return event;
  };
  return { surface, document, opened, send };
}

test('press-based contextmenu waits for release without selecting during a camera drag', () => {
  const { surface, document, opened, send } = fixture();
  send(surface, 'pointerdown');
  assert.equal(send(surface, 'contextmenu').defaultPrevented, true);
  assert.deepEqual(opened, []);
  send(document, 'pointermove', { clientX: 120 });
  send(document, 'pointermove'); // Returning to the start still counts as a drag.
  send(document, 'pointerup');
  assert.deepEqual(opened, []);
  send(surface, 'pointerdown');
  send(surface, 'contextmenu');
  send(document, 'pointerup');
  assert.deepEqual(opened, [[100, 200]]);
});

test('a viewport adapter can include model grips while excluding unrelated controls', () => {
  const { surface, document, opened, send } = fixture({ accepts: (event) => event.modelHit });
  send(surface, 'contextmenu', { modelHit: false });
  assert.deepEqual(opened, []);
  send(surface, 'pointerdown', { modelHit: true });
  send(document, 'pointerup');
  send(surface, 'contextmenu', { modelHit: true });
  assert.deepEqual(opened, [[100, 200]]);
});

test('release-based menus open once for a click and remain suppressed after a drag', () => {
  const { surface, document, opened, send } = fixture();
  send(surface, 'pointerdown');
  send(document, 'pointerup');
  send(surface, 'contextmenu');
  assert.deepEqual(opened, [[100, 200]]);
  send(surface, 'pointerdown');
  send(document, 'pointermove', { clientY: 220 });
  send(document, 'pointerup');
  send(surface, 'contextmenu');
  assert.equal(opened.length, 1);
  send(surface, 'contextmenu', { button: 0 }); // Keyboard menu after a camera drag.
  assert.equal(opened.length, 2);
});

test('cancelled press discards its pending menu and a later control-click can open normally', () => {
  const { surface, document, opened, send } = fixture();
  send(surface, 'pointerdown');
  send(surface, 'contextmenu');
  send(surface, 'pointercancel');
  send(document, 'pointerup');
  assert.deepEqual(opened, []);
  send(surface, 'pointerdown', { button: 0 });
  send(surface, 'contextmenu', { button: 0 });
  assert.deepEqual(opened, [[100, 200]]);
});
