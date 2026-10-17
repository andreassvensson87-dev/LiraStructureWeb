import test from 'node:test';
import assert from 'node:assert/strict';
import { installContextMenuDismissal } from '../src/ui/context-menu-dismissal.js';

function fixture() {
  const root = new EventTarget();
  let open = true;
  const forwarded = [];
  const dispose = installContextMenuDismissal(root, {
    isOpen: () => open,
    contains: (target) => target.inside,
    close: () => {
      open = false;
    },
  });
  for (const type of ['pointerdown', 'pointerup', 'click'])
    root.addEventListener(type, () => forwarded.push(type));
  function send(type, { inside = false, button = 0 } = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), { button, pointerId: 1 });
    Object.defineProperty(event, 'target', { value: { inside } });
    root.dispatchEvent(event);
  }
  return { send, forwarded, dispose, isOpen: () => open };
}

test('outside dismissal consumes the entire gesture; the next point works normally', () => {
  const f = fixture();
  for (const type of ['pointerdown', 'pointerup', 'click']) f.send(type);
  assert.equal(f.isOpen(), false);
  assert.deepEqual(f.forwarded, []);
  for (const type of ['pointerdown', 'pointerup', 'click']) f.send(type);
  assert.deepEqual(f.forwarded, ['pointerdown', 'pointerup', 'click']);
});

test('submenu commands and right-click repositioning keep their original handlers', () => {
  for (const options of [{ inside: true }, { button: 2 }]) {
    const f = fixture();
    for (const type of ['pointerdown', 'pointerup', 'click']) f.send(type, options);
    assert.equal(f.isOpen(), true);
    assert.deepEqual(f.forwarded, ['pointerdown', 'pointerup', 'click']);
  }
});

test('a long-press release cannot place a point, and disposal removes interception', () => {
  const f = fixture();
  f.send('pointerup');
  f.send('click');
  assert.deepEqual(f.forwarded, []);
  assert.equal(f.isOpen(), true);
  f.dispose();
  f.send('pointerdown');
  assert.deepEqual(f.forwarded, ['pointerdown']);
});
