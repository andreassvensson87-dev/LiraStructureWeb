import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  componentDefinition,
  resolveComponentDraft,
  componentDraftChanged,
} from '../src/components/definitions.js';
import { componentMarkerProjection, componentMarkerAppearance } from '../src/components/markers.js';
import { createObjectMesh, updateObjectMeshSelection } from '../src/model/object-mesh.js';
const a = {
  id: 'a',
  type: 'sweep',
  start: [-1000, 0, 0],
  end: [0, 0, 0],
  profile: 'rect',
  width: 100,
  height: 100,
  thickness: 0,
  rotation: 0,
};
const b = { ...a, id: 'b', start: [0, -1000, 0], end: [0, 0, 0] };
const source = componentDefinition('fit').resolve(
  {
    id: 'fit',
    type: 'component',
    kind: 'fit',
    ...componentDefinition('fit').defaults,
    references: ['a', 'b'],
  },
  [a, b],
);
test('component inspector resolves a detached draft and leaves saved parameters and geometry unchanged', () => {
  const saved = structuredClone(source);
  const draft = resolveComponentDraft(source, { mode: 'abut', gap: 10 }, [a, b, source]);
  assert.deepEqual(source, saved);
  assert.equal(draft.mode, 'abut');
  assert.equal(draft.gap, 10);
  assert.ok(componentDraftChanged(source, draft));
  assert.equal(componentDraftChanged(source, structuredClone(source)), false);
  assert.throws(() => resolveComponentDraft(source, { gap: -1 }, [a, b]), /Spalt/);
  assert.throws(() => resolveComponentDraft(source, { width: 100 }, [a, b]), /parameter/);
  assert.deepEqual(source, saved);
});
test('a theoretical Fit reports separation without blocking the editable draft or numbering', async () => {
  const { numberParts, partStatus } = await import('../src/part-marks.js');
  const separated = { ...b, start: [0, -1000, 300], end: [0, 0, 300] };
  const draft = resolveComponentDraft(source, { gap: 10 }, [a, separated]);
  assert.equal(draft.profileOverlap, false);
  assert.deepEqual(componentDefinition('fit').notices(draft), ['Ingen gemensam kontaktyta']);
  assert.deepEqual(componentDefinition('fit').notices(source), []);
  const model = [a, separated, draft];
  const numbering = numberParts(model);
  assert.equal(partStatus(a, model, numbering).valid, true);
  assert.equal(partStatus(separated, model, numbering).valid, true);
  const reconnected = resolveComponentDraft(draft, {}, [a, b]);
  assert.equal(reconnected.profileOverlap, true);
  assert.deepEqual(componentDefinition('fit').notices(reconnected), []);
  assert.equal(source.profileOverlap, true);
});
test('a connection has a non-material scene placeholder instead of a cutting plane display', () => {
  const object = createObjectMesh(source, { model: [a, b, source], selectedIds: new Set() });
  assert.ok(object.isGroup);
  assert.equal(object.userData.component, true);
  assert.equal(object.userData.id, 'fit');
  assert.equal(object.children.length, 0);
  updateObjectMeshSelection(object, source, new Set(['fit']));
  assert.equal(object.userData.selected, true);
});
test('connection marker stays at the junction and hides outside the camera clip volume', () => {
  const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
  camera.position.set(0, 0, 200);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  assert.deepEqual(componentMarkerProjection([0, 0, 0], camera, 800, 600), { x: 400, y: 300 });
  assert.equal(componentMarkerProjection([500, 0, 0], camera, 800, 600), null);
  assert.equal(componentMarkerProjection([0, 0, 500], camera, 800, 600), null);
});
test('connection markers shrink, fade and disappear with orthographic zoom', () => {
  const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 10000);
  camera.position.z = 1000;
  camera.updateMatrixWorld();
  const normal = componentMarkerAppearance([0, 0, 0], camera, 600);
  assert.equal(normal.size, 12);
  assert.equal(normal.opacity, 0.5);
  camera.zoom = 0.5;
  camera.updateProjectionMatrix();
  assert.equal(componentMarkerAppearance([0, 0, 0], camera, 600).visible, false);
  camera.zoom = 10;
  camera.updateProjectionMatrix();
  assert.equal(componentMarkerAppearance([0, 0, 0], camera, 600).size, 28);
});
test('perspective connection markers shrink with distance', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100000);
  camera.updateMatrixWorld();
  const near = componentMarkerAppearance([0, 0, -5000], camera, 600);
  const far = componentMarkerAppearance([0, 0, -10000], camera, 600);
  assert.ok(Math.abs(near.size / far.size - 2) < 1e-10);
  assert.ok(near.opacity > far.opacity);
  assert.equal(componentMarkerAppearance([0, 0, -20000], camera, 600).visible, false);
});

