import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import {
  profileSnapshot,
  evaluateSection,
  validateProfileSnapshotContours,
} from '../src/section-profile.js';
import {
  profileDisplayObject,
  schematicProfileLoops,
  drawingProfileDetail,
  setModelProfilesExact,
} from '../src/profile-detail.js';
import { createModelEditorState } from '../src/model/editor-state.js';
import {
  displayGeometry,
  geometryForModel,
  objectGeometry,
  createDisplayGeometryContext,
  createSnapGeometryContext,
  selectionGeometryReader,
} from '../src/model-object.js';
import { createObjectMesh } from '../src/model/object-mesh.js';
import { updateDisplayDetail } from '../src/model/display-detail.js';
import { partKey, partMatrix } from '../src/part-marks.js';
import { createSectionView } from '../src/drawing-sections.js';
import { createDetailView } from '../src/drawing-details.js';
import { ensureGAViews, ensurePartViews, duplicateDrawingView } from '../src/drawing-views.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { SinglePartSheet } from '../src/single-part-sheet.js';
import { PartSections } from '../src/part-sections.js';
import { partAxisIntervals } from '../src/fasteners/placement.js';
import { geometryEdges } from '../src/fasteners/edges.js';
import { evaluateProfileContours } from '../src/section-contours.js';

test('one contour generates exact and zero-radius modes without a catalog ID or separate schematic contour', () => {
  const definition = structuredClone(TIBNOR_PROFILES[0]);
  definition.id = 'my-profile';
  const snapshot = profileSnapshot(definition);
  assert.deepEqual(snapshot.contourDefinition.radiusParameters, ['R']);
  assert.equal(snapshot.schematicLoops, undefined);
  assert.equal(schematicProfileLoops(snapshot)[0].length, 12);
  assert.equal(schematicProfileLoops(snapshot), schematicProfileLoops(snapshot));
  assert.deepEqual(
    evaluateProfileContours(snapshot.contourDefinition, snapshot.parameters),
    snapshot.loops,
  );
  const radius = snapshot.parameters.R;
  schematicProfileLoops(snapshot);
  assert.equal(snapshot.parameters.R, radius);
  definition.parameters.find((p) => p.name === 'R').value = 0;
  const zero = profileSnapshot(definition);
  assert.equal(evaluateSection(definition).loops[0].length, 12);
  assert.deepEqual(zero.loops, schematicProfileLoops(zero));
  const invalid = structuredClone(snapshot);
  invalid.parameters.R++;
  assert.throws(() => validateProfileSnapshotContours(invalid), /stämmer inte/);
});

test('shared contour generation supports multiple named radii and preserves holes and non-radius dimensions', () => {
  const contour = {
    schema: 1,
    radiusParameters: ['outerRadius', 'innerRadius'],
    radiusSegmentAngle: 15,
    loops: [
      [
        [0, 0],
        ['B-outerRadius', 0],
        ['B', 'outerRadius'],
        ['B', 'H'],
        [0, 'H'],
      ],
      [
        [2, 2],
        ['B-2-innerRadius', 2],
        ['B-2', '2+innerRadius'],
        ['B-2', 'H-2'],
        [2, 'H-2'],
      ],
    ],
  };
  const parameters = { B: 20, H: 30, outerRadius: 3, innerRadius: 1 };
  const exact = evaluateProfileContours(contour, parameters);
  const schematic = evaluateProfileContours(contour, parameters, 'schematic');
  assert.deepEqual(exact[0][1], [17, 0]);
  assert.deepEqual(exact[1][2], [18, 3]);
  assert.deepEqual(schematic[0], [
    [0, 0],
    [20, 0],
    [20, 30],
    [0, 30],
  ]);
  assert.deepEqual(schematic[1], [
    [2, 2],
    [18, 2],
    [18, 28],
    [2, 28],
  ]);
  assert.equal(parameters.outerRadius, 3);
  assert.throws(
    () => evaluateProfileContours(contour, { ...parameters, innerRadius: -1 }),
    /Profilradier/,
  );
});

const beam = (id = 'beam') => {
  const section = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === 'HEA 200'));
  return {
    id,
    type: 'sweep',
    name: id,
    profile: 'custom',
    section,
    width: 200,
    height: 190,
    thickness: 10,
    rotation: 0,
    start: [0, 0, 0],
    end: [1000, 0, 0],
  };
};
const disposeMesh = (mesh) =>
  mesh.traverse((child) => {
    child.geometry?.dispose();
    child.material?.dispose();
  });

