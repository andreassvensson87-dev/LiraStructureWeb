import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeasure, boundsMeasures } from '../src/geometry/measurements.js';
import { measurementLayout } from '../src/ui/measurement-layout.js';
import { modelFeedbackMeasures } from '../src/model/measurements.js';
import { drawingFeedbackMeasures, drawingObjectMeasures } from '../src/drawing-measurements.js';
import { objectType } from '../src/model/object-types/index.js';
const sweep = { id: 's', type: 'sweep', start: [0, 0, 0], end: [3000, 4000, 0] };
const model = () => ({
  project: { objects: [sweep], assemblies: [] },
  ui: { selectedIds: new Set(['s']), selectionMode: 'part' },
  tools: { drawing: false, operation: null },
});
test('single selection uses real source dimensions, clears on deselection, multiple selection and other tools', () => {
  const state = model(),
    before = JSON.stringify(state.project);
  assert.equal(modelFeedbackMeasures(state)[0].value, 5000);
  state.ui.selectedIds.clear();
  assert.deepEqual(modelFeedbackMeasures(state), []);
  state.ui.selectedIds = new Set(['s', 'other']);
  assert.deepEqual(modelFeedbackMeasures(state), []);
  state.ui.selectedIds = new Set(['s']);
  state.tools.drawing = true;
  assert.deepEqual(modelFeedbackMeasures(state), []);
  state.tools.drawing = false;
  assert.deepEqual(modelFeedbackMeasures({ ...state, visible: () => false }), []);
  assert.equal(JSON.stringify(state.project), before);
});
test('move/copy measure the same resolved destination as preview, then drop the displacement on confirm/cancel', () => {
  const state = model();
  state.ui.preview = {};
  Object.assign(state.tools, {
    operation: { mode: 'copy' },
    drawing: true,
    first: [0, 0, 0],
    activeSnap: { point: [300, 400, 0] },
  });
  assert.equal(modelFeedbackMeasures(state)[0].value, 500);
  state.tools.typedPoint = [600, 800, 0];
  assert.equal(modelFeedbackMeasures(state)[0].value, 1000);
  state.ui.preview = null;
  assert.deepEqual(
    modelFeedbackMeasures(state),
    [],
    'Rejected preview must not keep an old distance',
  );
  state.tools.operation = null;
  state.tools.drawing = false;
  assert.equal(
    modelFeedbackMeasures(state)[0].value,
    5000,
    'Only the selected object length remains',
  );
  state.ui.selectedIds.clear();
  assert.deepEqual(modelFeedbackMeasures(state), []);
});
test('plate and polysweep use tangent lengths and actual radii without modifying insertion points', () => {
  const poly = {
      type: 'polysweep',
      points: [
        [0, 0, 0],
        [1000, 0, 0],
        [1000, 1000, 0],
      ],
      radii: [0, 100, 0],
    },
    before = structuredClone(poly);
  const measures = objectType(poly).measurements(poly);
  assert.deepEqual(
    measures.filter((m) => m.kind === 'length').map((m) => Math.round(m.value)),
    [900, 900],
  );
  assert.equal(measures.find((m) => m.kind === 'radius').value, 100);
  assert.deepEqual(poly, before);
  const plate = {
    type: 'plate',
    polygon: [
      [0, 0],
      [1000, 0],
      [1000, 1000],
      [0, 1000],
    ],
    radii: [100, 100, 100, 100],
    frame: { origin: [100, 200, 300], u: [1, 0, 0], v: [0, 0, 1] },
  };
  const edges = objectType(plate).measurements(plate);
  assert.equal(edges.filter((m) => m.kind === 'radius').length, 4);
  assert.ok(edges.filter((m) => m.kind === 'length').every((m) => Math.abs(m.value - 800) < 1e-7));
});
test('one assembly gets extents and ordinary multi-part selection does not', () => {
  const state = model();
  state.project.objects = [
    { ...sweep, profile: 'rect', width: 100, height: 100, rotation: 0 },
    {
      ...sweep,
      id: 'other',
      start: [0, 0, 1000],
      end: [3000, 4000, 1000],
      profile: 'rect',
      width: 100,
      height: 100,
      rotation: 0,
    },
  ];
  state.ui.selectedIds.add('other');
  state.project.assemblies = [{ memberIds: ['s', 'other'] }];
  assert.deepEqual(modelFeedbackMeasures(state), []);
  state.ui.selectionMode = 'assembly';
  assert.equal(modelFeedbackMeasures(state).length, 3);
  assert.deepEqual(
    boundsMeasures([
      [0, 0],
      [10, 20],
    ]).map((m) => m.value),
    [10, 20],
  );
});
test('drawing forms keep model millimetres irrespective of view scale, and exact transform distance is temporary', () => {
  const item = {
    id: 'line',
    type: 'shape',
    shape: 'line',
    view: 'v',
    points: [
      [0, 0],
      [3000, 4000],
    ],
  };
  const editor = { items: [item], selectedIds: new Set(['line']), mode: null };
  assert.equal(drawingFeedbackMeasures(editor)[0].value, 5000);
  assert.deepEqual(
    drawingObjectMeasures({
      ...item,
      shape: 'rectangle',
      points: [
        [0, 0],
        [100, 50],
      ],
    }).map((m) => m.value),
    [100, 50],
  );
  assert.equal(
    drawingObjectMeasures({
      ...item,
      shape: 'circle',
      points: [
        [0, 0],
        [0, 100],
      ],
    })[0].kind,
    'radius',
  );
  assert.deepEqual(
    drawingObjectMeasures({
      ...item,
      shape: 'insulation',
      points: [
        [0, 0],
        [1000, 0],
      ],
      thickness: 150,
      side: 'left',
    }).map((m) => m.value),
    [1000, 150],
  );
  editor.selectedIds.add('other');
  assert.deepEqual(drawingFeedbackMeasures(editor), []);
  editor.mode = 'move-shapes';
  editor.transform = {
    active: () => true,
    base: [0, 0],
    phase: 'destination',
    view: 'v',
    exactDistance: '1250',
  };
  editor.hover = { view: 'v', point: [3000, 4000] };
  assert.ok(Math.abs(drawingFeedbackMeasures(editor)[0].value - 1250) < 1e-6);
  editor.transform.phase = 'base';
  assert.deepEqual(drawingFeedbackMeasures(editor), []);
  editor.mode = null;
  editor.transform.active = () => false;
  editor.selectedIds.clear();
  assert.deepEqual(drawingFeedbackMeasures(editor), []);
});
test('screen labels and ticks remain constant at different zoom/scales without changing real dimension value', () => {
  const [measure] = distanceMeasure([0, 0], [3000, 4000]);
  const a = measurementLayout(measure, (p) => p.map((v) => v / 50), 1),
    b = measurementLayout(measure, (p) => p.map((v) => v / 50), 2);
  assert.equal(a.label, b.label);
  assert.equal(a.fontSize, b.fontSize * 2);
  const tickLength = (layout, k) => {
    const [p, q] = layout.lines.at(-1);
    return Math.hypot(q[0] - p[0], q[1] - p[1]) * k;
  };
  assert.ok(Math.abs(tickLength(a, 1) - tickLength(b, 2)) < 1e-9);
  assert.equal(
    measurementLayout(measure, () => null),
    null,
  );
  const reverse = measurementLayout({ ...measure, a: measure.b, b: measure.a }, (p) =>
    p.map((v) => v / 50),
  );
  assert.ok(reverse.angle >= -90 && reverse.angle <= 90);
});

