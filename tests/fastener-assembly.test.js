import test from 'node:test';
import { readFileSync } from 'node:fs';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import assert from 'node:assert/strict';
import {
  assemblyDefaults,
  fittedAssembly,
  selectFastenerLength,
} from '../src/fasteners/assembly.js';
import { automaticPlacement } from '../src/fasteners/placement.js';
import { validateFastener } from '../src/fasteners/object-type.js';
import { updateAutomaticJoints } from '../src/fasteners/update-joints.js';
import { numberParts, partStatus } from '../src/part-marks.js';

const spec = (length) => ({
  id: `m12-${length}`,
  revision: 1,
  kind: 'bolt',
  standard: 'ISO 4017',
  name: `M12 × ${length}`,
  diameter: 12,
  length,
  thread: { length, pitch: 1.75 },
  head: { kind: 'hex', diameter: 18, height: 7.5 },
  nut: { acrossFlats: 18, thickness: 10 },
  washer: { innerDiameter: 13, outerDiameter: 24, thickness: 2.5 },
});
const plate = {
  id: 'p',
  type: 'plate',
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  polygon: [
    [-50, -50],
    [50, -50],
    [50, 50],
    [-50, 50],
  ],
  thickness: 20,
  side: 'positive',
};
const draft = {
  id: 's',
  type: 'fastener',
  spec: spec(30),
  start: [0, 0, -100],
  end: [0, 0, -70],
  holes: [
    { targetId: 'p', kind: 'clearance', extent: 'profile', offset: 0, depth: 20, diameter: 14 },
  ],
  assembly: { nearWasher: true, nearNut: false, farWasher: true, nut: true, extraNut: false },
  lengthMode: 'auto',
  extraLength: 5,
  lengthOptions: [spec(30), spec(40), spec(50), spec(60)],
};
test('assembly seats selected hardware at material faces and picks shortest available length', () => {
  const original = structuredClone(draft);
  const result = automaticPlacement(draft, [0, 0, -100], [0, 0, -99], [plate]);
  assert.equal(result.spec.length, 40);
  assert.deepEqual(result.accessories, [
    { kind: 'washer', offset: 0 },
    { kind: 'washer', offset: 22.5 },
    { kind: 'nut', offset: 25 },
  ]);
  assert.deepEqual(result.start, [0, 0, -2.5]);
  assert.equal(result.holes[0].offset, 2.5);
  assert.equal(validateFastener(result), '');
  assert.deepEqual(draft, original);
});
test('extra nut and projection allowance select a longer length; missing lengths are explicit errors', () => {
  const extra = { ...draft, assembly: { ...draft.assembly, extraNut: true } };
  const result = automaticPlacement(extra, [0, 0, -100], [0, 0, -99], [plate]);
  assert.equal(result.spec.length, 50);
  assert.equal(result.accessories.at(-1).offset, 35);
  assert.equal(selectFastenerLength({ ...draft, extraLength: 10 }, 20).spec.length, 50);
  assert.throws(
    () => selectFastenerLength({ ...draft, lengthOptions: [spec(30)] }, 20),
    /Ingen passande.*40.00/,
  );
});
test('automatic selection keeps standard, diameter and product series and checks partial threads', () => {
  const partial = (length, threadLength) => ({
    ...spec(length),
    standard: 'ISO 4014',
    thread: { length: threadLength, pitch: 1.75 },
  });
  const s = {
    ...draft,
    spec: partial(50, 15),
    lengthOptions: [
      partial(50, 15),
      partial(60, 40),
      { ...spec(40), grade: '10.9' },
      { ...spec(40), diameter: 16 },
    ],
  };
  assert.equal(selectFastenerLength(s, 20).spec.length, 60);
  assert.throws(() => selectFastenerLength({ ...s, lengthOptions: [] }, 20), /Ingen passande/);
});
test('rod preset puts nuts on both sides while manual hardware remains unchanged', () => {
  const rod = { ...spec(100), kind: 'rod', head: undefined, standard: undefined };
  const s = {
    ...draft,
    spec: rod,
    lengthMode: 'manual',
    assembly: { ...assemblyDefaults(rod), nearWasher: true, farWasher: true, extraNut: true },
    startAllowance: 0,
  };
  const fitted = fittedAssembly(s, 20);
  assert.equal(fitted.startAllowance, 12.5);
  assert.deepEqual(fitted.accessories, [
    { kind: 'washer', offset: 10 },
    { kind: 'nut', offset: 0 },
    { kind: 'washer', offset: 32.5 },
    { kind: 'nut', offset: 35 },
    { kind: 'nut', offset: 45 },
  ]);
  const manual = {
    ...draft,
    lengthMode: 'manual',
    assembly: undefined,
    accessories: [{ kind: 'nut', offset: 20 }],
  };
  assert.equal(fittedAssembly(manual, 10), manual);
});
test('automatic joints resize from stored options after plate changes and invalidate numbering', () => {
  const placed = automaticPlacement(draft, [0, 0, -100], [0, 0, -99], [plate]);
  const before = [plate, placed];
  const numbered = numberParts(before);
  const changed = updateAutomaticJoints(before, [{ ...plate, thickness: 30 }, placed]);
  assert.equal(changed[1].spec.length, 50);
  assert.equal(changed[1].accessories.at(-1).offset, 35);
  assert.equal(partStatus(changed[1], changed, numbered).valid, false);
  assert.equal(placed.spec.length, 40);
});

test('saved assembly retains length options and resizes after project reload', () => {
  const placed = automaticPlacement(draft, [0, 0, -100], [0, 0, -99], [plate]);
  const project = JSON.parse(
    readFileSync(new URL('../examples/forbandstest.lira.json', import.meta.url)),
  ).project;
  Object.assign(project, {
    objects: [plate, placed],
    parts: { registry: [], assignments: {} },
    drawings: [],
    assemblies: [],
  });
  const loaded = parseProjectFile(serializeProject(project));
  assert.deepEqual(loaded.objects[1].assembly, placed.assembly);
  assert.deepEqual(loaded.objects[1].lengthOptions, placed.lengthOptions);
  const resized = updateAutomaticJoints(loaded.objects, [
    { ...loaded.objects[0], thickness: 30 },
    loaded.objects[1],
  ]);
  assert.equal(resized[1].spec.length, 50);
});
test('series ignores dimension property order and preserves selected specification snapshot', () => {
  const selected = spec(40);
  const reordered = {
    ...spec(50),
    head: { height: 7.5, diameter: 18, kind: 'hex' },
    nut: { thickness: 10, acrossFlats: 18 },
  };
  const s = {
    ...draft,
    spec: selected,
    lengthOptions: [{ ...selected, length: 100 }, reordered],
  };
  assert.equal(selectFastenerLength(s, 20).spec.length, 40);
  assert.equal(selectFastenerLength(s, 30).spec.length, 50);
});
