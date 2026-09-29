import { DrawingToolFeedback } from './drawing-tool-feedback.js';
import { createSectionView } from './drawing-sections.js';
import { extentGeometry, resizeSectionExtent } from './section-extents.js';
import { actionButton } from './drawing-toolbar.js';
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
};
export class DrawingSectionTool {
  constructor({ dialog, workspace, toolbar, inspector, adapter }) {
    Object.assign(this, { dialog, workspace, adapter });
    this.feedback = new DrawingToolFeedback(this, workspace, 'section');
    const button = actionButton(document.createElement('button'), 'section', 'Skapa snitt');
    button.onclick = () => {
      adapter.cancel();
      this.draft = { points: [] };
      this.hint();
    };
    toolbar.append(button);
    this.panel = document.createElement('section');
    this.panel.className = 'section-view-properties';
    this.panel.hidden = true;
    this.panel.innerHTML =
      '<h3>Snittvy</h3><label>Snittdjup · mm<input type="number" min="0.1" step="any" aria-label="Snittdjup"></label><button type="button">Vänd snittriktning</button>';
    const sheet = inspector.querySelector('details');
    if (sheet && sheet.parentElement === inspector) inspector.insertBefore(this.panel, sheet);
    else inspector.append(this.panel);
    this.depth = this.panel.querySelector('input');
    const widthLabel = document.createElement('label');
    widthLabel.textContent = 'Snittutbredning · mm';
    this.width = document.createElement('input');
    this.width.type = 'number';
    this.width.min = '0.1';
    this.width.step = 'any';
    widthLabel.append(this.width);
    this.panel.append(widthLabel);
    this.width.onchange = () => {
      const view = this.selectedSection(),
        length = Number(this.width.value);
      if (!view?.section || !Number.isFinite(length) || length < 0.1) return;
      const { axis } = extentGeometry(view.section);
      view.section.points[1] = view.section.points[0].map((n, i) => n + axis[i] * length);
      this.adapter.update(view);
    };
    this.depth.onchange = () => {
      const v = Number(this.depth.value),
        section = this.selectedSection();
      if (section?.section && v > 0 && Number.isFinite(v)) {
        section.section.depth = v;
        adapter.update(section);
      }
    };
    this.panel.querySelector('button').onclick = () => {
      const section = this.selectedSection();
      if (section?.section) {
        section.section.side *= -1;
        adapter.update(section);
      }
    };
    workspace.addEventListener('pointerdown', (e) => this.down(e), true);
    workspace.addEventListener(
      'pointermove',
      (e) => {
        this.feedback.move(e);
      },
      true,
    );
    for (const type of ['pointerup'])
      workspace.addEventListener(
        type,
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
  sync() {
    const selected = this.selectedSection();
    this.panel.hidden = !selected?.section;
    if (selected?.section) this.depth.value = selected.section.depth;
    if (selected?.section) this.width.value = extentGeometry(selected.section).length;
  }
  selectedSection() {
    return (
      this.adapter.views().find((v) => v.id === this.selectedMarker) || this.adapter.selected()
    );
  }
  hint(error) {
    this.feedback.cursor();
    if (error) this.dialog.querySelector('.annotation-hint').textContent = error;
  }
  down(e) {
    if (e.button !== 0) return;
    if (this.feedback.select(e)) return;
    const handle = e.target.closest('[data-section-endpoint],[data-section-extent]');
    if (!this.draft && !handle) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.consumeUp = true;
    if (handle && !this.draft) {
      const section = this.adapter.views().find((v) => v.id === handle.dataset.sectionId);
      if (!section) return;
      this.adapter.cancel();
      this.draft = {
        edit: section.id,
        index: Number(handle.dataset.sectionEndpoint),
        parentId: section.source.parentViewId,
        points: structuredClone(section.section.points),
        extent: handle.dataset.sectionExtent,
        section: structuredClone(section.section),
      };
      this.hint();
      return;
    }
    const d = this.draft;
    if (d.points.length === 2 && d.side && !d.edit) {
      const parent = this.adapter.views().find((v) => v.id === d.parentId),
        view = createSectionView(
          parent,
          d.points,
          d.side,
          this.adapter.paperPoint(e),
          this.adapter.namingViews?.() || this.adapter.views(),
        );
      this.cancel();
      this.adapter.commit(view);
      return;
    }
    const hit = this.feedback.locate(e);
    if (!hit) return;
    if (d.edit) {
      if (d.extent) {
        const view = this.adapter.views().find((v) => v.id === d.edit);
        view.section = resizeSectionExtent(d.section, d.extent, hit.point);
        this.cancel();
        this.adapter.update(view);
        return;
      }
      const section = this.adapter.views().find((v) => v.id === d.edit),
        other = section.section.points[1 - d.index];
      if (Math.hypot(hit.point[0] - other[0], hit.point[1] - other[1]) < 0.01) return;
      section.section.points[d.index] = hit.point;
      this.cancel();
      this.adapter.update(section);
      return;
    }
    if (!d.points.length) {
      d.parentId = hit.view;
      d.points.push(hit.point);
    } else if (d.points.length === 1) {
      if (Math.hypot(hit.point[0] - d.points[0][0], hit.point[1] - d.points[0][1]) < 0.01) return;
      d.points.push(hit.point);
    } else {
      const [a, b] = d.points,
        cross = (b[0] - a[0]) * (hit.point[1] - a[1]) - (b[1] - a[1]) * (hit.point[0] - a[0]);
      if (Math.abs(cross) < 0.01) return;
      d.side = cross > 0 ? 1 : -1;
    }
    this.hint();
    this.adapter.redraw();
  }
  constrainHit(hit) {
    const d = this.draft;
    if (d?.extent !== 'move') return null;
    const moved = resizeSectionExtent(d.section, 'move', hit.point);
    const point = moved.points[0].map((n, i) => (n + moved.points[1][i]) / 2);
    return {
      ...hit,
      point,
      snapped: !!hit.snapped && Math.hypot(...point.map((n, i) => n - hit.point[i])) < 1e-6,
    };
  }
  paint(root, parentId, project, unit = 1) {
    const entries =
      this.adapter.markers?.(parentId) ||
      this.adapter.views().filter((v) => v.section && v.source.parentViewId === parentId);
    for (const section of entries) {
      const source = this.adapter.views().find((v) => v.id === section.id);
      const preview =
        this.draft?.edit === section.id && this.draft.extent && this.hover
          ? resizeSectionExtent(this.draft.section, this.draft.extent, this.hover)
          : { ...source?.section, ...section.section };
      this.line(
        root,
        preview.points,
        preview.side,
        section.section.label,
        project,
        unit,
        section.id,
      );
      if (
        section.id &&
        (this.selectedMarker === section.id ||
          this.adapter.selected()?.id === section.id ||
          this.draft?.edit === section.id)
      ) {
        this.extents(root, preview, project, unit, section.id);
      }
    }
    this.feedback.paint(root, parentId, project, unit);
    const d = this.draft;
    if (d?.parentId === parentId && !d.extent) {
      const points = d.edit
        ? d.points.map((p, i) => (i === d.index && this.hover ? this.hover : p))
        : d.points.length === 1 && this.hover
          ? [d.points[0], this.hover]
          : d.points;
      if (points.length === 2)
        this.line(
          root,
          points,
          d.side ||
            (this.hover &&
            (points[1][0] - points[0][0]) * (this.hover[1] - points[0][1]) -
              (points[1][1] - points[0][1]) * (this.hover[0] - points[0][0]) <
              0
              ? -1
              : 1),
          '',
          project,
          unit,
        );
    }
  }
  extents(root, section, project, u, id) {
    const { rear, handles } = extentGeometry(section);
    handles.push(section.points[0].map((n, i) => (n + section.points[1][i]) / 2));
    const points = [section.points[0], rear[0], rear[1], section.points[1]].map(project);
    const group = svg('g', { 'data-section-marker': id, class: 'section-extent-guides' });
    group.append(
      svg('path', {
        d: `M${points.join('L')}`,
        fill: 'none',
        stroke: '#32937d',
        'stroke-width': 1,
        'stroke-dasharray': '5 4',
        'vector-effect': 'non-scaling-stroke',
        'pointer-events': 'none',
      }),
    );
    for (const [i, p] of handles.map(project).entries())
      group.append(
        svg('rect', {
          'data-section-id': id,
          'data-section-extent': ['start', 'end', 'depth', 'move'][i],
          x: p[0] - 2 * u,
          y: p[1] - 2 * u,
          width: 4 * u,
          height: 4 * u,
          fill: i === 3 ? '#d7eee4' : 'white',
          stroke: '#32937d',
          'stroke-width': 1,
          'vector-effect': 'non-scaling-stroke',
          cursor: 'move',
          'aria-label': [
            'Ändra snittets början',
            'Ändra snittets slut',
            'Ändra snittdjup',
            'Flytta hela snittet i pilarnas riktning',
          ][i],
        }),
      );
    root.append(group);
  }
  line(root, points, side, label, project, u, id) {
    const a = project(points[0]),
      b = project(points[1]),
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy) || 1,
      n = [(dy / len) * side, (-dx / len) * side],
      group = svg('g', { class: 'section-marker' });
    if (id) {
      group.setAttribute('data-section-marker', id);
      group.append(
        svg('path', {
          d: `M${a}L${b}`,
          stroke: 'transparent',
          'stroke-width': 12,
          'vector-effect': 'non-scaling-stroke',
          'pointer-events': 'stroke',
          cursor: 'pointer',
        }),
      );
    }
    group.append(
      svg('path', {
        d: `M${a}L${b}`,
        fill: 'none',
        stroke: '#466b83',
        'stroke-width': 0.35 * u,
        'stroke-dasharray': `${3 * u} ${u}`,
      }),
    );
    for (const [index, p] of [a, b].entries()) {
      const tip = [p[0] + n[0] * 7 * u, p[1] + n[1] * 7 * u],
        t = [dx / len, dy / len];
      group.append(
        svg('path', {
          d: `M${p}L${tip}m${-n[0] * 2 * u + t[0] * u},${-n[1] * 2 * u + t[1] * u}L${tip}l${-n[0] * 2 * u - t[0] * u},${-n[1] * 2 * u - t[1] * u}`,
          fill: 'none',
          stroke: '#466b83',
          'stroke-width': 0.35 * u,
        }),
      );
      if (label)
        group.append(
          svg(
            'text',
            { x: tip[0] + 2 * u, y: tip[1] - u, 'font-size': 3 * u, fill: '#466b83' },
            label,
          ),
        );
      if (id && this.selectedMarker === id)
        group.append(
          svg('rect', {
            'data-section-id': id,
            'data-section-endpoint': index,
            x: p[0] - 1.5 * u,
            y: p[1] - 1.5 * u,
            width: 3 * u,
            height: 3 * u,
            fill: 'white',
            stroke: '#466b83',
            'stroke-width': 0.3 * u,
            'pointer-events': 'all',
            cursor: 'move',
          }),
        );
    }
    root.append(group);
  }
}
