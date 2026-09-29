import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findDrawingLayout,
  appendDrawingLayout,
  drawingLayoutStamp,
} from '../src/drawing-layout.js';
import { FRAME_LIBRARY_KEY } from '../src/frame-model.js';
import { LAYOUT_KEY } from '../src/frame-layout.js';
test('drawing layout renders referenced block with live drawing attributes and its paper size', () => {
  const store = new Map([
    [
      LAYOUT_KEY,
      JSON.stringify([
        {
          id: 'layout',
          width: 420,
          height: 297,
          entities: [{ id: 'i', blockId: 'b', anchor: 'bottom-right', point: [-80, 10] }],
        },
      ]),
    ],
    [
      FRAME_LIBRARY_KEY,
      JSON.stringify([
        {
          id: 'b',
          origin: [0, 0],
          entities: [
            { type: 'attribute', point: [0, 0], key: 'drawing.name', size: 3.5, align: 'start' },
          ],
        },
      ]),
    ],
  ]);
  const previousStorage = globalThis.localStorage,
    previousDocument = globalThis.document;
  globalThis.localStorage = { getItem: (key) => store.get(key) || null };
  const node = () => ({
    attrs: {},
    children: [],
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    append(e) {
      this.children.push(e);
    },
  });
  globalThis.document = { createElementNS: () => node() };
  try {
    const layout = findDrawingLayout('layout'),
      root = node();
    appendDrawingLayout(root, layout, { drawing: { name: 'Plan över tak' } });
    assert.equal(root.children[0].attrs.transform, 'translate(0 297) scale(1 -1)');
    const group = root.children[0].children[0];
    assert.match(group.attrs.transform, /translate\(340 10\)/);
    assert.equal(group.children[0].textContent, 'Plan över tak');
    const stamp = JSON.stringify(drawingLayoutStamp('layout'));
    store.set(FRAME_LIBRARY_KEY, store.get(FRAME_LIBRARY_KEY).replace('3.5', '4.5'));
    assert.notEqual(JSON.stringify(drawingLayoutStamp('layout')), stamp);
    assert.deepEqual(drawingLayoutStamp('missing'), { missing: 'missing' });
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.document = previousDocument;
  }
});
