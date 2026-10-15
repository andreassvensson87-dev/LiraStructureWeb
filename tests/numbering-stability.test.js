import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
import {
  planNumbering,
  applyNumbering,
  defaultNumberingSettings,
  projectNumberingSettings,
} from '../src/numbering/plan.js';
import { partStatus } from '../src/part-marks.js';
import { assemblyNumberStatus, resolveAssemblyDrawing } from '../src/assembly-numbering.js';
import { createAssembly } from '../src/project/assemblies.js';
import { drawingCreationGroups, createSelectedDrawings } from '../src/drawing-creation.js';
import { normalizePreset } from '../src/drawing-presets.js';

const beam = (id, width = 100) => ({
  id: `b${id}`,
  type: 'sweep',
  name: 'Balk',
  prefix: 'B',
  number: id,
  profile: 'rect',
  width,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [0, id * 1000, 0],
  end: [3000, id * 1000, 0],
  partSeries: { prefix: 'P', start: 100 },
  assemblySeries: { prefix: 'A', start: 200 },
});
function project(objects) {
  const p = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  p.objects = objects;
  return p;
}
let serial = 0;
function apply(p, options = {}) {
  const plan = planNumbering(p, { ...defaultNumberingSettings(), ...options }),
    choices = { part: {}, assembly: {} };
  for (const c of plan.conflicts)
    choices[c.kind][c.key] = [...c.candidates].sort((a, b) => a.id.localeCompare(b.id))[0].id;
  return { ...p, ...applyNumbering(plan, p, choices, () => `copy-${++serial}`) };
}
function draw(p) {
  const selected = new Set(p.objects.map((o) => o.id));
  p.drawings = createSelectedDrawings(
    p,
    selected,
    new Set(drawingCreationGroups(p, selected).map((g) => g.key)),
    normalizePreset({}),
    null,
    () => `drawing-${++serial}`,
  );
  for (const d of p.drawings) {
    d.annotations = [{ sourceId: d.sourceId, comment: `Keep ${d.id}`, points: [[1, 2]] }];
    d.revision = 'C';
  }
}
function invariant(p) {
  for (const registry of [p.parts.registry, p.assemblyNumbering.registry]) {
    assert.equal(
      new Set(registry.map((r) => r.key)).size,
      registry.length,
      'one registry record per type',
    );
    assert.equal(
      new Set(registry.map((r) => r.mark.toLowerCase())).size,
      registry.length,
      'one type per mark',
    );
  }
  for (const o of p.objects) {
    assert.ok(partStatus(o, p.objects, p.parts).valid, `valid part ${o.id}`);
    const a = p.parts.assignments[o.id];
    assert.ok(p.parts.registry.some((r) => r.key === a.key && r.mark === a.mark));
  }
  for (const a of p.assemblies) {
    assert.ok(assemblyNumberStatus(a, p).valid, `valid assembly ${a.id}`);
    assert.ok(p.assemblyNumbering.registry.some((r) => r.key === a.typeKey && r.mark === a.mark));
  }
  const live = new Set();
  for (const d of p.drawings) {
    const key = `${d.type}:${d.partKey ?? d.assemblyKey}`;
    assert.ok(!live.has(key), 'one drawing per type');
    live.add(key);
    if (d.type === 'SP') {
      const owners = Object.values(p.parts.assignments).filter((a) => a.key === d.partKey);
      if (owners.length) assert.ok(owners.every((a) => a.mark === d.number && a.mark === d.name));
    } else if (d.type === 'AS') {
      const owners = p.assemblies.filter((a) => a.typeKey === d.assemblyKey);
      if (owners.length) {
        assert.ok(resolveAssemblyDrawing(d, p));
        assert.ok(owners.every((a) => a.mark === d.number && a.mark === d.name));
      }
    }
    assert.equal(d.revision, 'C');
    assert.ok(d.annotations.every((a) => a.comment.startsWith('Keep ')));
  }
}
const identity = (p) => ({
  parts: Object.fromEntries(
    Object.entries(p.parts.assignments)
      .sort()
      .map(([id, a]) => [id, [a.key, a.mark]]),
  ),
  assemblies: Object.fromEntries(
    [...p.assemblies]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((a) => [a.id, [a.typeKey, a.mark]]),
  ),
});
test('tolerance-chain grouping remains valid after reorder, repeated numbering and file roundtrip', () => {
  let p = apply(project([beam(1, 100), beam(2, 101.6), beam(3, 103.2)]), { tolerance: 1 });
  draw(p);
  const before = identity(p);
  for (const order of [
    [1, 2, 0],
    [2, 0, 1],
    [0, 2, 1],
  ]) {
    p.objects = order.map((i) => p.objects[i]);
    p = apply(p, { tolerance: 1 });
    invariant(p);
    assert.deepEqual(identity(p), before);
    p = parseProjectFile(serializeProject(p));
  }
});
test('assembly tolerance uses the stored representative for every member, not a chain through another instance', () => {
  let p = project([beam(1), beam(2, 120), beam(3), beam(4, 120), beam(5), beam(6, 120)]);
  for (const [i, offset] of [
    [1, 0],
    [3, 0.8],
    [5, 1.6],
  ]) {
    p.objects[i].start[1] += offset;
    p.objects[i].end[1] += offset;
  }
  p.assemblies = [
    [1, 2],
    [3, 4],
    [5, 6],
  ].map(([a, b]) => createAssembly(p, [`b${a}`, `b${b}`], `b${a}`, 'Par', () => `a${a}`));
  p = apply(p, { assemblyTolerance: 1 });
  draw(p);
  const before = identity(p);
  p.assemblies = [p.assemblies[1], p.assemblies[2], p.assemblies[0]];
  p = apply(p, { assemblyTolerance: 1 });
  invariant(p);
  assert.deepEqual(identity(p), before);
});
test('seeded revision sequences keep valid ownership, stable repeats, order independence and drawing content', () => {
  for (const seed of [1, 7, 19, 83, 137, 251]) {
    let random = seed;
    const rand = (n) => {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      return random % n;
    };
    let p = apply(project(Array.from({ length: 8 }, (_, i) => beam(i + 1, 100 + (i % 3) * 20))));
    draw(p);
    for (let step = 0; step < 60; step++) {
      const o = p.objects[rand(p.objects.length)];
      switch (rand(5)) {
        case 0:
          o.width = 100 + rand(4) * 20;
          break;
        case 1:
          o.end[0] = 2500 + rand(3) * 500;
          break;
        case 2:
          o.partSeries = { prefix: 'P', start: rand(2) ? 100 : 300 };
          break;
        case 3:
          o.material = rand(2) ? { id: 'steel', revision: 1, name: 'S355', density: 7850 } : null;
          break;
        case 4:
          o.start[1] += 20;
          o.end[1] += 20;
          break;
      }
      const options = {
        tolerance: rand(2) ? 0 : 0.5,
        reuseOldNumbers: !!rand(2),
        modifiedParts: rand(5) ? 'compare' : 'new',
      };
      p = apply(p, options);
      invariant(p);
      const before = identity(p),
        again = apply(structuredClone(p), options);
      invariant(again);
      assert.deepEqual(identity(again), before, `repeat seed ${seed} step ${step}`);
      const reversed = structuredClone(p);
      reversed.objects.reverse();
      reversed.assemblies.reverse();
      const reordered = apply(reversed, options);
      invariant(reordered);
      assert.deepEqual(identity(reordered), before, `reorder seed ${seed} step ${step}`);
      if (step % 10 === 0) {
        p = parseProjectFile(serializeProject(p));
        invariant(p);
      }
    }
  }
});

