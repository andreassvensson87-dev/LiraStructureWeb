import test from 'node:test';
import assert from 'node:assert/strict';
import { assemblyScheduleTable, newMaterialSchedule } from '../src/assembly-schedule.js';
import {
  materialScheduleHeight,
  materialSchedulePosition,
  appendMaterialSchedule,
} from '../src/assembly-material-schedule.js';
const rows = [
  {
    key: 'a',
    mark: 'B-001',
    name: 'RHS',
    material: 'S355',
    quantity: 1,
    length: 1000,
    weight: 5.9,
  },
];
test('material list docks beside A3 title block and above title block on narrow sheets', () => {
  const table = assemblyScheduleTable(rows, newMaterialSchedule());
  const layout = {
    width: 420,
    height: 297,
    contentArea: [20, 10, 410, 235],
    entities: [{ id: 'A3-title', type: 'block', anchor: 'bottom-right', point: [-190, 10] }],
  };
  assert.deepEqual(materialSchedulePosition(table, [420, 297], layout), [
    120,
    287 - materialScheduleHeight(table),
  ]);
  layout.width = 210;
  assert.deepEqual(materialSchedulePosition(table, [210, 297], layout), [
    20,
    235 - materialScheduleHeight(table),
  ]);
});
test('vector output contains dynamic rows and notes without reference sample values', () => {
  const element = (tag) => ({
    tag,
    attrs: {},
    children: [],
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    append(...items) {
      this.children.push(...items);
    },
  });
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_, tag) => element(tag) };
  try {
    const svg = element('svg');
    const table = assemblyScheduleTable(
      rows,
      newMaterialSchedule({ notes: { execution: 'EXC3', weldInstructions: 'a6' } }),
    );
    const g = appendMaterialSchedule(svg, table, 'assembly', 4);
    const texts = g.children.filter((e) => e.tag === 'text').map((e) => e.textContent);
    for (const value of [
      'B-001',
      '1000',
      '5,9',
      '4',
      'EXC3',
      'a6',
      'MATERIALLISTAN NEDAN AVSER ETT ELEMENT',
    ])
      assert.ok(texts.includes(value), value);
    assert.ok(!texts.includes('EXC2'));
    assert.equal(g.attrs['data-assembly-schedule'], 'assembly');
    assert.ok(g.children.some((e) => e.tag === 'clipPath'));
  } finally {
    globalThis.document = previous;
  }
});

test('list grows upward from one to twenty rows and shrinks back with its footer fixed', () => {
  const layout = {
    width: 420,
    height: 297,
    contentArea: [20, 10, 410, 235],
    entities: [{ id: 'A3-title', type: 'block', anchor: 'bottom-right', point: [-190, 10] }],
  };
  const tables = [1, 20, 1].map((count) =>
    assemblyScheduleTable(
      Array.from({ length: count }, (_, i) => ({ ...rows[0], key: String(i), mark: `B-${i}` })),
      newMaterialSchedule(),
    ),
  );
  const positions = tables.map((table) => materialSchedulePosition(table, [420, 297], layout));
  for (const [i, table] of tables.entries()) {
    assert.equal(table.values.length, table.rows.length + 1);
    assert.equal(positions[i][1] + materialScheduleHeight(table), 287);
    assert.equal(table.settings.dockToTitle, true);
  }
  assert.equal(positions[0][1] - positions[1][1], 19 * 3.5);
  assert.deepEqual(positions[0], positions[2]);
});
