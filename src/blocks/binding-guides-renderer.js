import * as THREE from 'three';
import { pointBindingGuides } from './point-bindings.js';
/** Displays the actual offset. Zero offset stays on its real plane. */
export function renderBindingGuides(definition, result, points, referenceId, { group, svg, node }) {
  const entries = [],
    seen = new Set();
  for (const guide of pointBindingGuides(definition, result, [...points], referenceId)) {
    const { from, to, reference, offset, expression } = guide;
    const key = JSON.stringify([from, to, reference.id, expression]);
    if (seen.has(key)) continue;
    seen.add(key);
    const text = `${['X', 'Y', 'Z'][reference.axis]} · ${reference.name} · offset ${expression} (${Math.round(offset * 1000) / 1000} mm)`;
    const position = from.map((v, i) => (v + to[i]) / 2);
    if (group && Math.abs(offset) > 1e-7) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([from, to].map((p) => new THREE.Vector3(...p))),
        new THREE.LineDashedMaterial({
          color: '#e89a30',
          dashSize: 20,
          gapSize: 12,
          depthTest: false,
        }),
      );
      line.computeLineDistances();
      group.add(line);
    }
    if (svg && Math.abs(offset) > 1e-7)
      svg.append(
        node('line', {
          x1: from[0],
          y1: -from[1],
          x2: to[0],
          y2: -to[1],
          stroke: '#e89a30',
          'stroke-width': 1.5,
          'vector-effect': 'non-scaling-stroke',
          'stroke-dasharray': '5 3',
        }),
      );
    entries.push({ text, position });
  }
  return entries;
}