test('shared part/assembly prefixes and GA drawing numbers cannot create duplicate drawing filenames', () => {
  let p = project([beam(1), beam(2, 120)]);
  p.objects.forEach((o) => (o.assemblySeries = { prefix: 'P', start: 100 }));
  p.drawings = [{ id: 'ga', type: 'GA', number: 'P100', name: 'Plan', levelId: 'l' }];
  p = apply(p);
  draw(p);
  assert.equal(new Set(p.drawings.map((d) => d.number.toLowerCase())).size, p.drawings.length);
  assert.equal(p.drawings.find((d) => d.type === 'GA').number, 'P100');
  const before = identity(p);
  p = apply(p);
  assert.deepEqual(identity(p), before);
  p = apply(p, { renumberAll: true });
  assert.equal(new Set(p.drawings.map((d) => d.number.toLowerCase())).size, p.drawings.length);
  p = parseProjectFile(serializeProject(p));
});
test('an orphaned part drawing reserves its number while unrelated new geometry is numbered with reuse enabled', () => {
  let p = apply(project([beam(1), beam(2, 120)]));
  draw(p);
  const orphan = p.drawings.find((d) => d.type === 'SP' && d.sourceId === 'b1');
  p.objects = [p.objects[1], beam(3, 140)];
  const removed = new Set(p.assemblies.filter((a) => a.mainId === 'b1').map((a) => a.id));
  p.assemblies = p.assemblies.filter((a) => !removed.has(a.id));
  p.drawings = p.drawings.filter((d) => !(d.type === 'AS' && removed.has(d.assemblyId)));
  p = apply(p, { reuseOldNumbers: true });
  draw(p);
  assert.equal(p.drawings.find((d) => d.id === orphan.id).number, orphan.number);
  assert.notEqual(p.parts.assignments.b3.mark, orphan.number);
  assert.equal(new Set(p.drawings.map((d) => d.number)).size, p.drawings.length);
  p = parseProjectFile(serializeProject(p));
});
test('inconsistent part registry ownership is rejected before numbering or file restoration', () => {
  const p = apply(project([beam(1), beam(2, 120)]));
  for (const corrupt of [
    (q) => (q.parts.registry[1].mark = q.parts.registry[0].mark),
    (q) => (q.parts.registry[1].key = q.parts.registry[0].key),
    (q) => (q.parts.assignments.b1.mark = 'P999'),
  ]) {
    const q = structuredClone(p);
    corrupt(q);
    const before = structuredClone(q);
    assert.throws(() => planNumbering(q), /ägarskap|registret/);
    assert.deepEqual(q, before);
    assert.throws(() => parseProjectFile(serializeProject(q)), /ägarskap|registret/);
  }
});

