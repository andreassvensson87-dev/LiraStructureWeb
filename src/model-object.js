import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { objectType, objectTypes } from './model/object-types/index.js';
import { holesForPart, holesByTarget } from './fasteners/relations.js';
import { holeGeometry, fastenerDisplayTemplate, fastenerGeometry } from './fasteners/geometry.js';
import { geometryEdges } from './fasteners/edges.js';
export const isHelper = (s) => !!s && objectTypes.find(s)?.family === 'helper';
export const isPhysical = (s) =>
  !!s && !!objectTypes.find(s) && !isCut(s) && objectTypes.find(s).physical !== false;
export const isCut = (s) => !!s && !!objectTypes.find(s)?.cut;
export const isPlate = (s) => !!s && objectTypes.find(s)?.family === 'plate';
const baseGeometry = (s) => objectType(s).geometry(s);
export const cutsForModel = (s, model) => [
  ...model.filter((c) => isCut(c) && c.targets?.includes(s.id)),
  ...holesForPart(s, model),
];
export const objectAnchors = (s) => objectType(s).anchors(s);
export function validateObject(s) {
  if (!s || !objectTypes.find(s)) return `Okänd objekttyp: ${s?.type}`;
  if (isCut(s) && (!s.targets?.length || s.targets.includes(s.id)))
    return 'Välj minst ett målobjekt.';
  return objectType(s).validate(s);
}
const cache = new WeakMap(),
  displayCache = new WeakMap(),
  evaluator = new Evaluator();
