import test from 'node:test';
import assert from 'node:assert/strict';
import templates from '../src/bundled-drawing-templates.js';
import { installDrawingTemplates } from '../src/install-drawing-templates.js';
import { FRAME_LIBRARY_KEY, attributeValue } from '../src/frame-model.js';
import { LAYOUT_KEY, expandLayout } from '../src/frame-layout.js';
import { DRAWING_PRESETS_KEY } from '../src/drawing-presets.js';
import { builtInAttributes, drawingAttributeContext } from '../src/drawing-attributes.js';
import { frameText } from '../src/frame-text.js';
import { ensureGAViews } from '../src/drawing-views.js';
import { arrangePartViews } from '../src/part-view-migration.js';

function storage(initial = []) {
  const values = new Map(initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
test('supplied CAD templates retain dimensions and place title borders at the inner paper border', () => {
  assert.equal(templates.blocks.length, 5);
  for (const [index, dimensions, margin] of [
    [0, [841, 594], 20],
    [1, [420, 297], 10],
    [2, [210, 297], 10],
  ]) {
    const layout = templates.layouts[index];
    assert.deepEqual([layout.width, layout.height], dimensions);
    const title = expandLayout({ ...layout, entities: [layout.entities[1]] }, templates.blocks);
    const points = title.filter((e) => e.points).flatMap((e) => e.points);
    assert.equal(Math.max(...points.map((p) => p[0])), dimensions[0] - margin);
    assert.equal(Math.min(...points.map((p) => p[1])), margin);
    for (const e of expandLayout(layout, templates.blocks)) {
      for (const p of e.points || [e.point]) {
        assert.ok(p[0] >= 0 && p[0] <= layout.width);
        assert.ok(p[1] >= 0 && p[1] <= layout.height);
      }
      if (e.type === 'attribute') assert.ok(builtInAttributes.some((a) => a.key === e.key));
    }
    assert.ok(layout.contentArea[3] < dimensions[1] - margin - 46);
  }
});
test('install merges existing libraries and presets once without changing user defaults or edits', () => {
  const saved = { id: 'saved', name: 'Egen' };
  const store = storage([
    [FRAME_LIBRARY_KEY, JSON.stringify([saved])],
    [LAYOUT_KEY, JSON.stringify([saved])],
    [DRAWING_PRESETS_KEY, JSON.stringify({ items: [saved], defaultId: 'saved' })],
  ]);
  installDrawingTemplates(store);
  assert.equal(JSON.parse(store.getItem(FRAME_LIBRARY_KEY)).length, 6);
  assert.equal(JSON.parse(store.getItem(LAYOUT_KEY)).length, 4);
  assert.equal(JSON.parse(store.getItem(DRAWING_PRESETS_KEY)).defaultId, 'saved');
  store.setItem(FRAME_LIBRARY_KEY, '[]');
  installDrawingTemplates(store);
  assert.equal(store.getItem(FRAME_LIBRARY_KEY), '[]');
  const fresh = storage();
  installDrawingTemplates(fresh);
  assert.equal(JSON.parse(fresh.getItem(DRAWING_PRESETS_KEY)).items[0].layoutId, 'mall-layout-a3');
});
test('failed installation rolls back libraries and can be retried', () => {
  const store = storage([[FRAME_LIBRARY_KEY, '[{"id":"mine"}]']]);
  const set = store.setItem;
  store.setItem = (key, value) => {
    if (key === DRAWING_PRESETS_KEY) throw Error('Full');
    set(key, value);
  };
  assert.throws(() => installDrawingTemplates(store), /Full/);
  assert.equal(store.getItem(FRAME_LIBRARY_KEY), '[{"id":"mine"}]');
  assert.equal(store.getItem(LAYOUT_KEY), null);
  store.setItem = set;
  installDrawingTemplates(store);
  assert.equal(JSON.parse(store.getItem(LAYOUT_KEY)).length, 3);
});
test('title attributes show project, drawing and scale values; multiline names fit their cells', () => {
  const record = {
    type: 'SP',
    number: 'K-101',
    name: 'Balk över entré och trapphus',
    issueStatus: 'FÖR GRANSKNING',
    sheet: { views: [{ scale: 10 }, { scale: 10 }] },
  };
  const context = drawingAttributeContext(record, { info: { name: 'Projekt Eken', number: '42' } });
  assert.equal(attributeValue('drawing.scale', context), '1:10');
  assert.equal(attributeValue('project.number', context), '42');
  record.sheet.views[1].scale = 5;
  assert.equal(drawingAttributeContext(record).drawing.scale, 'Enl. vyer');
  record.sheet.views = [{ scale: 0.5 }];
  assert.equal(drawingAttributeContext(record).drawing.scale, '2:1');
  for (const block of templates.blocks.filter((b) => b.titleBlock)) {
    assert.ok(block.entities.some((e) => e.key === 'drawing.number'));
    assert.ok(!block.entities.some((e) => e.text === '-'));
    const rows = block.entities
      .filter((e) => e.key === 'drawing.name')
      .sort((a, b) => a.row - b.row);
    assert.ok(block.entities.find((e) => e.key === 'drawing.category').point[1] > rows[0].point[1]);
    const rendered = rows.map((e) => frameText(e, context, attributeValue));
    assert.equal(
      rendered
        .map((r) => r.value)
        .filter(Boolean)
        .join(' '),
      record.name,
    );
    for (const e of block.entities.filter((e) => e.type === 'attribute')) {
      const text = frameText(e, context, attributeValue);
      assert.ok(text.value.length * text.size * 0.65 <= e.maxWidth + 1e-6);
    }
  }
});
test('new GA and arranged part views respect the reserved title area; existing GA views stay in place', () => {
  const layout = templates.layouts[2],
    area = layout.contentArea;
  const record = { type: 'GA' };
  ensureGAViews(record, [210, 297], [0, 0], 50, area);
  const view = record.sheet.views[0];
  assert.deepEqual(view.position, area.slice(0, 2));
  assert.equal(view.position[1] + view.size[1], area[3]);
  view.position = [60, 70];
  ensureGAViews(record, [210, 297], [0, 0], 50, area);
  assert.deepEqual(view.position, [60, 70]);
  const parts = [{ size: [100, 40] }, { size: [100, 40] }];
  arrangePartViews(parts, 210, area);
  assert.deepEqual(
    parts.map((v) => v.position),
    [
      [20, 10],
      [20, 62],
    ],
  );
});
