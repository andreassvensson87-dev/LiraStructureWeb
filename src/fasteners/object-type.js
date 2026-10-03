import { transformSpan } from './holes.js';
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
    if (s.washers != null) {
      if (typeof s.washers.head !== 'boolean' || typeof s.washers.nut !== 'boolean')
        throw new Error('Ogiltiga brickval.');
      if (s.washers.head || s.washers.nut) {
        if (!s.spec.washer) throw new Error('Ange brickmått i skruvbiblioteket först.');
        if (s.washers.head && s.spec.head.kind === 'countersunk')
          throw new Error(
            'Plan bricka under huvudet kräver cylindriskt huvud eller sexkantshuvud.',
          );
        if (s.washers.nut && s.spec.kind !== 'bolt')
          throw new Error('Bricka vid muttern kräver skruv med mutter.');
        if (
          (s.washers.head && s.spec.washer.innerDiameter >= s.spec.head.diameter) ||
          (s.washers.nut && s.spec.washer.innerDiameter >= s.spec.nut.acrossFlats)
        )
          throw new Error(
            'Brickans hål måste vara mindre än huvudet eller muttern som håller den.',
          );
        const headDepth = s.washers.head ? s.spec.washer.thickness : 0;
        const nutDepth = s.washers.nut ? s.spec.washer.thickness : 0;
        if (s.spec.kind === 'bolt' && s.nutOffset - nutDepth < headDepth)
          throw new Error('Brickorna och muttern överlappar. Öka mutterläget.');
      }
    }
    if (
      s.insertion &&
      (![s.insertion.start, s.insertion.direction].every(
        (p) =>
          Array.isArray(p) &&
          p.length === 3 &&
          p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e7),
      ) ||
        !Number.isFinite(s.insertion.depth) ||
        s.insertion.depth <= 0 ||
        s.insertion.depth > 1e7)
    )
      throw new Error('Ogiltiga insättningspunkter eller borravstånd.');
    if (s.span) {
      const f = fastenerFrame(s);
      const coordinates = [s.span.start, s.span.end];
      if (
        coordinates.some(
          (p) =>
            !Array.isArray(p) ||
            p.length !== 3 ||
            p.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7),
        )
      )
        throw new Error('Ogiltiga anliggningspunkter.');
      const a = new THREE.Vector3(...s.span.start).sub(f.origin),
        b = new THREE.Vector3(...s.span.end).sub(f.origin);
      if (
        a.clone().cross(f.z).length() > 0.001 ||
        b.clone().cross(f.z).length() > 0.001 ||
        b.dot(f.z) - a.dot(f.z) < 0.001
      )
        throw new Error('Anliggningspunkterna måste ligga längs skruvaxeln i rätt ordning.');
    }
    const holeIds = new Set();
    const targets = new Set();
    for (const h of s.holes) {
      if (h.id != null && (typeof h.id !== 'string' || !h.id || holeIds.has(h.id)))
        throw new Error('Borrhål måste ha unika ID:n.');
      if (h.id) holeIds.add(h.id);
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
      if (h.extent != null && !['span', 'wall', 'profile', 'blind', 'manual'].includes(h.extent))
        throw new Error('Ogiltig hålomfattning.');
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
  partShape: (s) => ({
    type: 'fastener',
    spec: s.spec,
    nutOffset: s.nutOffset,
    washers: { head: !!s.washers?.head, nut: !!s.washers?.nut },
  }),
  translate: (s, d) => ({
    ...s,
    ...transformSpan(s, (p) => p.map((v, i) => v + d[i])),
    start: s.start.map((v, i) => v + d[i]),
    end: s.end.map((v, i) => v + d[i]),
  }),
  moveAnchor: (s, key, target) => {
    const delta = target.map((v, i) => v - s[key][i]);
    return {
      ...s,
      ...transformSpan(s, (p) => p.map((v, i) => v + delta[i])),
      start: s.start.map((v, i) => v + delta[i]),
      end: s.end.map((v, i) => v + delta[i]),
    };
  },
  rotate: (s, { turn, quaternion }) => ({
    ...s,
    ...transformSpan(s, turn),
    start: turn(s.start),
    end: turn(s.end),
    radial: fastenerFrame(s).x.applyQuaternion(quaternion).toArray(),
  }),
};