test('mark-only changes collapsing a historical assembly key preserve the live assembly and a single coherent registry owner', async () => {
  const { planMarkChange, applyMarkChange } = await import('../src/numbering/mark-change.js');
  let p = apply(project([beam(1)]));
  draw(p);
  const record = p.assemblyNumbering.registry[0],
    tokens = JSON.parse(record.key).map((text) =>
      JSON.stringify({ ...JSON.parse(text), mark: 'P150' }),
    );
  p.assemblyNumbering.registry.push({
    ...record,
    key: JSON.stringify(tokens),
    mark: 'A250',
    manual: true,
  });
  Object.assign(p, applyMarkChange(planMarkChange(p, { kind: 'part', id: 'b1' }, 'P150'), p));
  assert.equal(p.assemblies[0].mark, record.mark);
  assert.equal(p.assemblyNumbering.registry.length, 1);
  invariant(p);
  p = parseProjectFile(serializeProject(p));
  invariant(p);
});

test('opening a project restores its comparison rules instead of a different workstation preference or previous full-renumber action', () => {
  const p = apply(project([beam(1)]), {
    tolerance: 1,
    assemblyTolerance: 2,
    compareHoles: false,
    renumberAll: true,
  });
  const preference = {
    ...defaultNumberingSettings(),
    tolerance: 0,
    assemblyTolerance: 0,
    renumberAll: true,
    modifiedParts: 'new',
  };
  const next = projectNumberingSettings(p, preference);
  assert.equal(next.tolerance, 1);
  assert.equal(next.assemblyTolerance, 2);
  assert.equal(next.compareHoles, false);
  assert.equal(next.modifiedParts, 'compare');
  assert.equal(next.renumberAll, false);
  assert.equal(preference.renumberAll, true);
  const plain = projectNumberingSettings(project([]), preference);
  assert.equal(plain.tolerance, 0);
  assert.equal(plain.renumberAll, false);
});

test('invalid saved comparison rules are rejected before they can replace project numbering settings', () => {
  const p = apply(project([beam(1)]));
  for (const changes of [
    { tolerance: -1 },
    { assemblyTolerance: '1' },
    { modifiedParts: 'unknown' },
    { compareHoles: 'false' },
  ]) {
    const q = structuredClone(p);
    Object.assign(q.parts.options, changes);
    assert.throws(() => parseProjectFile(serializeProject(q)), /numrering|tolerans/i);
  }
});
