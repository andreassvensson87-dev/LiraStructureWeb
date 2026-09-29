import * as THREE from 'three';
import { planeFrame, plateLocal } from './plate.js';

// Three clicks define a right-handed, orthonormal frame in model coordinates.
export function workPlaneFromPoints(points) {
  return planeFrame('three', points);
}
export function drawingWorkPlane(operation, temporaryPlane) {
  if (operation?.mode === 'plateCreate') return operation.frame;
  if (operation?.mode === 'plateVertex') return operation.source.frame;
  return !operation || ['move', 'copy'].includes(operation.mode) ? temporaryPlane : null;
}
export class WorkPlaneGuide {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
  }
  clear() {
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
    const line = (coords, color, loop = false) => {
      const vertices = loop ? [...coords, coords[0]] : coords;
      const l = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(vertices.map((p) => new THREE.Vector3(...p))),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75, depthTest: false }),
      );
      l.renderOrder = 9;
      this.group.add(l);
    };
    if (!frame) {
      if (points.length > 1) line(points, 0x258e79);
      return;
    }
    const locals = points.map((p) => plateLocal({ frame }, p));
    const size = Math.max(500, ...locals.flat().map(Math.abs));
    const origin = new THREE.Vector3(...frame.origin),
      u = new THREE.Vector3(...frame.u),
      v = new THREE.Vector3(...frame.v);
    const length = size * 0.4;
    for (const [direction, color] of [
      [u, 0xd25650],
      [v, 0x258e79],
      [u.clone().cross(v).normalize(), 0x397dc5],
    ]) {
      const arrow = new THREE.ArrowHelper(
        direction,
        origin,
        length,
        color,
        length * 0.16,
        length * 0.075,
      );
      // ArrowHelper shares its default geometries; own these copies for disposal.
      for (const part of [arrow.line, arrow.cone]) {
        part.geometry = part.geometry.clone();
        part.material.depthTest = false;
        part.material.depthWrite = false;
        part.renderOrder = 9;
      }
      this.group.add(arrow);
    }
  }
}
