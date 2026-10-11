import { hatchSegments, materialHatch } from './material-hatch.js';
export function appendMaterialHatch(root, surfaces, project, paperUnit = 1) {
  for (const { contours, material } of surfaces || []) {
    const hatch = materialHatch(material);
    const rings = contours.map((ring) => ring.map((p) => project(p).map((n) => n / paperUnit)));
    const lines = hatchSegments(rings, hatch);
    if (!lines.length) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('data-material-hatch', material?.id || 'material');
    path.setAttribute(
      'd',
      lines
        .map(([a, b]) => `M${a.map((n) => n * paperUnit)}L${b.map((n) => n * paperUnit)}`)
        .join(''),
    );
    path.setAttribute('stroke', '#53666d');
    path.setAttribute('stroke-width', hatch.lineWidth * paperUnit);
    path.setAttribute('fill', 'none');
    path.setAttribute('pointer-events', 'none');
    root.append(path);
  }
}
