import { cadFeedback, paintCadGuide } from './cad-feedback.js';
const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs) => {
  const result = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) result.setAttribute(key, value);
  return result;
};

/** Shared SVG presentation with constant screen dimensions and no pointer interception. */
export function paintAxisFeedback(root, feedback) {
  root.replaceChildren();
  if (!feedback) return;
  const role = feedback.axis ? `axis${feedback.axis}` : 'polar';
  const color = cadFeedback[role];
  paintCadGuide(root, feedback.a, feedback.end, { role, dashed: true });
  if (!feedback.axis) return;
  if (feedback.corner)
    root.append(
      node('path', {
        d: `M${feedback.corner.map((p) => p.join(',')).join('L')}`,
        stroke: color,
        fill: 'none',
        'stroke-width': 1.5,
      }),
    );
  const [x, y] = feedback.b;
  root.append(
    node('rect', {
      x: x + 12,
      y: y - 27,
      width: 21,
      height: 21,
      rx: 3,
      fill: '#ffffffed',
      stroke: color,
    }),
  );
  const text = node('text', {
    x: x + 22.5,
    y: y - 12,
    fill: color,
    'font-size': 12,
    'font-family': 'Arial',
    'font-weight': 600,
    'text-anchor': 'middle',
  });
  text.textContent = feedback.axis;
  root.append(text);
}
