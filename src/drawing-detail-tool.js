import { createSvgGrip, screenGripScale } from './ui/grip.js';
import { DrawingToolFeedback } from './drawing-tool-feedback.js';
import { createDetailView } from './drawing-details.js';
import { actionButton } from './drawing-toolbar.js';
const ns = 'http://www.w3.org/2000/svg';
function node(tag, attrs, text) {
  const n = document.createElementNS(ns, tag);
  for (const [key, v] of Object.entries(attrs)) n.setAttribute(key, v);
  if (text) n.textContent = text;
  return n;
}
export class DrawingDetailTool {
  constructor({ dialog, workspace, toolbar, adapter }) {
    Object.assign(this, { dialog, workspace, adapter });
    this.feedback = new DrawingToolFeedback(this, workspace, 'detail');
    const button = actionButton(document.createElement('button'), 'detail', 'Skapa detalj');
    button.onclick = () => {
      adapter.cancel();
      this.draft = { points: [] };
      this.hint();
    };
    toolbar.append(button);
    workspace.addEventListener('pointerdown', (e) => this.down(e), true);
    workspace.addEventListener(
      'pointermove',
      (e) => {
        this.feedback.move(e);
      },
      true,
    );
    workspace.addEventListener(
      'pointerup',
      (e) => {
        if (this.consumeUp && e.button === 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.consumeUp = false;
        }
      },
      true,
    );
    dialog.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.draft) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.cancel();
          adapter.redraw();
        }
      },
      true,
    );
    dialog.addEventListener('close', () => this.cancel());
  }
  cancel() {
    this.feedback.cancel();
    this.draft = null;
    this.hover = null;
    const hint = this.dialog.querySelector('.annotation-hint');
    if (hint) hint.textContent = 'Redo';
  }
  hint(error) {
    this.feedback.cursor();
    if (error) this.dialog.querySelector('.annotation-hint').textContent = error;
  }
  down(e) {
    if (e.button !== 0) return;
    if (this.feedback.select(e)) return;
    if (!this.draft) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.consumeUp = true;
    try {
      const d = this.draft;
      if (!d.edit && d.points.length === 2) {
        const parent = this.adapter.views().find((v) => v.id === d.parentId),
          view = createDetailView(
            parent,
            d.points,
            this.adapter.paperPoint(e),
            this.adapter.namingViews?.() || this.adapter.views(),
          );
        this.cancel();
        this.adapter.commit(view);
        return;
      }
      const hit = this.feedback.locate(e);
      if (!hit) return;
      if (!d.points.length) {
        d.parentId = hit.view;
        d.points.push(hit.point);
      } else {
        createDetailView(
          this.adapter.views().find((v) => v.id === d.parentId),
          [d.points[0], hit.point],
          [0, 0],
          this.adapter.views(),
        );
        d.points.push(hit.point);
      }
      this.hint();
      this.adapter.redraw();
    } catch (error) {
      this.hint(error.message);
    }
  }
  paint(root, parentId, project, unit = 1) {
    for (const v of this.adapter.markers?.(parentId) ||
      this.adapter.views().filter((v) => v.detail && v.source.parentViewId === parentId))
      this.box(root, v.detail.points, project, unit, v.detail.label, v.id);
    this.feedback.paint(root, parentId, project, unit);
    const d = this.draft;
    if (d?.parentId !== parentId) return;
    const points = d.edit
      ? d.points.map((p, i) => (i === d.index && this.hover ? this.hover : p))
      : [d.points[0], d.points[1] || this.hover];
    if (points.every(Boolean)) this.box(root, points, project, unit, '');
  }
  box(root, points, project, u, label, id) {
    const [a, b] = points.map(project),
      x = Math.min(a[0], b[0]),
      y = Math.min(a[1], b[1]),
      g = node('g', { class: 'detail-marker' });
    if (id) {
      g.setAttribute('data-detail-marker', id);
      g.append(
        node('rect', {
          x,
          y,
          width: Math.abs(a[0] - b[0]),
          height: Math.abs(a[1] - b[1]),
          fill: 'none',
          stroke: 'transparent',
          'stroke-width': 12,
          'vector-effect': 'non-scaling-stroke',
          'pointer-events': 'stroke',
          cursor: 'pointer',
        }),
      );
    }
    g.append(
      node('rect', {
        x,
        y,
        width: Math.abs(a[0] - b[0]),
        height: Math.abs(a[1] - b[1]),
        fill: 'none',
        stroke: '#466b83',
        'stroke-width': 0.3 * u,
        'stroke-dasharray': `${2 * u} ${u}`,
        'pointer-events': 'none',
      }),
    );
    if (label)
      g.append(
        node(
          'text',
          { x, y: y - 2 * u, 'font-size': 3 * u, fill: '#466b83', 'pointer-events': 'none' },
          'Detalj ' + label,
        ),
      );
    if (id && this.selectedMarker === id)
      for (const [index, p] of [a, b].entries())
        g.append(
          createSvgGrip({
            point: p,
            zoom: screenGripScale(root),
            key: `detail:${id}:${index}`,
            label: 'Ändra detaljgräns',
            attrs: { 'data-detail-id': id, 'data-detail-corner': index },
          }),
        );
    root.append(g);
  }
}