evaluator.useGroups = false;
evaluator.attributes = ['position', 'normal'];
function compact(geometry) {
  const index = geometry.index,
    pos = geometry.attributes.position,
    normal = geometry.attributes.normal,
    start = geometry.drawRange.start,
    count = Math.min(geometry.drawRange.count, (index?.count ?? pos.count) - start),
    points = [],
    normals = [];
  for (let i = start; i < start + count; i++) {
    const j = index ? index.getX(i) : i;
    points.push(pos.getX(j), pos.getY(j), pos.getZ(j));
    normals.push(normal.getX(j), normal.getY(j), normal.getZ(j));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}
// Display, picking and broad-phase snap use the local shared screw template.
// Keep world-space vertex copies lazy for consumers that actually request them.
// This separate scope retains only the screw, not a whole evaluation/model context.
function lazyFastenerEntry(source, instance) {
  let geometry = null;
  return {
    cuts: [],
    instance,
    identity: instance.geometry,
    bounds: instance.geometry.boundingBox.clone().applyMatrix4(instance.matrix),
    get geometry() {
      if (!geometry) {
        geometry = fastenerGeometry(source);
        geometry.computeBoundingBox();
        geometry.userData.linkedHoles = false;
      }
      return geometry;
    },
    dispose() {
      geometry?.dispose();
    },
  };
}
function disposeEntry(entry) {
  if (!entry) return;
  if (entry.dispose) entry.dispose();
  else entry.geometry.dispose();
  entry.edges?.dispose();
}
function evaluated(s, model = [], knownCuts = null, simplified = false) {
  const store = simplified ? displayCache : cache;
  const cuts = isCut(s)
    ? []
    : (
        knownCuts ??
        (simplified
          ? model.filter((c) => isCut(c) && c.targets?.includes(s.id))
          : cutsForModel(s, model))
      ).filter((c) => !simplified || c.type !== 'linkedhole');
  let entry = store.get(s);
  if (entry && entry.cuts.length === cuts.length && entry.cuts.every((c, i) => c === cuts[i]))
    return entry;
  disposeEntry(entry);
  if (simplified && s.type === 'fastener' && !cuts.length) {
    entry = lazyFastenerEntry(s, fastenerDisplayTemplate(s));
    store.set(s, entry);
    return entry;
  }
  let geometry = baseGeometry(s);
  try {
    for (const cut of cuts) {
      if (!geometry.attributes.position.count) break;
      const tool =
        cut.type === 'linkedhole' ? holeGeometry(cut) : objectType(cut).cutGeometry(cut, geometry);
      if (!tool) continue;
      const offset = cut.type === 'linkedhole' ? cut.frame.origin : [0, 0, 0];
      geometry.translate(-offset[0], -offset[1], -offset[2]);
      tool.translate(-offset[0], -offset[1], -offset[2]);
      geometry.clearGroups();
      tool.clearGroups();
      const a = new Brush(geometry),
        b = new Brush(tool);
      a.updateMatrixWorld();
      b.updateMatrixWorld();
      let result;
      try {
        result = evaluator.evaluate(a, b, SUBTRACTION);
        const next = compact(result.geometry);
        next.translate(...offset);
        geometry.dispose();
        geometry = next;
      } finally {
        tool.dispose();
        a.material.dispose();
        b.material.dispose();
        result?.geometry.dispose();
      }
    }
    geometry.userData.linkedHoles = cuts.some((c) => c.type === 'linkedhole');
    geometry.computeBoundingBox();
    entry = { cuts, geometry };
    store.set(s, entry);
    return entry;
  } catch (error) {
    geometry.dispose();
    throw new Error('Skärningen kunde inte beräknas. Ändra polygon eller skärdjup.');
  }
}
export const objectGeometry = (s, model = []) => evaluated(s, model).geometry.clone();
export const geometryForModel = (s, model) => evaluated(s, model).geometry.clone();
/** Model display and picking retain ordinary cuts but do not subtract bores. */
export const displayGeometry = (s, model = []) => evaluated(s, model, null, true).geometry.clone();
/** Borrow cached geometry for read-only selection, avoiding large typed-array copies. */
export function selectionGeometry(s, model) {
  return evaluated(s, model, null, true).geometry;
}
function indexedEntries(model, simplified = false) {
  const holes = simplified ? new Map() : holesByTarget(model),
    cuts = new Map();
  for (const cut of model.filter(isCut))
    for (const target of cut.targets || []) {
      if (!cuts.has(target)) cuts.set(target, []);
      cuts.get(target).push(cut);
    }
  return (s) =>
    evaluated(s, model, [...(cuts.get(s.id) || []), ...(holes.get(s.id) || [])], simplified);
}
/** One immutable index per render transaction, including all linked bore identities. */
export function createDisplayGeometryContext(model) {
  const entry = indexedEntries(model, true);
  const holes = holesByTarget(model);
  return {
    fastenerTemplate: (s) => entry(s).instance || null,
    geometry: (s) => entry(s).geometry.clone(),
    holes: (s) => holes.get(s.id) || [],
    edges(s, threshold = 1) {
      return entryEdges(entry(s), threshold);
    },
  };
}
export function selectionGeometryReader(model) {
  const entry = indexedEntries(model, true);
  const reader = (s) => entry(s).geometry;
  reader.bounds = (s) => {
    const value = entry(s);
    return value.bounds || value.geometry.boundingBox;
  };
  return reader;
}
export function displayGeometryIdentityReader(model) {
  const entry = indexedEntries(model, true);
  return (s) => {
    const value = entry(s);
    return value.identity || value.geometry;
  };
}
export const cachedGeometryIdentity = (s) => cache.get(s)?.geometry;
export const cachedDisplayHasCuts = (s) => !!displayCache.get(s)?.cuts.length;
export const cachedDisplayGeometryIdentity = (s) => {
  const entry = displayCache.get(s);
  return entry?.identity || entry?.geometry;
};
export const displayFastenerTemplate = (s, model) =>
  evaluated(s, model, null, true).instance || null;
const snapTemplates = new WeakMap();
export function createSnapGeometryContext(model) {
  const entry = indexedEntries(model, true);
  const holes = holesByTarget(model);
  const features = (s) => {
    const evaluated = entry(s),
      instance = evaluated.instance;
    if (!instance?.local || !evaluated.cuts.length) return { entry: evaluated, matrix: null };
    let template = snapTemplates.get(instance.geometry);
    if (!template) {
      template = { geometry: instance.geometry, edges: instance.edges, cuts: [{}] };
      snapTemplates.set(instance.geometry, template);
    }
    return { entry: template, matrix: instance.matrix };
  };
  return {
    bounds: (s) => {
      const value = entry(s);
      return value.bounds || value.geometry.boundingBox;
    },
    cornerFeatures(s) {
      const f = features(s);
      return { points: objectCorners(s, model, f.entry), matrix: f.matrix };
    },
    segmentFeatures(s) {
      const f = features(s);
      return { segments: objectSegments(s, model, f.entry), matrix: f.matrix };
    },
    geometry: (s) => entry(s).geometry,
    objectCorners: (s) => objectCorners(s, model, entry(s)),
    objectSegments: (s) => objectSegments(s, model, entry(s)),
    holeCenters: (s) =>
      (holes.get(s.id) || []).map((h) => ({
        coords: h.frame.origin,
        featureId: h.id,
        label: 'Hålcentrum',
        symbol: 'cross',
      })),
  };
}
/** Seed repeated, already evaluated assemblies; changed cut identities invalidate this cache. */
export function cacheObjectGeometry(
  s,
  model,
  geometry,
  edges,
  knownCuts = null,
  instance = null,
  simplified = false,
) {
  const store = simplified ? displayCache : cache;
  const previous = store.get(s);
  disposeEntry(previous);
  store.set(s, {
    cuts: (knownCuts ?? cutsForModel(s, model)).filter(
      (c) => !simplified || c.type !== 'linkedhole',
    ),
    geometry,
    edges,
    instance,
  });
}
/** Called after geometryForModel has validated the cached cut identities. */
export function objectInstanceDescriptor(s, simplified = false) {
  const entry = (simplified ? displayCache : cache).get(s);
  if (!entry) return null;
  if (s.type === 'fastener') return entry.cuts.length ? null : fastenerDisplayTemplate(s);
  if (!['sweep', 'plate'].includes(s.type || 'sweep')) return null;
  if (entry.instance) return entry.instance;
  if (entry.cuts.length) return null;
  const f = objectType(s).partFrame(s);
  const matrix = new THREE.Matrix4().makeBasis(f.x, f.y, f.z).setPosition(f.origin);
  // Keep exact modelling dimensions; display and world placement do not change the shape.
  const shape = { ...s };
  for (const key of [
    'id',
    'name',
    'prefix',
    'number',
    'material',
    'colorOverride',
    'start',
    'end',
    'rotation',
    'profileUp',
    'frame',
  ])
    delete shape[key];
  if (s.start && s.end) shape.length = Math.hypot(...s.end.map((v, i) => v - s.start[i]));
  return { key: JSON.stringify(shape), matrix, geometry: entry.geometry, local: false };
}
export function edgesForModel(s, model, threshold = 1, simplified = false) {
  const entry = evaluated(s, model, null, simplified);
  return entryEdges(entry, threshold);
}
function entryEdges(entry, threshold) {
  if (threshold !== 1) return geometryEdges(entry.geometry, threshold);
  entry.edges ??= geometryEdges(entry.geometry, threshold);
  return entry.edges.clone();
}
export function objectCorners(s, model = [], preparedEntry = null) {
  const entry = preparedEntry ?? evaluated(s, model);
  if (entry.corners) return entry.corners;
  if (!entry.cuts.length) return (entry.corners = objectType(s).corners(s));
  const edges = (entry.edges ??= geometryEdges(entry.geometry)),
    p = edges.attributes.position,
    nodes = new Map();
  function add(i, j) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i),
      b = new THREE.Vector3().fromBufferAttribute(p, j),
      key = a
        .toArray()
        .map((v) => Math.round(v * 1000))
        .join(',');
    if (!nodes.has(key)) nodes.set(key, { point: a.toArray(), directions: [] });
    nodes.get(key).directions.push(b.sub(a).normalize());
  }
  for (let i = 0; i < p.count; i += 2) {
    add(i, i + 1);
    add(i + 1, i);
  }
  entry.corners = [...nodes.values()]
    .filter((n) =>
      n.directions.some((a) => n.directions.some((b) => a.clone().cross(b).length() > 0.001)),
    )
    .map((n) => n.point);
  return entry.corners;
}

