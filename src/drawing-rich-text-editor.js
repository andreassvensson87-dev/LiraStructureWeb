import { readRichText } from './drawing-rich-text-content.js';
import { renderRichTextInspector } from './drawing-rich-text-inspector.js';
import { paintDrawingText } from './drawing-rich-text-renderer.js';
import {
  createDrawingPreview,
  tintDrawingPreview,
  paintDrawingOverlay,
} from './drawing-overlay.js';
import { installDrawingOrder } from './drawing-object-inspector.js';
import { newDrawingText, layoutDrawingText } from './drawing-rich-text.js';
import { actionButton } from './drawing-toolbar.js';
import { drawingFont, drawingFonts } from './drawing-preferences.js';
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (attrs['font-family']) node.style.fontFamily = attrs['font-family'];
  if (text !== undefined) node.textContent = text;
  return node;
};

// Only text and explicit formatting are saved; pasted markup is never persisted.

export class DrawingRichTextEditor {
  constructor(editor, toolbar) {
    this.e = editor;
    this.paper = editor.adapter.paper;
    if (this.paper.tagName.toLowerCase() !== 'svg') {
      this.backPaper = svg('svg', { class: 'drawing-paper-back' });
      this.paper.prepend(this.backPaper);
    }
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    const button = actionButton(document.createElement('button'), 'text', 'Text');
    button.dataset.drawingGroup = 'notes';
    button.dataset.annotationMode = 'richtext';
    button.onclick = () => {
      this.cancel();
      editor.start('richtext');
    };
    toolbar.append(button);
    editor.toolButtons.push(button);
    this.box = document.createElement('div');
    this.box.className = 'drawing-rich-editor';
    this.box.hidden = true;
    this.tools = document.createElement('div');
    this.tools.className = 'drawing-rich-tools';
    this.tools.setAttribute('role', 'toolbar');
    this.tools.setAttribute('aria-label', 'Textformatering');
    this.content = document.createElement('div');
    this.content.contentEditable = 'true';
    this.content.className = 'drawing-rich-content';
    this.content.setAttribute('role', 'textbox');
    this.content.setAttribute('aria-label', 'Ritningstext');
    this.content.setAttribute('aria-multiline', 'true');
    this.box.append(this.tools, this.content);
    editor.overlayHost.append(this.box);
    for (const [label, text, command] of [
      ['Fet', 'B', 'bold'],
      ['Kursiv', 'I', 'italic'],
      ['Understruken', 'U', 'underline'],
      ['Vänsterjustera', '⇤', 'justifyLeft'],
      ['Centrera', '↔', 'justifyCenter'],
      ['Högerjustera', '⇥', 'justifyRight'],
      ['Punktlista', '•', 'insertUnorderedList'],
      ['Numrerad lista', '1.', 'insertOrderedList'],
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.onpointerdown = (event) => event.preventDefault();
      b.onclick = () => {
        this.content.focus({ preventScroll: true });
        document.execCommand(command);
        this.update();
      };
      this.tools.append(b);
    }
    for (const [label, text, fn] of [
      ['Bekräfta text', '✓', () => this.commit()],
      ['Avbryt textredigering', '×', () => this.cancel()],
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.title = label;
      b.setAttribute('aria-label', label);
      b.onclick = fn;
      this.tools.append(b);
    }
    this.content.oninput = () => this.update();
    this.content.onpaste = (event) => {
      event.preventDefault();
      document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
      this.update();
    };
    this.box.addEventListener(
      'keydown',
      (event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          this.cancel();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          this.commit();
        }
      },
      true,
    );
    this.box.addEventListener('pointerdown', (event) => event.stopPropagation());
    editor.dialog.addEventListener(
      'keydown',
      (event) => {
        if (this.draft && this.box.contains(event.target)) {
          event.stopImmediatePropagation();
          if (event.key === 'Escape') {
            event.preventDefault();
            this.cancel();
          } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.commit();
          }
        } else if (event.key === 'Escape' && this.gesture) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.cancel();
        }
      },
      true,
    );
    this.paper.addEventListener('pointerdown', (event) => this.down(event), true);
    this.paper.addEventListener('pointermove', (event) => this.move(event), true);
    this.paper.addEventListener('pointerup', (event) => this.up(event), true);
    this.paper.addEventListener('pointercancel', () => this.cancel(), true);
    this.paper.addEventListener(
      'dblclick',
      (event) => {
        const target = event.target.closest('[data-rich-text]');
        if (target) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.edit(editor.items.find((item) => item.id === target.dataset.richText));
        }
      },
      true,
    );
    editor.dialog.addEventListener('close', () => {
      this.cancel(false);
      this.graphicsRoot = null;
      this.backPaper?.replaceChildren();
    });
  }
  point(event) {
    const rect = this.paper.getBoundingClientRect(),
      size = this.e.adapter.paperSize();
    return [
      ((event.clientX - rect.left) * size[0]) / rect.width,
      ((event.clientY - rect.top) * size[1]) / rect.height,
    ];
  }
  measure(item, text, run) {
    this.context.font = `${run.italic ? 'italic ' : ''}${run.bold ? 'bold ' : ''}${item.textSize * 10}px ${item.font}`;
    return this.context.measureText(text).width / 10;
  }
  layout(item) {
    return layoutDrawingText(item, (text, run) => this.measure(item, text, run));
  }
  beginGrip(event, node) {
    const item = this.e.items.find(
      (item) => item.id === node.closest('[data-rich-text]').dataset.richText,
    );
    if (!item) return null;
    const before = structuredClone(item),
      history = structuredClone(this.e.items);
    const resize = node.hasAttribute('data-rich-width');
    const angle = ((before.rotation || 0) * Math.PI) / 180,
      along = [Math.cos(angle), Math.sin(angle)];
    this.e.selected = item.id;
    this.e.selectedIds = new Set([item.id]);
    this.e.ui();
    const session = {
      label: resize ? 'Ändra textbredden' : 'Flytta texten',
      base: before.points[0],
      locate: (event) => this.e.location(event, 'paper', true, item.id),
      apply: (hit) => {
        if (resize)
          item.width = Math.max(
            10,
            hit.point.reduce((sum, v, i) => sum + (v - before.points[0][i]) * along[i], 0),
          );
        else item.points = [[...hit.point]];
      },
      preview: () => this.paint(this.graphicsRoot),
      commit: () => {
        if (JSON.stringify(item) !== JSON.stringify(before)) {
          this.e.history.push(history);
          this.e.future = [];
        }
      },
      cancel: () => Object.assign(item, before),
    };
    if (resize)
      session.numeric = {
        label: 'Textbredd · mm',
        hit: (value) => {
          if (value < 10) throw Error('Textbredden måste vara minst 10 mm.');
          return { point: before.points[0].map((v, i) => v + along[i] * value) };
        },
      };
    return session;
  }
  down(event) {
    if (event.button !== 0) return;
    if (this.e.mode && this.e.mode !== 'richtext') {
      if (
        event.target.closest('[data-rich-text]') ||
        (this.e.transform?.active() && this.e.transform.view === 'paper')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.e.down(event);
      }
      return;
    }
    const target = event.target.closest('[data-rich-text]');
    if (target && event.shiftKey && !this.e.mode) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.e.down(event);
      return;
    }
    if (!target && this.e.mode !== 'richtext') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.draft) return;
    const point = this.point(event),
      item = target && this.e.items.find((item) => item.id === target.dataset.richText);
    if (item) {
      this.e.selected = item.id;
      this.e.selectedIds = new Set([item.id]);
      this.e.mode = null;
      this.gesture = {
        id: event.pointerId,
        start: point,
        item,
        before: structuredClone(item),
        history: structuredClone(this.e.items),
        resize: !!event.target.closest('[data-rich-width]'),
      };
    } else {
      this.gesture = {
        id: event.pointerId,
        start: point,
        create: true,
        item: newDrawingText(point),
      };
      this.gesture.item.font = drawingFonts.find(
        ([, value]) => value === drawingFont(this.e.record),
      )[0];
    }
    this.paper.setPointerCapture(event.pointerId);
    this.e.ui();
    this.e.adapter.redraw();
  }
  move(event) {
    if (this.e.transform?.active() && this.e.transform.view === 'paper') {
      event.stopImmediatePropagation();
      this.e.move(event);
      return;
    }
    const gesture = this.gesture;
    if (!gesture || gesture.id !== event.pointerId) return;
    event.stopImmediatePropagation();
    const point = this.point(event);
    let dx = point[0] - gesture.start[0],
      dy = point[1] - gesture.start[1];
    if (gesture.resize && gesture.before.rotation) {
      const angle = (gesture.before.rotation * Math.PI) / 180;
      dx = dx * Math.cos(angle) + dy * Math.sin(angle);
    }
    if (gesture.create) {
      gesture.item.points[0][0] = Math.min(point[0], gesture.start[0]);
      gesture.item.width = Math.max(10, Math.abs(dx));
    } else if (gesture.resize) gesture.item.width = Math.max(10, gesture.before.width + dx);
    else
      gesture.item.points[0] = [gesture.before.points[0][0] + dx, gesture.before.points[0][1] + dy];
    if (!this.graphicsRoot?.isConnected) this.e.adapter.redraw();
    else if (gesture.create) this.paintFeedback();
    else this.paint(this.graphicsRoot);
  }
  up(event) {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.release();
    if (gesture.create) this.edit(gesture.item, true);
    else {
      const changed = JSON.stringify(gesture.before) !== JSON.stringify(gesture.item);
      if (changed) {
        this.e.history.push(gesture.history);
        this.e.future = [];
      }
      if (
        !changed &&
        this.lastClick?.id === gesture.item.id &&
        performance.now() - this.lastClick.time < 450
      ) {
        this.lastClick = null;
        this.edit(gesture.item);
        return;
      }
      this.lastClick = changed ? null : { id: gesture.item.id, time: performance.now() };
      this.e.ui();
      this.e.adapter.redraw();
    }
  }
  release() {
    const gesture = this.gesture;
    this.gesture = null;
    if (gesture && this.paper.hasPointerCapture(gesture.id))
      this.paper.releasePointerCapture(gesture.id);
  }
  edit(item, create = false) {
    this.original = create ? null : item;
    this.fieldSource = structuredClone(item);
    this.draft = structuredClone(item);
    this.e.selected = item.id;
    this.e.mode = 'richtext';
    this.content.replaceChildren();
    for (const paragraph of item.paragraphs) {
      const p = document.createElement(paragraph.list ? 'li' : 'div');
      p.style.textAlign = paragraph.align;
      for (const run of paragraph.runs) {
        const span = document.createElement('span');
        span.textContent = run.text;
        if (run.bold) span.style.fontWeight = '700';
        if (run.italic) span.style.fontStyle = 'italic';
        if (run.underline) span.style.textDecoration = 'underline';
        p.append(span);
      }
      if (!p.textContent) p.append(document.createElement('br'));
      if (paragraph.list) {
        const kind = paragraph.list === 'number' ? 'OL' : 'UL';
        let list = this.content.lastElementChild;
        if (list?.nodeName !== kind) {
          list = document.createElement(kind);
          this.content.append(list);
        }
        list.append(p);
      } else this.content.append(p);
    }
    this.box.hidden = false;
    this.e.ui();
    this.e.adapter.redraw();
    this.position();
    this.content.focus({ preventScroll: true });
  }
  update() {
    if (this.draft) {
      this.draft.paragraphs = readRichText(this.content);
      this.e.adapter.redraw();
      this.position();
    }
  }
  position() {
    if (!this.draft) return;
    const paper = this.paper.getBoundingClientRect(),
      host = this.e.overlayHost.getBoundingClientRect();
    const scale = paper.width / this.e.adapter.paperSize()[0];
    Object.assign(this.box.style, {
      left: paper.left - host.left + this.draft.points[0][0] * scale + 'px',
      top: paper.top - host.top + this.draft.points[0][1] * scale + 'px',
      width: this.draft.width * scale + 'px',
      transform: `rotate(${this.draft.rotation || 0}deg)`,
      transformOrigin: '0 0',
    });
    Object.assign(this.content.style, {
      fontFamily: this.draft.font,
      fontSize: this.draft.textSize * scale + 'px',
      lineHeight: this.draft.lineSpacing,
    });
  }
  commit() {
    if (!this.draft) return;
    this.draft.paragraphs = readRichText(this.content);
    if (!this.draft.paragraphs.some((p) => p.runs.some((r) => r.text.trim()))) {
      this.e.hint.textContent = 'Skriv en text innan du bekräftar.';
      return;
    }
    this.e.checkpoint();
    if (this.original) Object.assign(this.original, this.draft);
    else this.e.items.push(this.draft);
    const id = this.draft.id;
    this.draft = null;
    this.original = null;
    this.box.hidden = true;
    this.e.mode = null;
    this.e.selected = id;
    this.e.selectedIds = new Set([id]);
    this.e.ui();
    this.e.adapter.redraw();
  }
  cancel(redraw = true) {
    if (this.gesture?.before) Object.assign(this.gesture.item, this.gesture.before);
    this.release();
    this.draft = null;
    this.original = null;
    this.box.hidden = true;
    if (this.e.mode === 'richtext') this.e.mode = null;
    if (redraw) {
      this.e.ui();
      this.e.adapter.redraw();
    }
  }
  ui() {
    return renderRichTextInspector({
      item: this.draft || this.e.item(),
      panel: this.e.panel,
      hint: this.e.hint,
      dialog: this.e.dialog,
      draft: this.draft,
      original: this.draft ? this.fieldSource : null,
      content: this.content,
      history: this.e.history,
      future: this.e.future,
      change: (key, value) => {
        if (!this.draft) this.e.checkpoint();
        const item = this.draft || this.e.item();
        item[key] = value;
        this.e.adapter.redraw();
        this.position();
      },
      edit: (item) => this.edit(item),
      remove: () => {
        const item = this.e.item();
        this.e.checkpoint();
        this.e.items.splice(this.e.items.indexOf(item), 1);
        this.e.selected = null;
        this.e.ui();
        this.e.adapter.redraw();
      },
      undo: (redo) => this.e.undo(redo),
      installOrder: (item) =>
        installDrawingOrder(this.e, item, this.draft ? this.fieldSource : item),
    });
  }
  paint(root) {
    const matrix = root.getScreenCTM?.();
    const zoom = matrix ? Math.max(1e-9, Math.hypot(matrix.a, matrix.b)) : 1;
    this.graphicsRoot = root;
    root.querySelectorAll(':scope > .drawing-rich-layer').forEach((node) => node.remove());
    const layer = svg('g', { class: 'drawing-rich-layer' });
    root.append(layer);
    const back = svg('g', { class: 'drawing-rich-layer drawing-rich-back' });
    if (this.backPaper) {
      this.backPaper.setAttribute('viewBox', root.getAttribute('viewBox'));
      this.backPaper.replaceChildren(back);
    } else {
      const boundary = root.querySelector(':scope > [data-paper-boundary]');
      root.insertBefore(back, boundary ? boundary.nextSibling : root.firstChild);
    }
    for (const item of this.e.items.filter((item) => item.type === 'richtext')) {
      if (this.draft?.id === item.id) continue;
      paintDrawingText(
        item.drawOrder === 'back' ? back : layer,
        item,
        this.layout(item),
        item.id === this.e.selected ||
          this.e.selectedIds?.has(item.id) ||
          (this.e.transform?.active() && this.e.transform.ids.includes(item.id)),
        layer,
        zoom,
      );
    }
    this.paintFeedback();
    this.e.blocks?.paintPaper(root, this.backPaper || root);
  }
  paintFeedback() {
    const root = this.graphicsRoot;
    if (!root?.isConnected) return;
    root.querySelector(':scope > .drawing-rich-feedback')?.remove();
    const layer = svg('g', {
      class: 'drawing-rich-feedback',
      'data-annotation-helper': 'rich-feedback',
    });
    root.append(layer);
    if (this.gesture?.create) {
      const item = this.gesture.item,
        [x, y] = item.points[0];
      layer.append(
        svg('rect', {
          x,
          y,
          width: item.width,
          height: item.textSize * item.lineSpacing,
          fill: 'none',
          stroke: '#287c65',
          'stroke-width': 1,
          'vector-effect': 'non-scaling-stroke',
          'data-annotation-helper': '',
        }),
      );
    }
    if (this.e.transform?.active())
      for (const item of this.e.transform.preview().filter((item) => item.type === 'richtext')) {
        const preview = createDrawingPreview(layer);
        paintDrawingText(preview, item, this.layout(item));
        tintDrawingPreview(preview);
      }
    if (this.e.hover?.view === 'paper')
      paintDrawingOverlay(
        layer,
        this.e,
        (p) => p,
        root.getBoundingClientRect().width / this.e.adapter.paperSize()[0],
      );
    this.position();
  }
}
