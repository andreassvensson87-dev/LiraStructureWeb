import * as THREE from 'three';
import { clean, loopKey } from './shape-key.js';
import { contours } from '../../sweep.js';
import { cornerMeasures } from '../../geometry/measurements.js';
import {
  polysweepGeometry,
  polysweepCorners,
  polysweepPath,
  polysweepFrame,
  validatePolysweep,
} from '../polysweep.js';
export const polysweepType = {
  id: 'polysweep',
  ifcClass: 'IfcMember',
  label: 'Polysweep',
  prefix: 'B',
  family: 'sweep',
  inspector: 'sweep',
  cut: false,
  geometry: polysweepGeometry,
  validate: validatePolysweep,
  corners: polysweepCorners,
  anchors: (s) => s.points,
  measurements: (s) => cornerMeasures(polysweepPath(s)),
  partFrame: polysweepFrame,
  partShape(s) {
    const frame = polysweepFrame(s),
      points = s.points.map((p) => {
        const d = new THREE.Vector3(...p).sub(frame.origin);
        return [d.dot(frame.x), d.dot(frame.y), d.dot(frame.z)].map(clean);
      });
    return {
      type: 'polysweep',
      loops: contours(s).map(loopKey),
      points,
      radii: s.radii || s.points.map(() => 0),
    };
  },
  snapSegments(s) {
    const points = polysweepPath(s).samples.map((p) => p.point.toArray());
    return { segments: points.slice(1).map((p, i) => [points[i], p]), includeEdges: true };
  },
  translate: (source, delta) => ({
    ...source,
    points: source.points.map((p) => p.map((v, i) => v + delta[i])),
  }),
  moveAnchor: (source, index, target) => ({
    ...source,
    points: source.points.map((p, i) => (i === index ? [...target] : p)),
  }),
  rotate(source, { turn, quaternion }) {
    const frame = polysweepFrame(source);
    // Store a rotated intrinsic profile normal, preserving the cross-section orientation.
    return {
      ...source,
      points: source.points.map(turn),
      profileUp: frame.z.clone().applyQuaternion(quaternion).toArray(),
      rotation: 0,
    };
  },
};
