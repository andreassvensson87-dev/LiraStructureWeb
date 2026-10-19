import {
  cadFeedback,
  paintCadSnap,
  paintCadGuide,
  paintCadNearestEdge,
} from './ui/cad-feedback.js';
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

export function createDrawingPreview(root) {
  const group = svg('g', {
    'data-annotation-helper': 'preview',
    'pointer-events': 'none',
    opacity: cadFeedback.previewOpacity,
  });
  root.append(group);
  return group;
}
export function tintDrawingPreview(root) {
  root.style.pointerEvents = 'none';
  for (const node of root.querySelectorAll('*')) node.style.pointerEvents = 'none';
  root.querySelectorAll('.annotation-hit').forEach((node) => node.remove());
  for (const node of root.querySelectorAll('[stroke],[fill]')) {
    if (
      node.getAttribute('stroke') &&
      !['none', 'transparent', 'white'].includes(node.getAttribute('stroke'))
    )
      node.setAttribute('stroke', cadFeedback.preview);
    if (node.getAttribute('fill') && !['none', 'transparent'].includes(node.getAttribute('fill')))
      node.setAttribute(
        'fill',
        ['text', 'tspan'].includes(node.tagName) ? cadFeedback.preview : 'none',
      );
  }
}

// Rendering only: snap decisions and tool state belong to their controllers.
export function paintDrawingOverlay(
  root,
  editor,
  project = (p, view) => editor.adapter.project(p, view),
  pixelScale = editor.adapter.pixelScale(),
) {
  const hit = editor.hover;
  if (!hit || (!editor.mode && !editor.drag && !editor.grips?.session)) return;
  const p = project(hit.point, hit.view),
    k = 1 / Math.max(pixelScale, 1e-9);
  const group = svg('g', {
    'data-annotation-helper': 'feedback',
    'pointer-events': 'none',
    fill: 'none',
    stroke: cadFeedback.preview,
    'stroke-width': 1,
    'vector-effect': 'non-scaling-stroke',
  });
  root.append(group);
  const line = (a, b, role = 'rubberBand', dashed = false) =>
    paintCadGuide(group, a, b, { role, dashed, pixelScale });
  paintCadNearestEdge(group, hit, (point) => project(point, hit.view));
  const base = (editor.transform?.active() && editor.transform.base) || editor.draft?.points.at(-1);
  if (base) {
    const q = project(base, hit.view);
    line(q, p);
    group.append(
      svg('circle', {
        cx: q[0],
        cy: q[1],
        r: 2.5 * k,
        fill: cadFeedback.preview,
        'vector-effect': 'non-scaling-stroke',
      }),
    );
  }
  for (const { anchor } of editor.trackHit?.guides || [])
    line(project(anchor, hit.view), p, 'tracking', true);
  for (const anchor of editor.trackHit?.anchors || []) {
    const q = project(anchor, hit.view);
    line([q[0] - 3 * k, q[1]], [q[0] + 3 * k, q[1]], 'tracking');
    line([q[0], q[1] - 3 * k], [q[0], q[1] + 3 * k], 'tracking');
  }
  if (hit.guideBase) line(project(hit.guideBase, hit.view), p, 'polar', true);
  line([p[0] - 17 * k, p[1]], [p[0] - 7 * k, p[1]]);
  line([p[0] + 7 * k, p[1]], [p[0] + 17 * k, p[1]]);
  line([p[0], p[1] - 17 * k], [p[0], p[1] - 7 * k]);
  line([p[0], p[1] + 7 * k], [p[0], p[1] + 17 * k]);
  group.append(
    svg('rect', {
      x: p[0] - 2 * k,
      y: p[1] - 2 * k,
      width: 4 * k,
      height: 4 * k,
      stroke: '#80949f',
      'vector-effect': 'non-scaling-stroke',
    }),
  );
  if (!hit.kind && !hit.snapped) return;
  const kind = hit.kind || 'Ändpunkt';
  paintCadSnap(group, p, {
    kind,
    pixelScale,
    marker: !!hit.snapped,
  });
}
