import { geometryForModel } from '../src/model-object.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { profileSnapshot } from '../src/section-profile.js';
import { defaultFasteners } from '../src/fasteners/default-catalog.js';
import { defaultHoleForSpec } from '../src/fasteners/library.js';
import { withFastenerLength, fastenerFitWarnings } from '../src/fasteners/manual-length.js';
import { automaticPlacement, partAxisIntervals } from '../src/fasteners/placement.js';
import { fastenerFrame } from '../src/fasteners/geometry.js';
import { holesForPart } from '../src/fasteners/relations.js';
import {
  preparePickedFasteners,
  prepareFastenerPlacement,
} from '../src/fasteners/placement-draft.js';
import { updateAutomaticJoints } from '../src/fasteners/update-joints.js';
import { createProject } from '../src/project/project-state.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { rotateObject } from '../src/rotation.js';
import { validateFastener } from '../src/fasteners/object-type.js';

const remainingLayers = (s, beam) =>
  partAxisIntervals(s, beam, [beam, s], {
    geometry: (part) => geometryForModel(part, [beam, s]),
  });
const spec = defaultFasteners().find((s) => s.standard === 'ISO 4017' && s.diameter === 8);
function fixture(name, y) {
  const section = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === name));
  const points = section.loops.flat();
  const beam = {
    id: 'p',
    name,
    type: 'sweep',
    profile: 'custom',
    section,
    rotation: 0,
    width: Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0])),
    height: Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1])),
    thickness: 5,
    start: [0, 0, 0],
    end: [1000, 0, 0],
  };
  const start = [500, y, 400],
    direction = [500, y, 399];
  const draft = {
    id: 's',
    type: 'fastener',
    spec,
    placementMode: 'range',
    lengthMode: 'manual',
    start,
    end: [500, y, 300],
    anchorId: 'p',
    assembly: { bolt: true, nearWasher: true, farWasher: true, nut: true, extraNut: false },
    holes: [{ ...defaultHoleForSpec(spec, 'p'), id: 'hole' }],
  };
  const intervals = partAxisIntervals(draft, beam, [beam]);
  assert.equal(intervals.length, 2, `${name}: two distinct material intervals`);
  const span = intervals[1].offset + intervals[1].depth - intervals[0].offset;
  const before = spec.washer.thickness,
    after = spec.washer.thickness + spec.nut.thickness;
  const place = (length, patch = {}) =>
    automaticPlacement(
      { ...draft, ...patch, spec: withFastenerLength(patch.spec || spec, length) },
      start,
      direction,
      [beam],
    );
  return { beam, draft, intervals, span, before, after, place, start, direction };
}
for (const [name, y] of [
  ['HEA 200', 60],
  ['IPE 200', 30],
  ['U 200', 0],
  ['VKR 100x100x5', 0],
])
  test(`${name}: length selects actual flanges, including air, hardware and exact reach boundary`, () => {
    const f = fixture(name, y);
    const short = f.place(40),
      long = f.place(f.span + f.before + f.after);
    assert.equal(short.layerCount, 1);
    assert.equal(long.layerCount, 2);
    assert.equal(short.holes[0].kind, 'clearance');
    assert.ok(Math.abs(short.holes[0].depth - f.intervals[0].depth) < 0.001);
    assert.ok(Math.abs(long.holes[0].depth - f.span) < 0.001);
    assert.equal(fastenerFitWarnings(long).length, 0);
    // Verify actual machining: the short bore leaves the remote wall intact; the long bore removes both.
    assert.equal(remainingLayers(short, f.beam).length, 1);
    assert.throws(() => remainingLayers(long, f.beam), /träffar inte/);
    const insufficientHardware = f.place(f.span + f.before);
    assert.equal(insufficientHardware.layerCount, 1);
    assert.equal(insufficientHardware.insertion.reachWarning, 'hardware');
    const partial = f.place(f.span + f.before - f.intervals[1].depth / 2);
    assert.equal(partial.layerCount, 1);
    assert.equal(partial.insertion.reachWarning, 'incomplete-layer');
    assert.match(fastenerFitWarnings(partial).join(' '), /inget genomgående hål/);
    const extra = f.place(f.span + f.before + f.after, {
      assembly: { ...f.draft.assembly, extraNut: true },
    });
    assert.equal(extra.layerCount, 1);
    assert.equal(
      f.place(f.span + f.before + f.after + spec.nut.thickness, {
        assembly: { ...f.draft.assembly, extraNut: true },
      }).layerCount,
      2,
    );
    const noNut = f.place(f.span + 2 * spec.washer.thickness, {
      assembly: { ...f.draft.assembly, nut: false },
    });
    assert.equal(noNut.layerCount, 2);
    assert.equal(f.place(1).layerCount, 0);
    assert.equal(holesForPart(f.beam, [f.beam, f.place(1)]).length, 0);
    assert.equal(validateFastener(f.place(1)), '');
  });

