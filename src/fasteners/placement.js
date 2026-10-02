import * as THREE from 'three';
import { geometryForModel } from '../model-object.js';
import { fastenerFrame } from './geometry.js';

/** Surface intersections along the screw axis, measured from the underside of its head. */
export function partAxisInterval(s, part, model) {
  const f = fastenerFrame(s),
    geometry = geometryForModel(part, model);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  try {
    geometry.computeBoundingBox();
    if (geometry.boundingBox.isEmpty()) throw new Error('Delen saknar material.');
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    const radius = geometry.boundingBox.getSize(new THREE.Vector3()).length();
    const distance = Math.max(1, f.origin.distanceTo(center) + radius + 1);
    const ray = new THREE.Raycaster(f.origin.clone().addScaledVector(f.z, -distance), f.z);
    const hits = ray
      .intersectObject(new THREE.Mesh(geometry, material))
      .map((h) => h.distance - distance);
    if (hits.length < 2) throw new Error(`Skruvaxeln träffar inte ${part.name || part.id}.`);
    return { offset: Math.min(...hits), depth: Math.max(...hits) - Math.min(...hits) };
  } finally {
    geometry.dispose();
    material.dispose();
  }
}
