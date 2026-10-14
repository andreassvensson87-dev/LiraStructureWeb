import * as THREE from 'three';
import { loopKey } from './shape-key.js';
import {
  plateGeometry,
  validatePlate,
  plateCorners,
  plateVertices,
  plateContour,
  platePoint,
  plateControlContour,
} from '../../plate.js';
import { translateFrame, rotateFrame } from './frame-transform.js';
import { cornerPath } from '../geometry/corner-path.js';
import { cornerMeasures } from '../../geometry/measurements.js';
export const plateType = {
  id: 'plate',
  label: 'Plate',
  prefix: 'P',
  family: 'plate',
  inspector: 'plate',
  cut: false,
  geometry: plateGeometry,
  validate: validatePlate,
  corners: plateCorners,
  anchors: plateVertices,
  measurements: (s) =>
    cornerMeasures(
      cornerPath(
        plateControlContour(s).map((p) => platePoint(s, p)),
        s.radii,
        true,
      ),
      true,
    ),
  partFrame: (s) => ({
    origin: new THREE.Vector3(...s.frame.origin),
    x: new THREE.Vector3(...s.frame.u),
    y: new THREE.Vector3(...s.frame.v),
    z: new THREE.Vector3(...s.frame.u).cross(new THREE.Vector3(...s.frame.v)),
  }),
  partShape: (s) => ({
    type: 'plate',
    polygon: loopKey(plateContour(s)),
    thickness: s.thickness,
    side: s.side,
  }),
  snapSegments(s) {
    const vertices = plateContour(s).map((p) => platePoint(s, p));
    return {
      segments: vertices.map((p, i) => [p, vertices[(i + 1) % vertices.length]]),
      includeEdges: true,
    };
  },
  translate: translateFrame,
  rotate: rotateFrame,
};