test('schematic model display has sharp roots while exact manufacturing shape and identity stay intact', () => {
  const s = beam(),
    model = [s],
    before = JSON.stringify(s),
    key = partKey(s, model);
  assert.equal(s.section.schematicLoops, undefined);
  assert.equal(schematicProfileLoops(s.section)[0].length, 12);
  assert.equal(s.section.loops[0].length, 36);
  const schematic = displayGeometry(s, model),
    exact = displayGeometry(s, model, 'exact'),
    physical = geometryForModel(s, model);
  assert.ok(schematic.attributes.position.count < exact.attributes.position.count);
  assert.deepEqual(exact.attributes.position.array, physical.attributes.position.array);
  const edges = geometryEdges(exact, 5),
    p = edges.attributes.position;
  let longitudinal = 0;
  for (let i = 0; i < p.count; i += 2)
    if (Math.abs(p.getX(i + 1) - p.getX(i)) > 999) longitudinal++;
  assert.equal(longitudinal, 8, 'fillet facets must not become longitudinal drawing lines');
  edges.dispose();
  schematic.computeBoundingBox();
  exact.computeBoundingBox();
  assert.deepEqual(schematic.boundingBox, exact.boundingBox);
  assert.equal(JSON.stringify(s), before);
  assert.equal(partKey(s, model), key);
  assert.equal(profileDisplayObject(s), profileDisplayObject(s));
  schematic.dispose();
  exact.dispose();
  physical.dispose();
});

test('old Tibnor snapshots obtain sharp geometry; unrelated free contours and round tubes are preserved', () => {
  const s = beam();
  delete s.section.contourDefinition;
  assert.equal(schematicProfileLoops(s.section)[0].length, 12);
  const custom = structuredClone(s);
  custom.section.id = 'free-drawing';
  assert.equal(profileDisplayObject(custom), custom);
  const chs = { ...s, profile: 'chs' };
  assert.equal(profileDisplayObject(chs), chs);
});

