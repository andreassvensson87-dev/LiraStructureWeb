import test from 'node:test';
import assert from 'node:assert/strict';
import { standardDrawingLayouts } from '../src/frame-standard-layouts.js';
import { titleExampleBlock } from '../src/frame-title-example.js';
import { revisionExampleBlock } from '../src/frame-revision-example.js';
import { expandLayout, instancePoint } from '../src/frame-layout.js';
import { builtInAttributes } from '../src/frame-model.js';
test('standard A4 A3 and A1 layouts place separate live blocks with exact margins and spacing', () => {
  const title = titleExampleBlock(),
    revision = revisionExampleBlock();
  const layouts = standardDrawingLayouts(title, revision);
  assert.deepEqual(
    layouts.map((l) => [l.width, l.height]),
    [
      [210, 297],
      [420, 297],
      [841, 594],
    ],
  );
  for (const layout of layouts) {
    const [head, revisions] = layout.entities;
    assert.equal(head.blockId, title.id);
    assert.equal(revisions.blockId, revision.id);
    assert.equal(head.anchor, 'bottom-right');
    assert.deepEqual(instancePoint(head, layout), [layout.width - 190, 10]);
    assert.deepEqual(instancePoint(revisions, layout), [layout.width - 190, 69]);
    const rows = ['A', 'B', 'C'].map((r) => ({ revision: r }));
    const expanded = expandLayout(layout, [title, revision], { revision: 'C', revisions: rows });
    assert.equal(expanded.find((e) => e.text === 'REV.').point[1], 73);
    assert.equal(expanded.find((e) => e.text === 'A').point[1], 82);
    assert.equal(expanded.find((e) => e.text === 'C').point[1], 102);
    assert.deepEqual(instancePoint(head, { ...layout, width: 1000 }), [810, 10]);
  }
  assert.ok(
    title.entities
      .filter((e) => e.type === 'attribute')
      .every((e) => builtInAttributes.some((a) => a.key === e.key)),
  );
  assert.equal(title.revisionTable, undefined);
});
test('layout margins honour block origins and reject blocks that do not fit', () => {
  const title = { ...titleExampleBlock(), origin: [20, 5] },
    revision = revisionExampleBlock();
  const layout = standardDrawingLayouts(title, revision, { papers: ['A4'], margin: 15, gap: 8 })[0];
  assert.deepEqual(instancePoint(layout.entities[0], layout), [35, 20]);
  assert.deepEqual(instancePoint(layout.entities[1], layout), [15, 77]);
  assert.throws(() => standardDrawingLayouts({ ...title, width: 300 }, revision), /ryms inte/);
  assert.throws(() => standardDrawingLayouts(title, revision, { papers: [] }), /Välj/);
  assert.throws(() => standardDrawingLayouts(title, revision, { margin: -1 }), /avstånd/);
});
