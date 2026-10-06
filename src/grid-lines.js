import { visibleGridEndpoints } from './grid-label-position.js';
import { gridLabel } from './grid-labels.js';
import * as THREE from 'three';

export const defaultGrid = { x: [0, 3000, 6000], y: [0, 4000, 8000] };
export function parsePositions(value) {
  const parts = value.trim().split(/[;\s]+/);
  const values = parts.map(Number);
  if (
    !value.trim() ||
    values.length < 2 ||
    values.length > 20 ||
    values.some((v) => !Number.isFinite(v) || Math.abs(v) > 1000000) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(
      'Ange 2–20 olika lägen per riktning, inom ±1 000 000 mm. Separera med mellanslag.',
    );
  }
  return values.sort((a, b) => a - b);
}

export class GridLines {
  constructor(scene, host) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.overlay = document.createElement('div');
    this.overlay.className = 'grid-labels';
    this.overlay.setAttribute('aria-hidden', 'true');
    host.append(this.overlay);
    this.labels = [];
    this.highlighted = '';
  }
  set(data) {
    this.data = structuredClone(data);
    for (const child of [...this.group.children]) {
      child.geometry.dispose();
      child.material.dispose();
      this.group.remove(child);
    }
    this.overlay.replaceChildren();
    this.labels = [];
    this.highlighted = '';
    this.bounds = new THREE.Box3();
    const extension = 1500;
    const add = (start, end, label, id) => {
      const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({ color: 0x82969f, dashSize: 220, gapSize: 110 }),
      );
      line.userData.gridId = id;
      line.computeLineDistances();
      this.group.add(line);
      points.forEach((position, index) => {
        this.bounds.expandByPoint(position);
        const el = document.createElement('span');
        el.textContent = label;
        this.overlay.append(el);
        this.labels.push({ position, opposite: points[1 - index], index, el, id });
      });
    };
    data.x.forEach((x, i) =>
      add(
        [x, data.y[0] - extension, data.z || 0],
        [x, data.y.at(-1) + extension, data.z || 0],
        gridLabel(data, 'x', i),
        `x:${i}`,
      ),
    );
    data.y.forEach((y, i) =>
      add(
        [data.x[0] - extension, y, data.z || 0],
        [data.x.at(-1) + extension, y, data.z || 0],
        gridLabel(data, 'y', i),
        `y:${i}`,
      ),
    );
  }
  highlight(ids = []) {
    const key = ids.join('|');
    if (key === this.highlighted) return;
    this.highlighted = key;
    for (const line of this.group.children)
      line.material.color.setHex(ids.includes(line.userData.gridId) ? 0x16815e : 0x82969f);
    for (const { el, id } of this.labels) el.classList.toggle('snap-active', ids.includes(id));
  }
  updateLabels(camera, width, height, { keepVisible = false } = {}) {
    for (const { position, opposite, index, el } of this.labels) {
      const p = position.clone().project(camera);
      const labelRadius = Math.max(14, el.textContent.length * 3 + 6);
      if (keepVisible) {
        const q = opposite.clone().project(camera),
          radius = Math.max(1, Math.min(labelRadius, width / 2 - 1, height / 2 - 1));
        const ends =
          Math.abs(p.z) <= 1 && Math.abs(q.z) <= 1
            ? visibleGridEndpoints(
                [((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2],
                [((q.x + 1) * width) / 2, ((1 - q.y) * height) / 2],
                width,
                height,
                radius + 2,
              )
            : null;
        el.hidden =
          !ends ||
          (index === 1 &&
            Math.hypot(ends[0][0] - ends[1][0], ends[0][1] - ends[1][1]) < radius * 2 + 2);
        if (ends) {
          el.style.left = `${ends[0][0]}px`;
          el.style.top = `${ends[0][1]}px`;
        }
        el.style.width = el.style.height = `${radius * 2}px`;
        el.style.fontSize = `${Math.max(8, Math.min(12, radius))}px`;
        continue;
      }
      el.hidden = Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1;
      el.style.left = `${((p.x + 1) * width) / 2}px`;
      el.style.top = `${((1 - p.y) * height) / 2}px`;
      el.style.width = el.style.height = `${labelRadius * 2}px`;
    }
  }
  snap(point, camera, width, height) {
    const projected = point.clone().project(camera);
    let nearest = null,
      distance = 14;
    for (const x of this.data.x)
      for (const y of this.data.y) {
        const candidate = new THREE.Vector3(x, y, point.z);
        const p = candidate.clone().project(camera);
        const d = Math.hypot(((p.x - projected.x) * width) / 2, ((p.y - projected.y) * height) / 2);
        if (d < distance) {
          nearest = candidate;
          distance = d;
        }
      }
    return nearest;
  }
}
