import { visibleGridEndpoints, gridBubbleCenter } from './grid-label-position.js';
import { gridSegments, gridCrossings } from './grid-geometry.js';
import {
  gridBubbleMetrics,
  projectedGridBubbleDiameter,
  modelGridBubbleMetrics,
} from './grid-bubble-size.js';
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
    const add = (start, end, label, id, bubbleEnds) => {
      const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({ color: 0x82969f, dashSize: 220, gapSize: 110 }),
      );
      line.userData.gridId = id;
      line.computeLineDistances();
      if (!data.modelObjects) this.group.add(line);
      else {
        line.geometry.dispose();
        line.material.dispose();
      }
      points.forEach((position, index) => {
        this.bounds.expandByPoint(position);
        const el = document.createElement('span');
        el.textContent = label;
        this.overlay.append(el);
        this.labels.push({ position, opposite: points[1 - index], index, el, id, bubbleEnds });
      });
    };
    for (const line of gridSegments(data))
      add(
        [...line.start, line.z ?? data.z ?? 0],
        [...line.end, line.z ?? data.z ?? 0],
        line.label,
        line.pickId,
        line.bubbleEnds,
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
  updateLabels(camera, width, height, { keepVisible = false, diameter } = {}) {
    for (const { position, opposite, index, el, bubbleEnds } of this.labels) {
      const p = position.clone().project(camera);
      const metrics =
        diameter === undefined
          ? modelGridBubbleMetrics(
              el.textContent,
              projectedGridBubbleDiameter(camera, position, width, height),
            )
          : gridBubbleMetrics(el.textContent, diameter);
      if (diameter === undefined)
        for (const key of ['radius', 'height', 'fontSize', 'strokeWidth', 'inset'])
          metrics[key] *= this.data?.bubbleScale ?? 1;
      if (
        diameter === undefined &&
        ((bubbleEnds === 'start' && index === 1) || (bubbleEnds === 'end' && index === 0))
      ) {
        el.hidden = true;
        continue;
      }
      const labelRadius = metrics.radius;
      el.style.width = `${labelRadius * 2}px`;
      el.style.height = `${diameter === undefined ? metrics.height : labelRadius * 2}px`;
      el.style.whiteSpace = diameter === undefined ? 'nowrap' : '';
      el.style.fontSize = `${metrics.fontSize}px`;
      el.style.borderWidth = `${metrics.strokeWidth}px`;
      if (keepVisible) {
        const q = opposite.clone().project(camera),
          radius = labelRadius;
        const ends =
          Math.abs(p.z) <= 1 && Math.abs(q.z) <= 1
            ? visibleGridEndpoints(
                [((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2],
                [((q.x + 1) * width) / 2, ((1 - q.y) * height) / 2],
                width,
                height,
                radius + metrics.inset,
              )
            : null;
        el.hidden =
          !ends ||
          (index === 1 &&
            Math.hypot(ends[0][0] - ends[1][0], ends[0][1] - ends[1][1]) <
              radius * 2 + metrics.inset);
        if (ends) {
          el.style.left = `${ends[0][0]}px`;
          el.style.top = `${ends[0][1]}px`;
        }
        continue;
      }
      el.hidden = Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1;
      const q = opposite.clone().project(camera);
      const endpoint = [((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2];
      const center =
        diameter === undefined
          ? gridBubbleCenter(
              endpoint,
              [((q.x + 1) * width) / 2, ((1 - q.y) * height) / 2],
              labelRadius,
              metrics.height,
            )
          : endpoint;
      el.style.left = `${center[0]}px`;
      el.style.top = `${center[1]}px`;
    }
  }
  snap(point, camera, width, height) {
    const projected = point.clone().project(camera);
    let nearest = null,
      distance = 14;
    for (const { point: coords } of gridCrossings(this.data)) {
      const candidate = new THREE.Vector3(...coords, point.z);
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
