import * as THREE from 'three';
import { partMatrix } from './part-marks.js';
import { partDrawingReflection, partViewFrame } from './part-view-frame.js';

export function assemblyDrawingMatrix(main) {
  const matrix = partMatrix(main);
  const reflection = partDrawingReflection(matrix);
  return reflection ? reflection.multiply(matrix) : matrix;
}

/** Retain existing paper projections when a different part becomes the assembly anchor. */
export function rebaseAssemblyViews(sheet, oldMatrix, newMatrix) {
  const transform = newMatrix.clone().multiply(oldMatrix.clone().invert());
  const references = sheet.assemblyReferenceMatrix
    ? new THREE.Matrix4().fromArray(sheet.assemblyReferenceMatrix)
    : new THREE.Matrix4();
  sheet.assemblyReferenceMatrix = references.multiply(transform.clone().invert()).toArray();
  for (const view of sheet.views || []) {
    if (view.section || view.detail) continue;
    const frame = view.assemblyFrame || partViewFrame(view.projection || view.id);
    view.assemblyFrame = {
      origin: new THREE.Vector3(...frame.origin).applyMatrix4(transform).toArray(),
      ...Object.fromEntries(
        ['x', 'y', 'normal'].map((axis) => [
          axis,
          new THREE.Vector3(...frame[axis]).transformDirection(transform).toArray(),
        ]),
      ),
    };
  }
  sheet.assemblyModelMatrix = newMatrix.toArray();
}
