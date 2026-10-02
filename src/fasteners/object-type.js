import * as THREE from 'three';
import { validateFastenerSpec } from './library.js';
import { fastenerGeometry, fastenerFrame } from './geometry.js';
export const isFastener = (s) => s?.type === 'fastener';
export function validateFastener(s) {
  try {
    validateFastenerSpec(s.spec);
    if (
      [s.start, s.end].some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 3 ||
          p.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7),
      )
    )
      throw new Error('Ange XYZ inom ±10 000 000 mm.');
    const length = Math.hypot(...s.end.map((v, i) => v - s.start[i]));
    if (Math.abs(length - s.spec.length) > 0.001)
      throw new Error('Skruvens axellängd måste motsvara bibliotekets längd.');
    if (
      s.radial &&
      (!Array.isArray(s.radial) ||
        s.radial.length !== 3 ||
        s.radial.some((v) => !Number.isFinite(v)) ||
        new THREE.Vector3(...s.radial)
          .cross(new THREE.Vector3(...s.end).sub(new THREE.Vector3(...s.start)))
          .length() < 1e-6)
    )
      throw new Error('Ogiltig skruvorientering.');
    if (
      s.spec.kind === 'bolt' &&
      (!Number.isFinite(s.nutOffset) ||
        s.nutOffset < 0 ||
        s.nutOffset + s.spec.nut.thickness > length + 0.001)
    )
      throw new Error('Muttern måste ligga inom skruvens längd.');
    if (!Array.isArray(s.holes) || s.holes.length > 100) throw new Error('Ogiltig hållista.');
    const targets = new Set();
    for (const h of s.holes) {
      if (
        typeof h.targetId !== 'string' ||
        !h.targetId ||
        h.targetId === s.id ||
        targets.has(h.targetId)
      )
        throw new Error('Varje hål måste ha en unik måldel.');
      targets.add(h.targetId);
      if (!['none', 'pilot', 'clearance'].includes(h.kind))
        throw new Error('Välj en giltig håltyp.');
      if (h.kind === 'none') continue;
      if (
        !Number.isFinite(h.offset) ||
        Math.abs(h.offset) > 1e7 ||
        !Number.isFinite(h.depth) ||
        h.depth <= 0 ||
        h.depth > 1e7 ||
        !Number.isFinite(h.diameter) ||
        h.diameter <= 0 ||
        h.diameter > 1000
      )
        throw new Error('Ange giltigt hålläge, diameter och djup.');
      if (
        h.countersink &&
        (!Number.isFinite(h.countersink.diameter) ||
          h.countersink.diameter <= h.diameter ||
          h.countersink.diameter > 2000 ||
          !Number.isFinite(h.countersink.depth) ||
          h.countersink.depth <= 0 ||
          h.countersink.depth >= h.depth)
      )
        throw new Error('Försänkningen måste vara bredare än hålet och grundare än håldjupet.');
    }
    if (s.anchorId && !s.holes.some((h) => h.targetId === s.anchorId))
      throw new Error('Skruvens referensdel måste finnas i hållistan.');
    return '';
  } catch (e) {
    return e.message;
  }
}
export const fastenerType = {
  id: 'fastener',
  label: 'Skruv',
  prefix: 'SK',
  family: 'fastener',
  inspector: 'fastener',
  cut: false,
  geometry: fastenerGeometry,
  validate: validateFastener,
  anchors: (s) => [s.start, s.end],
  corners: (s) => [s.start, s.end],
  snapSegments: (s) => ({ segments: [[s.start, s.end]], includeEdges: false }),
  partFrame: fastenerFrame,
  partShape: (s) => ({ type: 'fastener', spec: s.spec, nutOffset: s.nutOffset }),
  translate: (s, d) => ({
    ...s,
    start: s.start.map((v, i) => v + d[i]),
    end: s.end.map((v, i) => v + d[i]),
  }),
  moveAnchor: (s, key, target) => {
    const delta = target.map((v, i) => v - s[key][i]);
    return {
      ...s,
      start: s.start.map((v, i) => v + delta[i]),
      end: s.end.map((v, i) => v + delta[i]),
    };
  },
  rotate: (s, { turn, quaternion }) => ({
    ...s,
    start: turn(s.start),
    end: turn(s.end),
    radial: fastenerFrame(s).x.applyQuaternion(quaternion).toArray(),
  }),
};