test('rod projection reserves the entire near-side allowance once, plus far washer and nuts', () => {
  const f = fixture('VKR 100x100x5', 0);
  const rod = defaultFasteners().find((s) => s.standard === 'DIN 976-1' && s.diameter === 8);
  const patch = { spec: rod, startAllowance: 30, assembly: { ...f.draft.assembly, nearNut: true } };
  const length = f.span + 30 + f.after;
  assert.equal(f.place(length, patch).layerCount, 2);
  assert.equal(f.place(length, { ...patch, startAllowance: 31 }).layerCount, 1);
  assert.equal(
    f.place(length + spec.nut.thickness, {
      ...patch,
      assembly: { ...patch.assembly, extraNut: true },
    }).layerCount,
    2,
  );
  const placed = f.place(length, patch);
  assert.ok(Math.abs(fastenerFrame(placed).origin.z - (50 + 30)) < 0.001);
  assert.equal(fastenerFitWarnings(placed).length, 0);
});

test('manual accessory positions and explicit manual holes cannot machine beyond the selected layers', () => {
  const f = fixture('VKR 100x100x5', 0);
  const patch = {
    assembly: undefined,
    accessories: [
      { kind: 'washer', offset: 0 },
      { kind: 'nut', offset: 30 },
    ],
  };
  assert.equal(f.place(200, patch).layerCount, 1, 'fixed nut position bounds the material span');
  const manual = { ...f.draft.holes[0], extent: 'manual', offset: 0, depth: 1000 };
  const placed = f.place(40, { holes: [manual] });
  assert.equal(placed.layerCount, 1);
  assert.ok(placed.holes[0].depth <= f.intervals[0].depth + 0.001);
  assert.equal(remainingLayers(placed, f.beam).length, 1);
  assert.equal(f.place(1, { holes: [manual] }).holes[0].active, false);
});

test('preview and edit share reach, retain bore identity, refit on edits and round-trip through history', () => {
  const f = fixture('HEA 200', 60);
  const frame = { origin: [500, 60, 95], u: [1, 0, 0], v: [0, 1, 0] };
  const draft = {
    ...f.draft,
    group: {
      id: 'group',
      shape: 'array',
      rows: 1,
      columns: 2,
      distancesX: [60],
      distancesY: [],
      rotation: 0,
    },
  };
  const short = preparePickedFasteners(
    { ...draft, spec: withFastenerLength(spec, 40) },
    { start: frame.origin, xPoint: [600, 60, 95], frame, model: [f.beam] },
  );
  assert.ok(short.every((s) => s.layerCount === 1));
  const input = { ...short[0], spec: withFastenerLength(spec, f.span + f.before + f.after) };
  const edited = prepareFastenerPlacement(input, { model: [f.beam, ...short] }).batch;
  edited.forEach((s, i) => {
    assert.equal(s.layerCount, 2);
    assert.equal(s.id, short[i].id);
    assert.equal(s.holes[0].id, short[i].holes[0].id);
  });
  const refitted = updateAutomaticJoints(
    [f.beam, ...edited],
    [f.beam, ...edited.map((s) => ({ ...s, spec: withFastenerLength(spec, 40) }))],
  );
  assert.ok(refitted.slice(1).every((s) => s.layerCount === 1 && !s.insertion.reachWarning));
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [f.beam, ...short];
  const history = new ProjectHistory(),
    editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
  editor.update(edited);
  assert.ok(project.objects.slice(1).every((s) => s.layerCount === 2));
  const restored = parseProjectFile(serializeProject(project));
  assert.ok(restored.objects.slice(1).every((s) => s.layerCount === 2 && s.holes[0].active));
  assert.ok(
    history
      .undo(project)
      .objects.slice(1)
      .every((s) => s.layerCount === 1),
  );
  const rotatedBeam = rotateObject(f.beam, [0, 0, 0], 'Y', 35),
    rotated = rotateObject(edited[0], [0, 0, 0], 'Y', 35);
  const result = automaticPlacement(rotated, rotated.insertion.start, rotated.insertion.direction, [
    rotatedBeam,
  ]);
  assert.equal(result.layerCount, 2);
  assert.equal(result.spec.length, input.spec.length);
});
