const ns = 'http://www.w3.org/2000/svg';
const node = (tag, attrs) => {
  const n = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
export function polarPoint(point, base, step, tolerance) {
  if (!base || !Number.isFinite(step) || step <= 0) return null;
  const dx = point[0] - base[0],
    dy = point[1] - base[1],
    angle = (Math.round(Math.atan2(dy, dx) / ((step * Math.PI) / 180)) * step * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle),
    length = dx * c + dy * s;
  if (length <= tolerance || Math.abs(dx * s - dy * c) > tolerance) return null;
  return [base[0] + length * c, base[1] + length * s];
}
export class DrawingToolFeedback {
  constructor(tool, workspace, type) {
    Object.assign(this, { tool, workspace, type });
    this.ghost = document.createElement('div');
    this.ghost.className = 'drawing-placement-preview';
    this.ghost.hidden = true;
    workspace.append(this.ghost);
    workspace.addEventListener(
      'pointerdown',
      (e) => {
        if (
          e.button !== 0 ||
          tool.draft ||
          !tool.selectedMarker ||
          e.target.closest(`[data-${type}-marker]`)
        )
          return;
        tool.selectedMarker = null;
        tool.sync?.();
        tool.adapter.redraw();
      },
      true,
    );
    workspace.addEventListener('drawing-marker-selected', (e) => {
      if (e.detail !== type) tool.selectedMarker = null;
    });
  }
  cancel() {
    this.tool.selectedMarker = null;
    this.hit = null;
    this.workspace.classList.remove('drawing-point-mode', 'drawing-place-mode');
    this.ghost.hidden = true;
  }
  placing() {
    const d = this.tool.draft;
    return d && !d.edit && d.points.length === 2 && (this.type === 'detail' || d.side);
  }
  cursor() {
    const active = !!this.tool.draft,
      place = !!this.placing();
    this.workspace.classList.toggle('drawing-point-mode', active && !place);
    this.workspace.classList.toggle('drawing-place-mode', place);
    if (!place) this.ghost.hidden = true;
  }
  select(e) {
    const t = this.tool,
      marker = e.target.closest(`[data-${this.type}-marker]`);
    if (t.draft || !marker) return false;
    const handle = e.target.closest(
      '[data-section-endpoint],[data-section-extent],[data-detail-corner]',
    );
    if (handle) return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    t.selectedMarker = marker.getAttribute(`data-${this.type}-marker`);
    t.sync?.();
    this.workspace.dispatchEvent(new CustomEvent('drawing-marker-selected', { detail: this.type }));
    t.adapter.redraw();
    return true;
  }
  locate(e) {
    const t = this.tool,
      d = t.draft,
      hit = t.adapter.locate(e, d?.parentId);
    if (!hit) return null;
    const constrained = t.constrainHit?.(hit);
    if (constrained) return constrained;
    const a = t.adapter.feedback.adapter,
      base = d?.edit ? d.points[1 - d.index] : d?.points.length === 1 ? d.points[0] : null,
      scale = a.pixelScale(),
      p = a.project(hit.point, hit.view),
      q = a.project([hit.point[0] + 1, hit.point[1]], hit.view),
      pixels = Math.hypot(q[0] - p[0], q[1] - p[1]) * scale;
    const step = Number(t.adapter.getSnapSettings?.().polar ?? 45);
    if (!hit.snapped && base) {
      const point = polarPoint(hit.point, base, step, 8 / pixels);
      if (point) {
        hit.point = point;
        hit.polar = true;
        hit.base = base;
      }
    }
    return hit;
  }
  move(e) {
    const t = this.tool;
    if (!t.draft) return;
    this.cursor();
    if (this.placing()) {
      const r = this.workspace.getBoundingClientRect(),
        parent = t.adapter.views().find((v) => v.id === t.draft.parentId);
      let size = [80, 55];
      if (this.type === 'detail' && parent) {
        const [a, b] = t.draft.points;
        size = [
          Math.abs(a[0] - b[0]) / (parent.scale / 2),
          Math.abs(a[1] - b[1]) / (parent.scale / 2),
        ];
      }
      const zoom = t.adapter.feedback.adapter.pixelScale() * t.adapter.feedback.adapter.unit();
      Object.assign(this.ghost.style, {
        left: e.clientX - r.left + this.workspace.scrollLeft + 'px',
        top: e.clientY - r.top + this.workspace.scrollTop + 'px',
        width: size[0] * zoom + 'px',
        height: size[1] * zoom + 'px',
      });
      this.ghost.hidden = false;
      return;
    }
    this.hit = this.locate(e);
    t.hover = this.hit?.point;
    t.adapter.redraw();
  }
  paint(root, parentId, project, u) {
    const hit = this.hit;
    if (!this.tool.draft || !hit || hit.view !== parentId || this.placing()) return;
    const p = project(hit.point),
      g = node('g', { 'pointer-events': 'none', class: 'drawing-point-feedback' }),
      r = 3 * u;
    if (hit.polar) {
      const a = project(hit.base);
      g.append(
        node('path', {
          d: `M${a}L${p}`,
          stroke: '#32937d',
          'stroke-width': 1,
          'stroke-dasharray': '6 4',
          'vector-effect': 'non-scaling-stroke',
        }),
      );
    }
    g.append(
      node('path', {
        d: `M${p[0] - r * 2},${p[1]}h${r * 4}M${p[0]},${p[1] - r * 2}v${r * 4}`,
        stroke: '#456775',
        'stroke-width': 1,
        'vector-effect': 'non-scaling-stroke',
      }),
    );
    if (hit.snapped || hit.polar)
      g.append(
        node(
          hit.snapped ? 'rect' : 'circle',
          hit.snapped
            ? {
                x: p[0] - r,
                y: p[1] - r,
                width: r * 2,
                height: r * 2,
                fill: 'white',
                stroke: '#23977a',
                'stroke-width': 1.5,
                'vector-effect': 'non-scaling-stroke',
              }
            : {
                cx: p[0],
                cy: p[1],
                r,
                fill: 'white',
                stroke: '#23977a',
                'stroke-width': 1.5,
                'vector-effect': 'non-scaling-stroke',
              },
        ),
      );
    root.append(g);
  }
}
