import * as THREE from 'three';
import { createModelViewport } from '../model/viewport.js';
import { itemTemplate } from './geometry.js';
import { helperSnapPoints } from './guides.js';
/** Detached library/editor viewport. Its construction geometry never becomes project objects. */
export class ItemView {
  constructor(host, { pick = () => {}, status = () => {} } = {}) {
    this.host = host;
    this.pick = pick;
    this.status = status;
    this.lines = [];
    this.mode = null;
    const { dispose, ...viewport } = createModelViewport(host, status);
    Object.assign(this, viewport);
    this.viewportDispose = dispose;
    this.content = new THREE.Group();
    this.guides = new THREE.Group();
    this.scene.add(this.content, this.guides);
    this.markers = ['start', 'end'].map((key) => {
      const marker = document.createElement('div');
      marker.className = `item-point item-point-${key}`;
      marker.textContent = key === 'start' ? 'Start' : 'Slut';
      marker.hidden = true;
      host.append(marker);
      return marker;
    });
    this.cursor = document.createElement('div');
    this.cursor.className = 'item-pick-marker';
    this.cursor.hidden = true;
    host.append(this.cursor);
    this.raycaster = new THREE.Raycaster();
    const canvas = this.renderer.domElement;
    let down;
    this.onDown = (event) => {
      if (event.button === 0) down = [event.clientX, event.clientY];
    };
    this.onMove = (event) => {
      if (!this.mode || event.buttons) return;
      const point = this.point(event);
      this.cursor.hidden = !point;
      if (point) {
        this.cursor.style.left = `${event.clientX - host.getBoundingClientRect().left}px`;
        this.cursor.style.top = `${event.clientY - host.getBoundingClientRect().top}px`;
      }
    };
    this.onUp = (event) => {
      const origin = down;
      down = null;
      if (
        !this.mode ||
        event.button !== 0 ||
        !origin ||
        Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 5
      )
        return;
      const point = this.point(event);
      if (point) this.pick(point);
    };
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointermove', this.onMove);
    this.renderer.setAnimationLoop(() => {
      if (
        !host.isConnected ||
        !host.clientWidth ||
        !host.clientHeight ||
        !host.closest('dialog')?.open
      )
        return;
      this.navigation.controls.update();
      this.camera.updateMatrixWorld();
      this.updateMarkers();
      this.renderer.render(this.scene, this.camera);
    });
  }
  setMode(mode) {
    this.mode = mode;
    this.navigation.controls.mouseButtons.LEFT = mode ? null : THREE.MOUSE.ROTATE;
    this.cursor.hidden = true;
    this.renderer.domElement.style.cursor = mode ? 'crosshair' : 'grab';
  }
  setItem(item, { points = false } = {}) {
    this.clear(this.content);
    this.item = item;
    this.showPoints = points;
    this.objectPoints = [];
    if (!item) {
      this.updateMarkers();
      return;
    }
    const { geometry, edges } = itemTemplate(item);
    this.mesh = new THREE.Mesh(
      geometry.clone(),
      new THREE.MeshStandardMaterial({
        color: 0x8c9ca4,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.15,
      }),
    );
    this.mesh.add(
      new THREE.LineSegments(edges.clone(), new THREE.LineBasicMaterial({ color: 0x3e5663 })),
    );
    this.content.add(this.mesh);
    const bounds = geometry.boundingBox,
      span = bounds.getSize(new THREE.Vector3()).length() || 100;
    this.span = span;
    const grid = new THREE.GridHelper(span * 2, 20, 0xb5c7cd, 0xd4dfe3);
    grid.rotateX(Math.PI / 2);
    grid.position.copy(bounds.getCenter(new THREE.Vector3())).setZ(bounds.min.z);
    this.content.add(grid);
    const unique = new Map(),
      p = edges.attributes.position;
    for (let i = 0; i < p.count; i += 2) {
      const a = [p.getX(i), p.getY(i), p.getZ(i)],
        b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)];
      for (const point of [a, b, a.map((v, j) => (v + b[j]) / 2)])
        unique.set(point.map((n) => Math.round(n * 1000)).join(','), point);
    }
    this.objectPoints = [...unique.values()];
    this.start = [...item.start];
    this.end = [...item.end];
    this.setGuides([]);
    this.fit();
  }
  setPoints(start, end) {
    this.start = start;
    this.end = end;
    this.setGuides(this.lines);
  }
  setGuides(lines, visible = true) {
    this.lines = lines;
    this.guidesVisible = visible;
    this.clear(this.guides);
    const line = (points, color, dashed = false) => {
      const object = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p))),
        dashed
          ? new THREE.LineDashedMaterial({
              color,
              dashSize: (this.span || 100) / 50,
              gapSize: (this.span || 100) / 80,
              depthTest: false,
            })
          : new THREE.LineBasicMaterial({ color, depthTest: false }),
      );
      if (dashed) object.computeLineDistances();
      object.renderOrder = 5;
      this.guides.add(object);
    };
    if (this.showPoints && this.start && this.end) line([this.start, this.end], 0x258e79, true);
    if (visible) for (const points of lines) line(points, 0x8765ad, true);
  }
  point(event) {
    if (!this.mesh) return null;
    const r = this.host.getBoundingClientRect(),
      pointer = [event.clientX - r.left, event.clientY - r.top];
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(
      new THREE.Vector2((pointer[0] / r.width) * 2 - 1, 1 - (pointer[1] / r.height) * 2),
      this.camera,
    );
    if (this.snap !== false) {
      const p = new THREE.Vector3();
      let best = null,
        distance = 12 * 12;
      const candidates = [
        this.start,
        this.end,
        ...(this.guidesVisible ? helperSnapPoints(this.lines) : []),
        ...this.objectPoints,
      ];
      for (const point of candidates) {
        p.fromArray(point).project(this.camera);
        if (Math.abs(p.z) > 1) continue;
        const dx = ((p.x + 1) * r.width) / 2 - pointer[0],
          dy = ((1 - p.y) * r.height) / 2 - pointer[1],
          d = dx * dx + dy * dy;
        if (d < distance) {
          distance = d;
          best = point;
        }
      }
      if (best) {
        this.status('Snap · Punkt / mittpunkt / skärning');
        return [...best];
      }
    }
    const hit = this.raycaster.intersectObject(this.mesh, false)[0];
    if (hit) {
      this.status('Objektyta');
      return hit.point.toArray();
    }
    const axis = this.plane === 'XZ' ? 1 : this.plane === 'YZ' ? 0 : 2,
      normal = new THREE.Vector3().setComponent(axis, 1);
    const origin = this.planeLevel ?? this.start?.[axis] ?? 0;
    const p = this.raycaster.ray.intersectPlane(
      new THREE.Plane(normal, -origin),
      new THREE.Vector3(),
    );
    this.status(`Arbetsplan ${this.plane || 'XY'} · ${origin} mm`);
    return p?.toArray() || null;
  }
  fit(direction) {
    if (this.mesh)
      this.navigation.fit(
        this.mesh.geometry.boundingBox,
        direction || new THREE.Vector3(1, -1, 0.8).normalize(),
      );
  }
  updateMarkers() {
    this.markers.forEach((marker, i) => {
      marker.hidden = !this.item || !this.showPoints;
      if (marker.hidden) return;
      const p = new THREE.Vector3(...(i ? this.end : this.start)).project(this.camera);
      marker.hidden = Math.abs(p.z) > 1;
      marker.style.left = `${((p.x + 1) * this.host.clientWidth) / 2}px`;
      marker.style.top = `${((1 - p.y) * this.host.clientHeight) / 2}px`;
    });
  }
  clear(group) {
    group.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    group.clear();
  }
  dispose() {
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onUp);
    this.renderer.domElement.removeEventListener('pointermove', this.onMove);
    this.clear(this.content);
    this.clear(this.guides);
    this.markers.forEach((m) => m.remove());
    this.cursor.remove();
    this.renderer.setAnimationLoop(null);
    // The viewport owns resize/wheel listeners and WebGL resources.
    this.viewportDispose();
  }
}
