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
  down(event) {
    if (
      !this.enabled ||
      this.editor.mode ||
      event.button !== 0 ||
      !this.surface.contains(event.target)
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.gesture = {
      id: event.pointerId,
      start: [event.clientX, event.clientY],
      additive: event.shiftKey,
      targetId: event.target.closest('[data-annotation]')?.dataset.annotation,
    };
    this.surface.setPointerCapture(event.pointerId);
  }
  move(event) {
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
  up(event, cancelled = false) {
    if (!this.gesture || event.pointerId !== this.gesture.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const gesture = this.gesture,
      end = [event.clientX, event.clientY];
    this.cancel();
    this.enabled = true;
    if (!cancelled) {
      const editor = this.editor;
      const ids =
        Math.hypot(end[0] - gesture.start[0], end[1] - gesture.start[1]) < 5
          ? [gesture.targetId].filter(Boolean)
          : editor.items
              .filter((item) => drawingMarqueeHits(this.contours(item), gesture.start, end))
              .map((item) => item.id);
      editor.selectedIds = new Set(gesture.additive ? [...editor.selectedIds, ...ids] : ids);
      editor.selected = [...editor.selectedIds].at(-1) || null;
      editor.hover = null;
      editor.ui();
      editor.adapter.redraw();
    }
  }
}
