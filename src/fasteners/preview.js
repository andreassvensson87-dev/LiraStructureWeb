import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fastenerFrame } from './geometry.js';
import { fastenerLayoutAnchors } from './placement-frame.js';
import { cadFeedback } from '../ui/cad-feedback.js';

/** Temporary graphics for the ordinary model preview, with no picking or model state. */
export function fastenerPreviewOverlay(batch) {
  const group = new THREE.Group();
  group.name = 'Skruvgrupp · riktning och materiallager';
  group.userData.fastenerPreview = true;
  group.renderOrder = 30;
  const source = batch[0];
  if (!source) return group;
  if (source.layout && source.group) {
    const [origin, x, y] = fastenerLayoutAnchors(source);
    const opposite = x.map((v, i) => v + y[i] - origin[i]);
    const points = [origin, x, opposite, y, origin].map((p) => new THREE.Vector3(...p));
    const outline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({
        color: cadFeedback.preview,
        transparent: true,
        opacity: 0.55,
        depthTest: false,
        depthWrite: false,
        dashSize: 6,
        gapSize: 4,
      }),
    );
    outline.name = 'Skruvgruppens placeringsplan';
    outline.computeLineDistances();
    outline.raycast = () => {};
    outline.renderOrder = 30;
    group.add(outline);
  }
  const pieces = [];
  for (const screw of batch) {
    const f = fastenerFrame(screw);
    const matrix = new THREE.Matrix4().makeBasis(f.x, f.y, f.z);
    for (const hole of screw.holes) {
      if (hole.active === false || hole.kind === 'none') continue;
      for (const layer of hole.layers || [])
        for (const offset of [layer.offset - 0.02, layer.offset + layer.depth + 0.02]) {
          const radius = hole.diameter / 2;
          const ring = new THREE.RingGeometry(
            radius,
            radius + Math.min(0.7, hole.diameter * 0.04),
            48,
          );
          ring.applyMatrix4(
            matrix.clone().setPosition(f.origin.clone().addScaledVector(f.z, offset)),
          );
          pieces.push(ring);
        }
    }
  }
  const geometry = pieces.length
    ? mergeGeometries(pieces)
    : new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  pieces.forEach((p) => p.dispose());
  const rings = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: cadFeedback.preview,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  rings.name = 'Nådda materiallager';
  rings.raycast = () => {};
  rings.renderOrder = 30;
  group.add(rings);
  return group;
}