test('PDF page cleaning excludes shared measurement graphics and preserves real drawing geometry and source overlay', async (t) => {
  const { paintMeasurements } = await import('../src/ui/measurement-overlay.js');
  const { singlePartPDFPage } = await import('../src/drawing-pdf.js');
  const previous = globalThis.document;
  const element = (tag) => ({
    tag,
    attrs: {},
    children: [],
    setAttribute(key, value) {
      this.attrs[key] = String(value);
    },
    getAttribute(key) {
      return this.attrs[key] ?? null;
    },
    removeAttribute(key) {
      delete this.attrs[key];
    },
    append(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    },
    remove() {
      this.parent.children = this.parent.children.filter((child) => child !== this);
    },
    querySelectorAll(selector) {
      const all = this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
      if (selector === '*') return all;
      const key = selector.includes('[data-annotation-helper]')
        ? 'data-annotation-helper'
        : selector.slice(1, -1);
      return all.filter((child) => child.getAttribute(key) !== null);
    },
    cloneNode(deep) {
      const clone = element(this.tag);
      clone.attrs = { ...this.attrs };
      clone.textContent = this.textContent;
      if (deep) clone.append(...this.children.map((child) => child.cloneNode(true)));
      return clone;
    },
  });
  globalThis.document = { createElementNS: (_, tag) => element(tag) };
  t.after(() => {
    globalThis.document = previous;
  });
  const svg = element('svg'),
    realLine = element('path');
  realLine.setAttribute('d', 'M0,0L100,0');
  svg.append(realLine);
  paintMeasurements(svg, distanceMeasure([0, 0], [100, 0]), (p) => p);
  assert.equal(svg.querySelectorAll('[data-annotation-helper]').length, 1);
  const page = singlePartPDFPage({ paper: [420, 297], svg });
  assert.equal(page.svg.querySelectorAll('[data-annotation-helper]').length, 0);
  assert.deepEqual(
    page.svg.querySelectorAll('*').map((child) => child.getAttribute('d')),
    ['M0,0L100,0'],
  );
  assert.equal(
    svg.querySelectorAll('[data-annotation-helper]').length,
    1,
    'Export must not remove feedback from the open editor',
  );
});
