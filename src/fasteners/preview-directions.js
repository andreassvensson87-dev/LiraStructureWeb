import * as THREE from 'three';
import { fastenerFrame } from './geometry.js';
import { cadFeedback, paintCadGuide } from '../ui/cad-feedback.js';

/** Camera-projected, fixed-size directions share the model's existing feedback SVG. */
export function paintFastenerDirections(root, batch, projectPoint) {
  const source = batch?.[0];
  if (!source) return;
  const frame = fastenerFrame(source);
  const origin = source.group?.origin || source.layout?.frame.origin || source.start;
  const p = projectPoint(origin);
  if (!p) return;
  const anchor = [p[0] - 25, p[1] - 35];
  const line = (a, b, color) => {
    const path = paintCadGuide(root, a, b);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
  };
  paintCadGuide(root, p, anchor, { dashed: true });
  for (const [direction, color] of [
    [source.group?.u || frame.x.toArray(), cadFeedback.axisX],
    [frame.z.toArray(), cadFeedback.axisZ],
  ]) {
    const tip = projectPoint(
      new THREE.Vector3(...origin).addScaledVector(new THREE.Vector3(...direction), 10).toArray(),
    );
    if (!tip) continue;
    const dx = tip[0] - p[0],
      dy = tip[1] - p[1],
      length = Math.hypot(dx, dy);
    if (length < 0.01) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      for (const [key, value] of Object.entries({
        cx: anchor[0],
        cy: anchor[1],
        r: 3,
        stroke: color,
        fill: '#eaf0f2',
        'stroke-width': 1.5,
      }))
        circle.setAttribute(key, String(value));
      root.append(circle);
      continue;
    }
    const u = [dx / length, dy / length],
      end = anchor.map((v, i) => v + u[i] * 25),
      back = end.map((v, i) => v - u[i] * 6);
    line(anchor, end, color);
    line(end, [back[0] - u[1] * 3, back[1] + u[0] * 3], color);
    line(end, [back[0] + u[1] * 3, back[1] - u[0] * 3], color);
  }
}
