import * as THREE from 'three';
import { loopKey } from './shape-key.js';
import {
  plateGeometry,
  validatePlate,
  plateCorners,
  plateVertices,
  plateContour,
} from '../../plate.js';
import { translateFrame, rotateFrame } from './frame-transform.js';
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
    const vertices = plateVertices(s);
    return {
      segments: vertices.map((p, i) => [p, vertices[(i + 1) % vertices.length]]),
      includeEdges: true,
    };
  },
  translate: translateFrame,
  rotate: rotateFrame,
};
