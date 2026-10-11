import { createHatchControl as createControl } from './ui/hatch-control.js';
import { HATCH_PATTERNS, hatchSegments, validateHatch } from './material-hatch.js';

export function createHatchControl(options) {
  const entries = HATCH_PATTERNS.map(([value, label]) => ({
    value,
    label,
    preview: () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 12 8');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute(
        'd',
        hatchSegments(
          [
            [
              [0, 0],
              [12, 0],
              [12, 8],
              [0, 8],
            ],
          ],
          {
            pattern: value,
            angle: value === 'diagonal' || value === 'cross' ? 45 : 0,
            spacing: 2.5,
            lineWidth: 0.18,
          },
        )
          .map(([a, b]) => `M${a}L${b}`)
          .join(''),
      );
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '.18');
      svg.append(path);
      return svg;
    },
  }));
  return createControl({ ...options, entries, validate: validateHatch });
}
