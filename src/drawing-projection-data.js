import * as THREE from 'three';
import { projectedDrawing } from './drawing-vector.js';

/** Transfer copies; the editor/importer retains ownership of its geometry. */
export function drawingProjectionData(surfaces, edges) {
  const buffers = [];
  const encode = ({ geometry, planes = [], ...attributes }) => {
    const positions = geometry.attributes.position.array.slice(),
      indices = geometry.index?.array.slice();
    buffers.push(positions.buffer);
    if (indices) buffers.push(indices.buffer);
    return {
      ...attributes,
      positions,
      indices,
      planes: planes.map((p) => [...p.normal.toArray(), p.constant]),
    };
  };
  return { data: { surfaces: surfaces.map(encode), edges: edges.map(encode) }, buffers };
}

export function calculateDrawingProjection(data) {
  const geometries = [];
  const decode = ({ positions, indices, planes, ...attributes }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (indices) geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometries.push(geometry);
    return {
      ...attributes,
      geometry,
      planes: planes.map((p) => new THREE.Plane(new THREE.Vector3(...p.slice(0, 3)), p[3])),
    };
  };
  try {
    return projectedDrawing(data.surfaces.map(decode), data.edges.map(decode));
  } finally {
    geometries.forEach((geometry) => geometry.dispose());
  }
}
