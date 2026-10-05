import * as THREE from 'three';
import { objectGeometry, displayGeometry } from './model-object.js';
import { partMatrix } from './part-marks.js';
import { assemblyMembers, assemblyValid } from './project/assemblies.js';

function combinedGeometry(geometries) {
  const positions = [];
  for (const geometry of geometries) {
    const p = geometry.attributes.position;
    const count = geometry.index?.count ?? p.count;
    for (let i = 0; i < count; i++) {
      const index = geometry.index?.getX(i) ?? i;
      positions.push(p.getX(index), p.getY(index), p.getZ(index));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
/** Keep individual solids for occlusion/seams, and a combined mesh for view bounds/tools. */
export function assemblyGeometry(assembly, objects) {
  if (!assemblyValid(assembly, objects)) throw Error('Assemblyn saknar en eller flera delar.');
  const matrix = partMatrix(objects.find((o) => o.id === assembly.mainId));
  const entries = [];
  try {
    for (const object of assemblyMembers(assembly, objects)) {
      const geometry = objectGeometry(object, objects).applyMatrix4(matrix);
      const entry = { id: object.id, geometry };
      entries.push(entry);
      entry.snapGeometry = displayGeometry(object, objects).applyMatrix4(matrix);
    }
    return {
      entries,
      matrix,
      geometry: combinedGeometry(entries.map((e) => e.geometry)),
      snapGeometry: combinedGeometry(entries.map((e) => e.snapGeometry)),
    };
  } catch (error) {
    for (const entry of entries) {
      entry.geometry.dispose();
      entry.snapGeometry?.dispose();
    }
    throw error;
  }
}
