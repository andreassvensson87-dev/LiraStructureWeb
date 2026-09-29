import * as THREE from 'three';
const anchors = (s) => (s.type === 'helperpoint' ? [s.start] : [s.start, s.end]);
export const helperLineType = {
  id: 'helperline',
  label: 'Hjälplinje',
  prefix: 'HL',
  family: 'helper',
  inspector: 'helper',
  cut: false,
  physical: false,
  geometry: (s) =>
    new THREE.BufferGeometry().setFromPoints(anchors(s).map((p) => new THREE.Vector3(...p))),
  anchors,
  corners: anchors,
  validate(s) {
    const points = anchors(s);
    if (
      points.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 3 ||
          p.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7),
      )
    )
      return 'Ange XYZ inom ±10 000 000 mm.';
    if (s.type === 'helperline' && Math.hypot(...s.end.map((v, i) => v - s.start[i])) < 1)
      return 'Hjälplinjen måste vara minst 1 mm lång.';
    return '';
  },
  snapSegments: (s) => ({
    segments: s.type === 'helperpoint' ? [] : [[s.start, s.end]],
    includeEdges: false,
  }),
  translate: (s, d) => ({
    ...s,
    start: s.start.map((v, i) => v + d[i]),
    ...(s.end ? { end: s.end.map((v, i) => v + d[i]) } : {}),
  }),
  rotate: (s, { turn }) => ({ ...s, start: turn(s.start), ...(s.end ? { end: turn(s.end) } : {}) }),
  moveAnchor: (s, key, p) => ({ ...s, [key]: [...p] }),
};
export const helperPointType = {
  ...helperLineType,
  id: 'helperpoint',
  label: 'Hjälppunkt',
  prefix: 'HP',
};
