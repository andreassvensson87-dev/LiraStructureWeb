import * as THREE from 'three';
import { partViewFrame } from './part-view-frame.js';
import { frameMatrix } from './drawing-sections.js';

export const standardPartViews = {
  top: 'Top',
  bottom: 'Bottom',
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
};

export function createStandardPartView(projection, bounds, scale, sourceId) {
  const frame = partViewFrame(projection);
  const box = bounds.clone().applyMatrix4(frameMatrix(frame));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    id: crypto.randomUUID(),
    name: standardPartViews[projection],
    kind: 'view',
    standard: true,
    projection,
    source: { type: 'part', objectId: sourceId },
    position: [0, 0],
    size: [Math.max(25, size.x / scale + 12), Math.max(25, size.y / scale + 12)],
    camera: { center: [center.x, center.y] },
    scale,
    settings: { hiddenLines: true },
  };
}
