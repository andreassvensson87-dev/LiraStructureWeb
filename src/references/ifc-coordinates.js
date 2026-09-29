import * as THREE from 'three';
// web-ifc's placement includes unit conversion to metres and the IFC -> Y-up rotation.
export function ifcPlacement(matrix) {
  return new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .scale(new THREE.Vector3(1000, 1000, 1000))
    .multiply(new THREE.Matrix4().fromArray(matrix));
}
