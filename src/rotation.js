import * as THREE from 'three';
import { objectType } from './model/object-types/index.js';
export const rotationAxes = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
// Rotate the entire local frame, including eccentric profile placement.
export function rotateObject(source, pivot, axis, degrees) {
  const direction = new THREE.Vector3(...(Array.isArray(axis) ? axis : rotationAxes[axis]));
  if (!direction.toArray().every(Number.isFinite) || direction.length() < 1e-10)
    throw new Error('Rotationsaxeln behöver två olika punkter.');
  const q = new THREE.Quaternion().setFromAxisAngle(
    direction.normalize(),
    (degrees * Math.PI) / 180,
  );
  const origin = new THREE.Vector3(...pivot);
  const turn = (p) =>
    new THREE.Vector3(...p)
      .sub(origin)
      .applyQuaternion(q)
      .add(origin)
      .toArray()
      .map((v) => Math.round(v * 1e9) / 1e9);
  return objectType(source).rotate(source, { turn, quaternion: q });
}
export const rotateSweep = rotateObject;
export function parseAngle(text) {
  const normalized = text.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))
    throw new Error('Ange en vinkel, exempelvis 90 eller −45.');
  const angle = Number(normalized);
  if (!Number.isFinite(angle) || Math.abs(angle) > 36000)
    throw new Error('Vinkeln måste vara inom ±36 000°.');
  return angle;
}
