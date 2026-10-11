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
    opacity: '.65',
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
      node.setAttribute('stroke', '#28946d');
    if (node.getAttribute('fill') && !['none', 'transparent'].includes(node.getAttribute('fill')))
      node.setAttribute('fill', ['text', 'tspan'].includes(node.tagName) ? '#28946d' : 'none');
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
  if (!hit || (!editor.mode && !editor.drag)) return;
  const p = project(hit.point, hit.view),
    k = 1 / Math.max(pixelScale, 1e-9),
    r = 5 * k;
  const group = svg('g', {
    'data-annotation-helper': 'feedback',
    'pointer-events': 'none',
    fill: 'none',
    stroke: '#28946d',
    'stroke-width': 1,
    'vector-effect': 'non-scaling-stroke',
  });
  root.append(group);
  const line = (a, b, color = '#a6b3ba', dash = '') =>
    group.append(
      svg('path', {
        d: `M${a}L${b}`,
        stroke: color,
        'stroke-dasharray': dash,
        'vector-effect': 'non-scaling-stroke',
      }),
    );
  const base = (editor.transform?.active() && editor.transform.base) || editor.draft?.points.at(-1);
  if (base) {
    const q = project(base, hit.view);
    line(q, p);
    group.append(
      svg('circle', {
        cx: q[0],
        cy: q[1],
        r: 2.5 * k,
        fill: '#28946d',
        'vector-effect': 'non-scaling-stroke',
      }),
    );
  }
  for (const { anchor } of editor.trackHit?.guides || [])
    line(project(anchor, hit.view), p, '#28946d', `${5 * k} ${4 * k}`);
  for (const anchor of editor.trackHit?.anchors || []) {
    const q = project(anchor, hit.view);
    line([q[0] - 3 * k, q[1]], [q[0] + 3 * k, q[1]], '#28946d');
    line([q[0], q[1] - 3 * k], [q[0], q[1] + 3 * k], '#28946d');
  }
  if (hit.guideBase) line(project(hit.guideBase, hit.view), p, '#bc873b', `${5 * k} ${4 * k}`);
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
  const attrs = { 'vector-effect': 'non-scaling-stroke', fill: 'white', stroke: '#28946d' };
  if (kind === 'Mittpunkt')
    group.append(
      svg('path', {
        ...attrs,
        d: `M${p[0]},${p[1] - r}L${p[0] + r},${p[1] + r}L${p[0] - r},${p[1] + r}Z`,
      }),
    );
  else if (kind === 'Centrum') group.append(svg('circle', { ...attrs, cx: p[0], cy: p[1], r }));
  else if (['Korsning', 'Skärning'].includes(kind)) {
    line([p[0] - r, p[1] - r], [p[0] + r, p[1] + r], '#28946d');
    line([p[0] - r, p[1] + r], [p[0] + r, p[1] - r], '#28946d');
  } else if (kind === 'Vinkelrät')
    group.append(
      svg('path', {
        ...attrs,
        fill: 'none',
        d: `M${p[0] - r},${p[1] - r}v${2 * r}h${2 * r}M${p[0] - r},${p[1]}h${r}v${r}`,
      }),
    );
  else if (kind === 'Kvadrant')
    group.append(
      svg('path', { ...attrs, d: `M${p[0]},${p[1] - r}l${r},${r}l${-r},${r}l${-r},${-r}Z` }),
    );
  else if (hit.snapped)
    group.append(svg('rect', { ...attrs, x: p[0] - r, y: p[1] - r, width: 2 * r, height: 2 * r }));
  const text = svg('text', {
    x: p[0] + 10 * k,
    y: p[1] - 10 * k,
    fill: '#52666f',
    stroke: 'white',
    'stroke-width': 3 * k,
    'paint-order': 'stroke',
    'font-size': 11 * k,
    'font-family': 'Arial',
  });
  text.textContent = kind === 'Korsning' ? 'Skärning' : kind;
  group.append(text);
}
