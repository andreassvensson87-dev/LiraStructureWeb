import { actionMenu, actionButton } from './drawing-toolbar.js';
import { createStandardPartView, standardPartViews } from './part-standard-view.js';
import { sectionVectors } from './drawing-sections.js';
import { appendVectorDrawing } from './drawing-vector.js';

export class PartViewTool {
  constructor(editor, toolbar) {
    this.e = editor;
    this.preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.preview.style.cssText =
      'position:absolute;pointer-events:none;z-index:20;background:#ffffffdd;border:1px solid #32937d;display:none';
    editor.workspace.append(this.preview);
    const menu = actionMenu(toolbar, {
      label: 'Lägg till vy',
      iconName: 'plus',
      items: Object.entries(standardPartViews).map(([key, label]) => {
        const button = actionButton(document.createElement('button'), 'page', label);
        button.onclick = () => this.start(key);
        return button;
      }),
    });
    editor.$('layout').after(menu);
    editor.workspace.addEventListener(
      'pointermove',
      (event) => {
        if (!this.pending) return;
        const [x, y] = this.point(event),
          view = this.pending;
        view.position = [x, y];
        const paper = editor.svg.getBoundingClientRect(),
          workspace = editor.workspace.getBoundingClientRect();
        const zoom = paper.width / editor.paper[0];
        Object.assign(this.preview.style, {
          display: 'block',
          left: event.clientX - workspace.left + editor.workspace.scrollLeft + 'px',
          top: event.clientY - workspace.top + editor.workspace.scrollTop + 'px',
          width: view.size[0] * zoom + 'px',
          height: view.size[1] * zoom + 'px',
        });
      },
      true,
    );
    editor.dialog.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.pending || event.button !== 0 || !editor.workspace.contains(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const view = this.pending;
        view.position = this.point(event);
        this.cancel();
        this.consumeUp = true;
        editor.extraSections.commit(view);
      },
      true,
    );
    editor.dialog.addEventListener(
      'pointerup',
      (event) => {
        if (!this.consumeUp || event.button !== 0) return;
        this.consumeUp = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
    editor.dialog.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || !this.pending) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.cancel();
      },
      true,
    );
    editor.dialog.addEventListener('close', () => this.cancel());
  }
  point(event) {
    const r = this.e.svg.getBoundingClientRect();
    return [
      ((event.clientX - r.left) * this.e.paper[0]) / r.width,
      ((event.clientY - r.top) * this.e.paper[1]) / r.height,
    ];
  }
  start(projection) {
    const e = this.e;
    e.cancelInteraction();
    const scale = e.config.views.find((v) => v.id === e.selectedView)?.scale || 10;
    this.pending = createStandardPartView(projection, e.bounds, scale, e.record.sourceId);
    this.pending.settings.hiddenLines = e.record.drawingPreset?.hiddenLines ?? true;
    const view = this.pending,
      [w, h] = view.size;
    this.preview.replaceChildren();
    this.preview.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const vectors = sectionVectors(e.geometry, e.extraSections.frame(view), null);
    appendVectorDrawing(
      this.preview,
      vectors,
      (p) => [
        w / 2 + (p[0] - view.camera.center[0]) / scale,
        h / 2 - (p[1] - view.camera.center[1]) / scale,
      ],
      { hidden: true },
    );
    e.workspace.classList.add('drawing-place-mode');
  }
  cancel() {
    this.pending = null;
    this.preview.style.display = 'none';
    this.e.workspace.classList.remove('drawing-place-mode');
  }
}