test('cuts clip both display modes while drilling uses physical root material independently of display', () => {
  const s = beam();
  const cut = {
    id: 'cut',
    type: 'polygoncut',
    targets: [s.id],
    frame: { origin: [500, -500, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [1000, 0],
      [1000, 1000],
      [0, 1000],
    ],
    thickness: 1000,
    side: 'center',
  };
  for (const mode of ['exact', 'schematic']) {
    const geometry = displayGeometry(s, [s, cut], mode);
    assert.equal(geometry.boundingBox.max.x, 500);
    geometry.dispose();
  }
  const draft = { start: [500, -5, 120], end: [500, -5, -120], radial: [1, 0, 0] };
  const physical = partAxisIntervals(draft, s, [s]);
  const display = partAxisIntervals(draft, s, [s], createDisplayGeometryContext([s]));
  assert.ok(physical[0].depth > 19, 'physical flange includes the root fillet');
  assert.equal(display[0].depth, 10, 'display markers follow the schematic flange');
});

test('mixed selection changes display only, restores cached geometry, and picking follows display while snapping remains schematic', () => {
  const a = beam('a'),
    b = beam('b'),
    model = [a, b],
    ui = createModelEditorState();
  const context = createDisplayGeometryContext(model, ui);
  const originalA = context.identity(a),
    originalB = context.identity(b);
  setModelProfilesExact(ui, model, new Set(['a']), true);
  assert.notEqual(context.identity(a), originalA);
  assert.equal(context.identity(b), originalB);
  const reader = selectionGeometryReader(model, ui);
  assert.equal(reader(a), context.identity(a));
  const snap = createSnapGeometryContext(model, ui);
  assert.equal(snap.objectCorners(a).length, 24);
  assert.deepEqual(snap.objectCorners(a), createSnapGeometryContext(model).objectCorners(a));
  assert.equal(snap.objectCorners(b).length, 24);
  const mesh = createObjectMesh(a, { model, geometryContext: context, selectedIds: new Set() });
  assert.equal(mesh.userData.exactProfile, true);
  assert.equal(mesh.userData.geometryIdentity, context.identity(a));
  const camera = new THREE.OrthographicCamera(-1e6, 1e6, 1e6, -1e6, 1, 1e7);
  updateDisplayDetail([mesh], camera, 500, new Set());
  assert.equal(mesh.userData.detailVisible, true); // Explicit exact display survives overview LOD.
  setModelProfilesExact(ui, model, new Set(['a']), false);
  assert.equal(context.identity(a), originalA);
  ui.exactProfileIds.clear();
  assert.equal(context.identity(b), originalB);
  disposeMesh(mesh);
});

test('new sections/details default to exact even when their parent plan is schematic; explicit view choices win', () => {
  const record = { type: 'GA', settings: {}, sheet: {} };
  const [parent] = ensureGAViews(record, [297, 210], [0, 0], 50);
  assert.equal(drawingProfileDetail(parent, 'GA'), 'schematic');
  const section = createSectionView(
    parent,
    [
      [0, 0],
      [100, 0],
    ],
    1,
    [10, 10],
    [parent],
  );
  const detail = createDetailView(
    parent,
    [
      [0, 0],
      [100, 100],
    ],
    [10, 10],
    [parent],
  );
  assert.equal(drawingProfileDetail(section, 'GA'), 'exact');
  assert.equal(drawingProfileDetail(detail, 'GA'), 'exact');
  section.settings.profileDetail = 'schematic';
  assert.equal(drawingProfileDetail(section, 'GA'), 'schematic');
  assert.equal(
    duplicateDrawingView(section, [section], []).view.settings.profileDetail,
    'schematic',
  );
  const sp = { type: 'SP', sourceId: 'beam', sheet: {} };
  assert.ok(ensurePartViews(sp).every((v) => v.settings.profileDetail === 'exact'));
});

test('profile modes migrate per view and survive project save/reload without saving model display overrides', () => {
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [beam()];
  const drawing = { id: 'ga', number: 'GA-1', type: 'GA', settings: {}, sheet: {} };
  const [plan] = ensureGAViews(drawing, [297, 210], [0, 0], 50);
  const section = createSectionView(
    plan,
    [
      [0, 0],
      [100, 0],
    ],
    1,
    [20, 20],
    [plan],
  );
  drawing.sheet.views.push(section);
  section.settings.profileDetail = 'schematic';
  plan.settings.profileDetail = 'exact';
  project.drawings = [drawing];
  const loaded = parseProjectFile(serializeProject(project));
  assert.deepEqual(
    loaded.drawings[0].sheet.views.map((v) => v.settings.profileDetail),
    ['exact', 'schematic'],
  );
  assert.equal(loaded.exactProfileIds, undefined);
  assert.deepEqual(
    loaded.objects[0].section.contourDefinition,
    project.objects[0].section.contourDefinition,
  );
});

test('Single Part renders adjacent views with independent display contours and identical schematic annotation candidates', () => {
  const s = beam(),
    model = [s],
    matrix = partMatrix(s);
  const editor = Object.assign(Object.create(SinglePartSheet.prototype), {
    record: { type: 'SP', sheet: { sectionOrientation: 'source-up' } },
    geometry: objectGeometry(s, model).applyMatrix4(matrix),
    snapGeometry: displayGeometry(s, model, 'schematic').applyMatrix4(matrix),
    profileGeometryModel: model,
    profileGeometrySource: s,
    profileLocalMatrix: matrix,
    profileVariants: new Map(),
    annotationCandidates: {},
    holeSchedule: [],
  });
  editor.config = {
    views: ['exact', 'schematic'].map((mode) => ({
      id: mode,
      standard: true,
      projection: 'left',
      kind: 'view',
      source: { type: 'part' },
      settings: { profileDetail: mode },
    })),
  };
  const sections = Object.assign(Object.create(PartSections.prototype), {
    e: editor,
    cache: new Map(),
  });
  sections.build();
  assert.ok(
    sections.cache.get('exact').behind.length > sections.cache.get('schematic').behind.length,
  );
  assert.deepEqual(editor.annotationCandidates.exact, editor.annotationCandidates.schematic);
  assert.notEqual(
    editor.drawingGeometry(editor.config.views[0]).geometry,
    editor.drawingGeometry(editor.config.views[1]).geometry,
  );
  editor.disposeProfileVariants();
  editor.geometry.dispose();
  editor.snapGeometry.dispose();
});