test('all connection placements collect references without writes and require a separately reversible confirmation', async () => {
  const { createComponentPlacement } = await import('../src/components/placement-session.js');
  const { updateAutomaticJoints } = await import('../src/fasteners/update-joints.js');
  const { createProject } = await import('../src/project/project-state.js');
  const { createModelEditor } = await import('../src/app/model-editor.js');
  const { ProjectHistory } = await import('../src/project/project-history.js');
  const column = {
    ...a,
    id: 'column',
    profile: 'i',
    width: 300,
    height: 300,
    thickness: 15,
    rotation: 90,
    start: [0, 0, 0],
    end: [0, 0, 3000],
  };
  const beam = {
    ...column,
    id: 'beam',
    width: 200,
    rotation: 0,
    start: [1000, 0, 1500],
    end: [0, 0, 1500],
  };
  const left = { ...beam, id: 'left', start: [-1000, 3000, 0], end: [0, 3000, 0] },
    right = { ...left, id: 'right', start: [0, 3000, 0], end: [1000, 3000, 0] };
  const specs = [
    {
      id: 'bolt',
      revision: 1,
      name: 'ISO 4017 M16×60',
      kind: 'bolt',
      standard: 'ISO 4017',
      diameter: 16,
      length: 60,
      head: { kind: 'hex', diameter: 24, height: 10 },
      nut: { acrossFlats: 24, thickness: 13 },
      washer: { innerDiameter: 18, outerDiameter: 30, thickness: 3 },
      thread: { length: 60, pitch: 2 },
    },
  ];
  const objects = [a, b, column, beam, left, right];
  const choices = {
    fit: [
      [a, a.end],
      [b, b.end],
    ],
    baseplate: [[column, column.end]],
    endplate: [[left, left.start]],
    stiffener: [
      [left, left.start],
      [left, [-500, 3000, 0]],
    ],
    boltedEndplate: [
      [column, [0, 0, 1500]],
      [beam, beam.end],
    ],
    beamSplice: [
      [left, left.end],
      [right, right.start],
    ],
  };
  for (const [kind, picks] of Object.entries(choices)) {
    const project = createProject({
      grid: { x: [], y: [] },
      levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
    });
    project.objects = structuredClone(objects);
    const before = structuredClone(project.objects),
      history = new ProjectHistory();
    const editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
    const placement = createComponentPlacement(kind, { id: 'new-joint' });
    for (const [i, [object, point]] of picks.entries()) {
      placement.pick(object, point, project.objects, specs);
      assert.equal(placement.state.ready, i === picks.length - 1, kind);
      assert.deepEqual(project.objects, before, kind);
      assert.equal(history.canUndo, false, kind);
    }
    const stable = placement.state;
    assert.equal(
      placement.pick(null, null, project.objects),
      stable,
      'ready sessions cannot pick new references',
    );
    const draft = { ...placement.state };
    delete draft.ready;
    const resolved = resolveComponentDraft(draft, {}, project.objects);
    assert.deepEqual(project.objects, before, 'preview resolution never commits');
    editor.replace(updateAutomaticJoints(project.objects, [...project.objects, resolved]));
    assert.equal(history.past.length, 1, kind);
    assert.equal(project.objects.find((s) => s.id === 'new-joint').kind, kind);
    assert.ok(kind === 'fit' || project.objects.some((s) => s.generatedBy === 'new-joint'));
    assert.deepEqual(history.undo(project).objects, before, kind);
  }
});

test('invalid and duplicate reference picks leave the placement draft intact; parameter dependencies detach screw snapshots', async () => {
  const { createComponentPlacement } = await import('../src/components/placement-session.js');
  const { editComponentParameter } = await import('../src/components/parameter-edit.js');
  const placement = createComponentPlacement('fit', { id: 'draft' });
  placement.pick(a, a.end, [a, b]);
  const before = structuredClone(placement.state);
  assert.throws(() => placement.pick(a, a.end, [a, b]), /annan sweep/);
  assert.throws(() => placement.pick({ type: 'plate' }, [0, 0, 0], [a, b]), /sweep/);
  assert.deepEqual(placement.state, before);
  const stiffener = createComponentPlacement('stiffener', { id: 'stiffener' });
  assert.throws(() => stiffener.pick(a, a.end, [a]), /U-profil/);
  assert.deepEqual(stiffener.state.references, []);
  const screw = {
    id: 's',
    revision: 1,
    kind: 'bolt',
    diameter: 20,
    washer: { thickness: 3 },
    length: 100,
  };
  const draft = { ...before, kind: 'boltedEndplate' };
  const changed = editComponentParameter(draft, 'boltSpec', screw, [screw]);
  assert.equal(changed.holeDiameter, 22);
  assert.equal(changed.nearWasher, true);
  assert.equal(changed.farWasher, true);
  assert.equal(changed.lengthOptions.length, 1);
  changed.boltSpec.diameter = 99;
  changed.lengthOptions[0].diameter = 98;
  assert.equal(screw.diameter, 20);
  assert.equal(draft.boltSpec, undefined);
});