// Segment targets are cached with the evaluated geometry, including cut revisions.
export function objectSegments(s, model = [], preparedEntry = null) {
  const entry = preparedEntry ?? evaluated(s, model);
  if (entry.segments) return entry.segments;
  const segments = [];
  if (!entry.cuts.length) {
    const targets = objectType(s).snapSegments(s);
    segments.push(...targets.segments);
    if (!targets.includeEdges) return (entry.segments = segments);
  }

  const edges = (entry.edges ??= geometryEdges(entry.geometry)),
    p = edges.attributes.position,
    nodes = new Map(),
    links = new Map();
  const key = (v) => v.map((n) => Math.round(n * 1000)).join(',');
  for (let i = 0; i < p.count; i += 2) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)],
      b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)],
      ka = key(a),
      kb = key(b);
    if (ka === kb) continue;
    nodes.set(ka, a);
    nodes.set(kb, b);
    if (!links.has(ka)) links.set(ka, new Set());
    if (!links.has(kb)) links.set(kb, new Set());
    links.get(ka).add(kb);
    links.get(kb).add(ka);
  }
  // Remove collinear subdivisions so a midpoint belongs to the whole edge.
  for (const [k, neighbors] of links) {
    if (neighbors.size !== 2) continue;
    const [a, b] = [...neighbors],
      v = new THREE.Vector3(...nodes.get(k)),
      u = new THREE.Vector3(...nodes.get(a)).sub(v).normalize(),
      w = new THREE.Vector3(...nodes.get(b)).sub(v).normalize();
    if (u.dot(w) > -0.999999) continue;
    links.get(a).delete(k);
    links.get(b).delete(k);
    links.get(a).add(b);
    links.get(b).add(a);
    links.delete(k);
  }
  for (const [a, neighbors] of links)
    for (const b of neighbors) if (a < b) segments.push([nodes.get(a), nodes.get(b)]);
  return (entry.segments = segments);
}

/** An isolated context for clients that evaluate several objects from the same model. */
export function createGeometryContext(initialModel = []) {
  let model = initialModel;
  return {
    setModel(next) {
      model = next;
    },
    objectGeometry: (s) => objectGeometry(s, model),
    objectCorners: (s) => objectCorners(s, model),
    objectSegments: (s) => objectSegments(s, model),
  };
}
