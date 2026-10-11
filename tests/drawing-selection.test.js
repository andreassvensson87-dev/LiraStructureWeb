import test from 'node:test';
import assert from 'node:assert/strict';
import { drawingMarqueeHits } from '../src/drawing-selection-geometry.js';
import { polarTrackingIntersection, CadTracking } from '../src/cad-tracking.js';
import { DrawingAnnotations } from '../src/drawing-annotations.js';

test('drawing windows require complete enclosure, crossing windows intersect actual geometry and closed interiors', () => {
  const line = [
    {
      points: [
        [0, 0],
        [100, 100],
      ],
      closed: false,
    },
  ];
  assert.equal(drawingMarqueeHits(line, [-1, -1], [101, 101]), true);
  assert.equal(drawingMarqueeHits(line, [40, 40], [60, 60]), false);
  assert.equal(drawingMarqueeHits(line, [60, 40], [40, 60]), true);
  assert.equal(drawingMarqueeHits(line, [60, 0], [40, 10]), false); // overlaps bounds, not line
  const polygon = [
    {
      points: [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      closed: true,
    },
  ];
  assert.equal(drawingMarqueeHits(polygon, [60, 40], [40, 60]), true);
  assert.equal(drawingMarqueeHits(polygon, [40, 40], [60, 60]), false);
  assert.equal(drawingMarqueeHits([], [0, 0], [100, 100]), false);
});

test('polar meets the acquired Otrack axis at a stable corner, including diagonal directions', () => {
  const tracker = new CadTracking();
  tracker.locate([100, 80], { snapped: true, now: 0, view: 'v' });
  const horizontal = tracker.locate([101, 2], { now: 400, view: 'v', tolerance: 4 });
  assert.deepEqual(
    polarTrackingIntersection([101, 2], [0, 0], horizontal, { polar: 90, tolerance: 4 }),
    [100, 0],
  );
  const diagonal = polarTrackingIntersection([101, 102], [0, 0], horizontal, {
    polar: 45,
    tolerance: 4,
  });
  assert.ok(Math.abs(diagonal[1] - 100) < 1e-8);
  assert.equal(diagonal[0], 100);
  assert.equal(
    polarTrackingIntersection([101, 30], [0, 0], horizontal, { polar: 90, tolerance: 4 }),
    null,
  );
  assert.equal(
    polarTrackingIntersection([101, 2], [100, 0], horizontal, { polar: 90, tolerance: 4 }),
    null,
  ); // parallel
  assert.equal(
    polarTrackingIntersection([101, 2], [0, 0], horizontal, { polar: 0, tolerance: 4 }),
    null,
  );
  assert.equal(
    polarTrackingIntersection([101, 2], [0, 0], { guides: [] }, { polar: 90, tolerance: 4 }),
    null,
  );
});

test('drawing transform shortcuts match the model and preserve text editing and repeated keys', () => {
  const calls = [];
  const editor = {
    selected: 'part',
    cad: { key: () => false },
    contextMenu: { hidden: true },
    transform: { active: () => false, start: (mode) => calls.push(mode) },
  };
  function key(character, modifier, editing = false, repeat = false) {
    const event = {
      key: character,
      [modifier]: true,
      repeat,
      target: { closest: () => (editing ? {} : null) },
      preventDefault() {},
      stopImmediatePropagation() {},
    };
    DrawingAnnotations.prototype.key.call(editor, event);
  }
  key('m', 'ctrlKey');
  key('c', 'metaKey');
  key('r', 'ctrlKey');
  assert.deepEqual(calls, ['move-shapes', 'copy-shapes', 'rotate-shapes']);
  key('c', 'metaKey', true);
  key('r', 'ctrlKey', false, true);
  assert.equal(calls.length, 3);
  editor.selected = null;
  key('m', 'ctrlKey');
  assert.equal(calls.length, 3);
});

test('native Copy is a drawing command but leaves editable clipboard contents alone', () => {
  const calls = [];
  const editor = { selected: 'part', mode: null, transform: { start: (mode) => calls.push(mode) } };
  let prevented = false;
  const event = {
    target: { closest: () => null },
    preventDefault() {
      prevented = true;
    },
    stopImmediatePropagation() {},
  };
  DrawingAnnotations.prototype.copySelection.call(editor, event);
  assert.deepEqual(calls, ['copy-shapes']);
  assert.equal(prevented, true);
  event.target.closest = () => ({});
  DrawingAnnotations.prototype.copySelection.call(editor, event);
  assert.equal(calls.length, 1);
});

test('Shift rectangles add to the existing selection and pointer cancellation preserves it', async () => {
  const { DrawingMarquee } = await import('../src/drawing-marquee.js');
  const editor = {
    items: [{ id: 'a' }, { id: 'b' }],
    selected: 'a',
    selectedIds: new Set(['a']),
    ui() {},
    cancel() {},
    surface: { setAttribute() {}, focus() {} },
    adapter: {
      redraw() {},
      cancelTools() {
        editor.selected = null;
        editor.selectedIds.clear();
      },
    },
  };
  const marquee = Object.assign(Object.create(DrawingMarquee.prototype), {
    editor,
    enabled: true,
    gesture: { id: 1, start: [20, 20], additive: true },
    cancel() {
      this.gesture = null;
    },
    contours(item) {
      return [
        {
          points:
            item.id === 'b'
              ? [
                  [30, 30],
                  [40, 40],
                ]
              : [
                  [0, 0],
                  [10, 10],
                ],
          closed: false,
        },
      ];
    },
  });
  const event = {
    pointerId: 1,
    clientX: 50,
    clientY: 50,
    preventDefault() {},
    stopImmediatePropagation() {},
  };
  marquee.start();
  assert.equal(editor.selected, 'a');
  assert.deepEqual([...editor.selectedIds], ['a']);
  marquee.up(event);
  assert.deepEqual([...editor.selectedIds], ['a', 'b']);
  assert.equal(editor.selected, 'b');
  marquee.gesture = { id: 1, start: [0, 0], additive: false };
  marquee.up(event, true);
  assert.deepEqual([...editor.selectedIds], ['a', 'b']);
});
