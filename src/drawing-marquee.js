import { withoutDrawingSelection } from './drawing-context-selection.js';
import { viewsInRectangle } from './drawing-views.js';
import { drawingMarqueeHits } from './drawing-selection-geometry.js';
import { actionButton } from './drawing-toolbar.js';

// Owns a pointer gesture and projects the already rendered objects. Selection
// and all subsequent transformations remain with DrawingAnnotations.
export class DrawingMarquee {
  constructor(editor, toolbar) {
    this.editor = editor;
    this.surface = editor.adapter.paper || editor.surface;
    this.enabled = false;
    this.box = document.createElement('div');
    this.box.className = 'selection-box';
    this.box.hidden = true;
    editor.overlayHost.append(this.box);
    const button = actionButton(
      document.createElement('button'),
      'boxSelect',
      'Rektangelmarkering',
    );
    button.dataset.drawingGroup = 'select';
    button.dataset.annotationMode = 'box-select';
    button.onclick = () => this.start();
    toolbar.append(button);
    editor.toolButtons.push(button);
    editor.dialog.addEventListener('pointerdown', (event) => this.down(event), true);
    const root = editor.dialog.ownerDocument;
    root.addEventListener('pointermove', (event) => this.move(event), true);
    root.addEventListener('pointerup', (event) => this.up(event), true);
    root.addEventListener('pointercancel', (event) => this.up(event, true), true);
    root.defaultView?.addEventListener('blur', () => this.cancel());
    editor.dialog.addEventListener('close', () => this.cancel());
  }
  bindViews(adapter) {
    this.views = adapter;
    this.surface = adapter.surface;
    return this;
  }
  snapshot() {
    return structuredClone({
      views: this.views.views(),
      annotations: this.editor.items,
      selectionScope: this.editor.selectionScope?.snapshot(),
      viewIds: [...this.views.ids()],
      annotationIds: [...this.editor.selectedIds],
    });
  }
  apply(state) {
    const update = () => {
      this.views.views().splice(0, this.views.views().length, ...structuredClone(state.views));
      this.editor.items.splice(0, this.editor.items.length, ...structuredClone(state.annotations));
      this.views.changed();
      this.views.change(new Set(state.viewIds));
      this.editor.selectedIds = new Set(state.annotationIds);
      this.editor.selected = state.annotationIds.at(-1) || null;
    };
    if (this.editor.selectionScope) this.editor.selectionScope.run(update);
    else update();
    this.editor.selectionScope?.finishApply(state);
    this.editor.ui();
    this.editor.adapter.redraw();
  }
  async removeSelection(confirmRemoval) {
    const editor = this.editor,
      before = this.snapshot();
    try {
      const after = withoutDrawingSelection(before);
      const count = before.views.length - after.views.length;
      if (count && !(await confirmRemoval(count))) return;
      editor.history.push({
        drawingOperation: true,
        before,
        after,
        apply: (state) => this.apply(state),
      });
      editor.future = [];
      this.apply(after);
    } catch (error) {
      editor.ui(error.message);
    }
  }
  clearViews() {
    if (this.views?.ids()?.size) this.views.change(new Set());
  }
  start() {
    const editor = this.editor,
      selected = editor.selected,
      ids = new Set(editor.selectedIds);
    editor.cancel();
    editor.adapter.cancelTools?.();
    editor.selected = selected;
    editor.selectedIds = ids;
    this.enabled = true;
    editor.ui();
    editor.adapter.redraw();
    editor.surface.setAttribute('tabindex', '-1');
    editor.surface.focus({ preventScroll: true });
  }
  cancel() {
    const gesture = this.gesture;
    this.gesture = null;
    this.enabled = false;
    this.box.hidden = true;
    if (gesture && this.surface.hasPointerCapture?.(gesture.id))
      this.surface.releasePointerCapture(gesture.id);
  }
  routeTransform(event, move = false) {
    if (
      !this.editor.transform?.active() ||
      !this.editor.transform.sheetMode ||
      !this.surface.contains(event.target)
    )
      return false;
    if (!move && event.button !== 0) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (move) this.editor.move(event);
    else this.editor.down(event);
    return true;
  }
  down(event) {
    if (this.routeTransform(event)) return;
    if (
      (!this.enabled && !this.views) ||
      this.editor.mode ||
      event.button !== 0 ||
      !this.surface.contains(event.target) ||
      event.target.closest(
        '.cad-grip,[data-section-marker],[data-detail-marker],input,textarea,[contenteditable="true"]',
      ) ||
      (!this.enabled && this.views?.busy())
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const original = event.shiftKey ? this.editor.selectionScope?.snapshot() : null;
    this.gesture = {
      id: event.pointerId,
      start: [event.clientX, event.clientY],
      additive: event.shiftKey,
      explicit: this.enabled,
      annotationIds: new Set(original?.annotationIds || this.editor.selectedIds),
      viewIds: new Set(original?.viewIds || this.views?.ids() || []),
      targetId: event.target.closest('[data-annotation]')?.dataset.annotation,
    };
    this.surface.setPointerCapture(event.pointerId);
  }
  move(event) {
    if (this.routeTransform(event, true)) return;
    if (!this.gesture || event.pointerId !== this.gesture.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const [x, y] = this.gesture.start,
      rect = this.editor.overlayHost.getBoundingClientRect();
    this.box.hidden = false;
    this.box.classList.toggle('crossing', event.clientX < x);
    Object.assign(this.box.style, {
      left: Math.min(x, event.clientX) - rect.left + this.editor.overlayHost.scrollLeft + 'px',
      top: Math.min(y, event.clientY) - rect.top + this.editor.overlayHost.scrollTop + 'px',
      width: Math.abs(event.clientX - x) + 'px',
      height: Math.abs(event.clientY - y) + 'px',
    });
  }
  contours(item) {
    const groups = [...this.editor.dialog.querySelectorAll('[data-annotation]')].filter(
      (node) => node.dataset.annotation === item.id && !node.closest('[data-annotation-helper]'),
    );
    const contours = [];
    for (const group of groups)
      for (const node of group.querySelectorAll(
        'path,rect,circle,ellipse,line,polyline,polygon,text',
      )) {
        if (node.closest('defs') || node.matches('.annotation-hit')) continue;
        const matrix = node.getScreenCTM?.();
        if (!matrix) continue;
        const screen = (p) => [
          matrix.a * p.x + matrix.c * p.y + matrix.e,
          matrix.b * p.x + matrix.d * p.y + matrix.f,
        ];
        let points;
        if (node.getTotalLength && node.tagName.toLowerCase() !== 'text') {
          const length = node.getTotalLength(),
            scale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
          const steps = Math.min(2048, Math.max(2, Math.ceil((length * scale) / 3)));
          points = Array.from({ length: steps + 1 }, (_, i) =>
            screen(node.getPointAtLength((length * i) / steps)),
          );
        } else {
          const b = node.getBBox();
          points = [
            [b.x, b.y],
            [b.x + b.width, b.y],
            [b.x + b.width, b.y + b.height],
            [b.x, b.y + b.height],
          ].map(([x, y]) => screen({ x, y }));
        }
        const closed =
          ['rect', 'circle', 'ellipse', 'polygon', 'text'].includes(node.tagName.toLowerCase()) ||
          /z\s*$/i.test(node.getAttribute('d') || '');
        if (points.length) contours.push({ points, closed });
      }
    return contours;
  }
  viewAt(event) {
    if (!this.views) return null;
    const rect = this.views.paper.getBoundingClientRect();
    const size = this.views.paperSize();
    const point = [
      ((event.clientX - rect.left) * size[0]) / rect.width,
      ((event.clientY - rect.top) * size[1]) / rect.height,
    ];
    const tolerance = (size[0] / rect.width) * 5;
    const view = this.views
      .views()
      .filter((v) => {
        const [x, y] = v.position,
          [w, h] = v.size;
        return (
          point[0] >= x - tolerance &&
          point[0] <= x + w + tolerance &&
          point[1] >= y - tolerance &&
          point[1] <= y + h + tolerance &&
          Math.min(
            Math.abs(point[0] - x),
            Math.abs(point[0] - x - w),
            Math.abs(point[1] - y),
            Math.abs(point[1] - y - h),
          ) <= tolerance
        );
      })
      .at(-1);
    return view ? { kind: 'view', id: view.id } : null;
  }
  up(event, cancelled = false) {
    if (!this.gesture || event.pointerId !== this.gesture.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const gesture = this.gesture,
      end = [event.clientX, event.clientY];
    this.cancel();
    this.enabled = gesture.explicit;
    if (!cancelled) {
      const editor = this.editor;
      const click = Math.hypot(end[0] - gesture.start[0], end[1] - gesture.start[1]) < 5;
      const ids = click
        ? [gesture.targetId].filter(Boolean)
        : editor.items
            .filter((item) => drawingMarqueeHits(this.contours(item), gesture.start, end))
            .map((item) => item.id);
      if (this.views) {
        const paperPoint = ([x, y]) => {
          const r = this.views.paper.getBoundingClientRect(),
            size = this.views.paperSize();
          return [((x - r.left) * size[0]) / r.width, ((y - r.top) * size[1]) / r.height];
        };
        const a = paperPoint(gesture.start),
          b = paperPoint(end);
        const found = click
          ? gesture.targetId
            ? []
            : [this.viewAt({ clientX: gesture.start[0], clientY: gesture.start[1] })?.id].filter(
                Boolean,
              )
          : viewsInRectangle(this.views.views(), a, b);
        const next = gesture.additive ? new Set(gesture.viewIds) : new Set();
        for (const id of found) {
          if (click && gesture.additive && next.has(id)) next.delete(id);
          else next.add(id);
        }
        const update = () => this.views.change(next);
        if (editor.selectionScope) editor.selectionScope.run(update);
        else update();
      }
      const selected = gesture.additive ? new Set(gesture.annotationIds) : new Set();
      for (const id of ids) {
        if (click && gesture.additive && selected.has(id)) selected.delete(id);
        else selected.add(id);
      }
      this.enabled = gesture.explicit;
      editor.selectedIds = selected;
      editor.selected = [...editor.selectedIds].at(-1) || null;
      editor.hover = null;
      editor.selectionScope?.capture();
      editor.ui();
      editor.adapter.redraw();
    }
  }
}
