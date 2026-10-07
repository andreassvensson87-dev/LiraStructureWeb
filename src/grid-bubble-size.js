import * as THREE from 'three';

export const MODEL_GRID_BUBBLE_DIAMETER = 600;
export const DRAWING_GRID_BUBBLE_DIAMETER = 8;

// A camera-facing model length follows both perspective distance and orthographic zoom.
export function projectedGridBubbleDiameter(camera, position, width, height) {
  const a = position.clone().project(camera);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const b = position.clone().addScaledVector(right, MODEL_GRID_BUBBLE_DIAMETER).project(camera);
  return Math.hypot(((b.x - a.x) * width) / 2, ((b.y - a.y) * height) / 2);
}

export function gridBubbleMetrics(label, diameter) {
  const scale = diameter / 28;
  return {
    radius: Math.max(14, label.length * 3 + 6) * scale,
    height: diameter,
    fontSize: 12 * scale,
    strokeWidth: scale,
    inset: 2 * scale,
  };
}
