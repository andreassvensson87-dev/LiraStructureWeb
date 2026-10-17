import * as THREE from 'three';
import { cadFeedback } from '../ui/cad-feedback.js';

const glyphs = {
  X: [
    [-3, -5, 3, 5],
    [-3, 5, 3, -5],
  ],
  Y: [
    [-3, 5, 0, 0],
    [3, 5, 0, 0],
    [0, 0, 0, -5],
  ],
  Z: [
    [-3, 5, 3, 5],
    [3, 5, -3, -5],
    [-3, -5, 3, -5],
  ],
};
// The work-plane indicator is navigation feedback, so the model crop must not cut its arrows.
const overlayMaterial = (value) => {
  value.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '',
    );
  };
  value.customProgramCacheKey = () => 'work-plane-overlay';
  return value;
};
const material = (color) =>
  overlayMaterial(new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false }));
const geometry = (count) =>
  new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3),
  );

/** Temporary model graphics. Camera-scaled geometry never changes the work plane. */
export class WorkPlaneGuide {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = 9;
    scene.add(this.group);
    this.frame = null;
    this.axes = [];
  }
  clear() {
    this.group.visible = true;
    this.frame = null;
    this.axes = [];
    for (const child of [...this.group.children]) {
      child.traverse((part) => {
        part.geometry?.dispose();
        part.material?.dispose();
      });
      this.group.remove(child);
    }
  }
  show(points, frame = null) {
    this.clear();
    if (!frame) {
      if (points.length > 1) {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p))),
          material(0x258e79),
        );
        line.renderOrder = 9;
        this.group.add(line);
      }
      return;
    }
    this.frame = frame;
    this.group.position.set(0, 0, 0);
    const u = new THREE.Vector3(...frame.u),
      v = new THREE.Vector3(...frame.v);
    for (const [name, direction, color] of [
      ['X', u, cadFeedback.axisX],
      ['Y', v, cadFeedback.axisY],
      ['Z', u.clone().cross(v).normalize(), cadFeedback.axisZ],
    ]) {
      const shaft = new THREE.Line(geometry(2), material(color));
      const head = new THREE.Mesh(
        geometry(3),
        overlayMaterial(
          new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
          }),
        ),
      );
      const label = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(
          glyphs[name].flatMap(([x0, y0, x1, y1]) => [
            new THREE.Vector3(x0, y0, 0),
            new THREE.Vector3(x1, y1, 0),
          ]),
        ),
        material(color),
      );
      for (const part of [shaft, head, label]) {
        part.renderOrder = 9;
        part.frustumCulled = false;
        this.group.add(part);
      }
      this.axes.push({ direction, shaft, head, label });
    }
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(3, 4.2, 32),
      overlayMaterial(
        new THREE.MeshBasicMaterial({
          color: 0x344e59,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    );
    this.center = new THREE.Mesh(
      new THREE.CircleGeometry(3, 32),
      overlayMaterial(
        new THREE.MeshBasicMaterial({
          color: 0xf3f5f6,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    );
    for (const part of [this.ring, this.center]) {
      part.renderOrder = 10;
      part.frustumCulled = false;
      this.group.add(part);
    }
    this.group.visible = false;
  }
  update(camera, width, height) {
    if (!this.frame || !width || !height) return;
    const origin = new THREE.Vector3(...this.frame.origin);
    const projected = origin.clone().project(camera);
    this.group.visible = projected.z >= -1 && projected.z <= 1;
    if (!this.group.visible) return;
    const scale = camera.isOrthographicCamera
      ? (camera.top - camera.bottom) / camera.zoom / height
      : (2 *
          Math.abs(origin.clone().applyMatrix4(camera.matrixWorldInverse).z) *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
        camera.zoom /
        height;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
      up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    for (const { direction, shaft, head, label } of this.axes) {
      const end = origin.clone().addScaledVector(direction, scale * 70);
      const tip = end.clone().project(camera);
      const screen = new THREE.Vector2(
        ((tip.x - projected.x) * width) / 2,
        ((tip.y - projected.y) * height) / 2,
      );
      const visible = screen.length() > 12;
      shaft.visible = head.visible = label.visible = visible;
      if (!visible) continue;
      screen.normalize();
      const along = right.clone().multiplyScalar(screen.x).addScaledVector(up, screen.y);
      const across = right.clone().multiplyScalar(-screen.y).addScaledVector(up, screen.x);
      const base = end.clone().addScaledVector(along, -8 * scale);
      const shaftPositions = shaft.geometry.attributes.position;
      shaftPositions.setXYZ(
        0,
        ...origin
          .clone()
          .addScaledVector(direction, 4.2 * scale)
          .toArray(),
      );
      shaftPositions.setXYZ(1, ...base.toArray());
      shaftPositions.needsUpdate = true;
      const headPositions = head.geometry.attributes.position;
      [
        end,
        base.clone().addScaledVector(across, 3 * scale),
        base.clone().addScaledVector(across, -3 * scale),
      ].forEach((p, i) => headPositions.setXYZ(i, ...p.toArray()));
      headPositions.needsUpdate = true;
      label.position.copy(end).addScaledVector(along, 12 * scale);
      label.quaternion.copy(camera.quaternion);
      label.scale.setScalar(scale);
    }
    for (const part of [this.ring, this.center]) {
      part.position.copy(origin);
      part.quaternion.copy(camera.quaternion);
      part.scale.setScalar(scale);
    }
  }
}
