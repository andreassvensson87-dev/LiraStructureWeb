import { clean, loopKey } from './shape-key.js';
import * as THREE from 'three';
import { sweepGeometry, validateSweep, sweepCorners, sweepFrame, contours } from '../../sweep.js';
import { roundProfile } from '../../round-profile.js';
export const sweepType = {
  id: 'sweep',
  label: 'Sweep',
  prefix: 'B',
  family: 'sweep',
  inspector: 'sweep',
  cut: false,
  geometry: sweepGeometry,
  validate: validateSweep,
  corners: sweepCorners,
  partFrame(s) {
    const f = sweepFrame(s);
    return { origin: f.start, x: f.axis, y: f.x, z: f.y };
  },
  partShape: (s) => ({
    type: 'sweep',
    loops: contours(s).map(loopKey),
    length: clean(Math.hypot(...s.end.map((v, i) => v - s.start[i]))),
  }),
  anchors: (s) => [s.start, s.end],
  snapSegments: (s) => ({ segments: [[s.start, s.end]], includeEdges: !roundProfile(s) }),
  translate: (source, delta) => ({
    ...source,
    start: source.start.map((v, i) => v + delta[i]),
    end: source.end.map((v, i) => v + delta[i]),
  }),
  moveAnchor: (source, anchor, target) => {
    if (!['start', 'end'].includes(anchor)) throw new Error('Ogiltig insättningspunkt.');
    return { ...source, [anchor]: [...target] };
  },
  rotate(source, { turn, quaternion }) {
    const result = { ...source, start: turn(source.start), end: turn(source.end), rotation: 0 };
    if (source.profileUp)
      result.profileUp = new THREE.Vector3(...source.profileUp)
        .applyQuaternion(quaternion)
        .toArray();
    const before = sweepFrame(source),
      after = sweepFrame(result),
      x = before.x.clone().applyQuaternion(quaternion);
    result.rotation = THREE.MathUtils.radToDeg(
      Math.atan2(after.axis.dot(new THREE.Vector3().crossVectors(after.x, x)), after.x.dot(x)),
    );
    result.rotation = Math.round(result.rotation * 1e9) / 1e9;
    return result;
  },
};
