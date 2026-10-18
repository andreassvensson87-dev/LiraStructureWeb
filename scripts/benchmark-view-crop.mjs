import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PartSections } from '../src/part-sections.js';
import { createHash } from 'node:crypto';
const pieces = [];
for (let i = 0; i < 32; i++) {
  const g = new THREE.CylinderGeometry(30, 30, 300, 32);
  g.rotateX(Math.PI / 2);
  g.translate((i % 8) * 90, Math.floor(i / 8) * 90, 0);
  pieces.push(g);
}
const geometry = mergeGeometries(pieces);
pieces.forEach((g) => g.dispose());
const views = [
  {
    id: 'top',
    standard: true,
    projection: 'top',
    source: {},
    settings: {},
    position: [10, 10],
    size: [100, 80],
    camera: { center: [0, 0] },
    scale: 10,
  },
  {
    id: 'front',
    standard: true,
    projection: 'front',
    source: {},
    settings: {},
    position: [120, 10],
    size: [100, 80],
    camera: { center: [0, 0] },
    scale: 10,
  },
];
const e = {
  geometry,
  snapGeometry: geometry,
  config: { views },
  annotationCandidates: {},
  holeSchedule: [],
  record: { sourceId: 'part' },
  getObjects: () => [],
};
const sections = Object.assign(Object.create(PartSections.prototype), { e, cache: new Map() });
sections.build();
const hash = () =>
  createHash('sha256')
    .update(JSON.stringify([...sections.cache.values()].map((d) => [d.vectors, d.modelFaces])))
    .digest('hex');
const baseline = hash();
function sample(force) {
  const times = [];
  for (let i = 0; i < 12; i++) {
    views[0].size[0]++;
    views[0].camera.center[0] += 5;
    if (force) sections.cache.clear();
    const t = performance.now();
    sections.build();
    times.push(performance.now() - t);
  }
  return times.sort((a, b) => a - b);
}
const forced = sample(true),
  cached = sample(false);
console.log(
  JSON.stringify(
    {
      triangles: geometry.index.count / 3,
      views: views.length,
      iterations: 12,
      forceRebuildMedianMs: forced[6],
      reuseMedianMs: cached[6],
      forceRebuildMaxMs: forced.at(-1),
      reuseMaxMs: cached.at(-1),
      projectionUnchanged: hash() === baseline,
    },
    null,
    2,
  ),
);
geometry.dispose();
