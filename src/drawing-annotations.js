import { actionButton, actionMenu } from './drawing-toolbar.js';
import {
  resolveReference,
  surfaceReference,
  updateAnnotationReferences,
} from './annotation-references.js';
import {
  dimensionAxis,
  chainGeometry,
  insertDimensionPoint,
  moveDimensionPoint,
} from './dimension-chain.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
const names = { horizontal: 'Horisontell', vertical: 'Vertikal', free: 'Fri' };
export class DrawingAnnotations {
  constructor({ dialog, surface, toolbar, adapter }) {
    Object.assign(this, { dialog, surface, adapter });
    this.items = [];
    this.history = [];
    this.future = [];
    this.mode = null;
    this.selected = null;
    const dimensionItems = Object.entries(names).map(([kind, label]) => {
      const button = actionButton(document.createElement('button'), 'dimension', label);
      button.onclick = () => this.start(kind);
      return button;
    });
    const menu = actionMenu(toolbar, {
      label: 'Måttkedja',
      iconName: 'dimension',
      items: dimensionItems,
    });
    toolbar.insertBefore(
      menu,
      toolbar.lastElementChild === menu ? menu.previousElementSibling : toolbar.lastElementChild,
    );
    const leader = actionButton(
      document.createElement('button'),
      'leader',
      adapter.manualLeaders ? 'Leader' : 'Part mark',
    );
    leader.onclick = () => this.start('leader');
    toolbar.insertBefore(leader, menu.nextSibling);
    this.panel = document.createElement('section');
    this.panel.className = 'annotation-inspector';
    dialog.querySelector('.drawing-inspector').prepend(this.panel);
    this.hint = document.createElement('div');
    this.hint.className = 'annotation-hint';
    this.hint.setAttribute('role', 'status');
    const footer = dialog.querySelector('.plan-legend,footer');
    if (footer) {
      // Keep editor warnings in the same fixed command row as tool instructions.
      const messages = [...dialog.querySelectorAll('#plan-error, #sheet-message')];
      for (const message of messages) message.classList.add('drawing-status-message');
      footer.replaceChildren(this.hint, ...messages);
      footer.classList.add('drawing-statusbar');
    } else dialog.append(this.hint);
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'annotation-context-menu';
    this.contextMenu.hidden = true;
    this.contextMenu.setAttribute('role', 'menu');
    dialog.append(this.contextMenu);
    surface.addEventListener('contextmenu', (e) => this.context(e), true);
    dialog.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.contextMenu.contains(e.target)) this.contextMenu.hidden = true;
      },
      true,
    );
    surface.addEventListener('pointerdown', (e) => this.down(e), true);
    surface.addEventListener('pointermove', (e) => this.move(e), true);
    surface.addEventListener('pointerup', (e) => this.up(e), true);
    surface.addEventListener('pointercancel', (e) => this.up(e, true), true);
    surface.addEventListener(
      'lostpointercapture',
      (e) => {
        if (this.drag) this.up(e, true);
      },
      true,
    );
    dialog.addEventListener('keydown', (e) => this.key(e), true);
    dialog.addEventListener('close', () => {
      this.endDrag(true);
      this.mode = null;
      this.draft = null;
      this.selected = null;
    });
    this.ui();
  }
  open(record) {
    this.record = record;
    this.items = record.annotations ??= [];
    this.history = [];
    this.future = [];
    this.mode = null;
    this.draft = null;
    this.selected = null;
    this.hover = null;
    this.ui();
  }
  checkpoint() {
    this.history.push(structuredClone(this.items));
    this.future = [];
  }
  undo(redo = false) {
    const from = redo ? this.future : this.history,
      to = redo ? this.history : this.future;
    if (!from.length) return;
    to.push(structuredClone(this.items));
    this.items = from.pop();
    this.record.annotations = this.items;
    this.cancel();
  }
  cancel() {
    this.contextMenu.hidden = true;
    this.phase = 'points';
    this.mode = null;
    this.draft = null;
    this.hover = null;
    this.ui();
    this.adapter.redraw();
  }
  start(mode) {
    this.selected = null;
    this.mode = mode;
    this.draft = null;
    this.hover = null;
    this.phase = 'points';
    this.ui();
    this.adapter.redraw();
  }
  item() {
    return this.items.find((a) => a.id === this.selected);
  }
  ui(message) {
    this.surface.classList.toggle('annotating', !!this.mode);
    this.panel.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = 'Anteckningar';
    this.panel.append(title);
    const item = this.item();
    this.panel.parentElement.classList.toggle('annotation-focused', !!item);
    const button = (text, fn, disabled = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.disabled = disabled;
      b.onclick = fn;
      this.panel.append(b);
      return b;
    };
    if (item) {
      const status = document.createElement('p');
      status.className = 'annotation-reference-status';
      status.setAttribute('role', 'status');
      this.panel.append(status);
      this.referenceStatus(item);
      title.textContent =
        item.type === 'dimension' ? 'Måttkedja' : item.manual ? 'Leader' : 'Part mark';
      const field = (labelText, key, type, value) => {
        const label = document.createElement('label'),
          input = document.createElement('input');
        label.textContent = labelText;
        input.type = type;
        input.value = value;
        if (type === 'number') {
          input.min = 0.5;
          input.max = 20;
          input.step = 0.5;
        } else {
          input.maxLength = 120;
          input.placeholder = 'Valfri kommentar';
        }
        let recorded = false;
        input.onfocus = () => (recorded = false);
        input.oninput = () => {
          const value = type === 'number' ? Number(input.value) : input.value;
          if (
            type === 'number' &&
            (!input.value.trim() || !Number.isFinite(value) || value < 0.5 || value > 20)
          ) {
            input.setCustomValidity('Ange en textstorlek mellan 0,5 och 20.');
            return;
          }
          input.setCustomValidity('');
          if (!recorded) {
            this.checkpoint();
            recorded = true;
          }
          item[key] = value;
          for (const b of this.panel.querySelectorAll('.annotation-history button'))
            b.disabled = b.textContent === 'Ångra' ? !this.history.length : !this.future.length;
          this.adapter.redraw();
        };
        input.onblur = () => {
          if (!input.checkValidity()) {
            input.value = item[key] ?? value;
            input.setCustomValidity('');
          }
        };
        label.append(input);
        this.panel.append(label);
      };
      field('Kommentar', 'comment', 'text', item.comment || '');
      field(
        'Textstorlek · mm',
        'textSize',
        'number',
        item.textSize ??
          this.record?.drawingPreset?.[item.type === 'leader' ? 'leaderSize' : 'dimensionSize'] ??
          2.5,
      );
      if (item.type === 'dimension') {
        button('Lägg till måttpunkt', () => this.startAdding());
        const details = document.createElement('details');
        details.className = 'annotation-point-details';
        const summary = document.createElement('summary');
        summary.textContent = `Måttpunkter (${item.points.length})`;
        details.append(summary);
        const list = document.createElement('div');
        list.className = 'annotation-points';
        for (const p of chainGeometry(item).points) {
          const row = document.createElement('div'),
            text = document.createElement('span'),
            remove = document.createElement('button');
          text.textContent = `${Math.round(p.point[0])}, ${Math.round(p.point[1])}`;
          remove.textContent = '×';
          remove.title = 'Ta bort måttpunkt';
          remove.setAttribute('aria-label', `Ta bort måttpunkt ${p.index + 1}`);
          remove.disabled = item.points.length <= 2;
          remove.onclick = () => {
            this.checkpoint();
            item.points.splice(p.index, 1);
            item.references?.splice(p.index, 1);
            this.ui();
            this.panel.querySelector('details').open = true;
            this.adapter.redraw();
          };
          row.append(text, remove);
          list.append(row);
        }
        details.append(list);
        this.panel.append(details);
      }
      const remove = button('Ta bort', () => {
        this.checkpoint();
        this.items.splice(this.items.indexOf(item), 1);
        this.selected = null;
        this.cancel();
      });
      remove.className = 'annotation-delete';
    }

    if (this.mode) {
      if (this.draft?.type === 'dimension' && this.phase === 'points')
        button('Placera måttlinje ↵', () => this.finishPoints(), this.draft.points.length < 2);
      button('Avbryt · Esc', () => this.cancel());
    }
    const undo = document.createElement('div');
    undo.className = 'annotation-history';
    for (const [text, redo, disabled] of [
      ['Ångra', false, !this.history.length],
      ['Gör om', true, !this.future.length],
    ]) {
      const b = document.createElement('button');
      b.textContent = text;
      b.disabled = disabled;
      b.onclick = () => this.undo(redo);
      undo.append(b);
    }
    this.panel.append(undo);
    const instructions =
      this.mode === 'leader'
        ? this.draft
          ? 'Klicka för att placera texten.'
          : this.adapter.manualLeaders
            ? 'Klicka för att placera hänvisningens fästpunkt.'
            : 'Klicka på en numrerad detalj.'
        : this.mode === 'add'
          ? 'Klicka på en ny måttpunkt. Esc avslutar.'
          : this.mode === 'move-anchor'
            ? 'Välj ny fästpunkt · klicka för att placera · Esc avbryter.'
            : this.mode === 'place-existing'
              ? 'Klicka för att placera om.'
              : this.mode
                ? this.phase === 'place'
                  ? 'Klicka för att placera måttlinjen.'
                  : `Välj måttpunkter · Enter placerar kedjan · Esc avbryter`
                : '';
    this.hint.textContent = message || instructions || 'Redo';
  }
  finishPoints() {
    if (!this.draft || this.draft.points.length < 2) return;
    try {
      this.draft.axis = dimensionAxis(this.draft.kind, this.draft.points);
      if (chainGeometry({ ...this.draft, line: this.draft.points[0] }).points.length < 2)
        throw Error('Punkterna måste ge ett mått i vald riktning.');
      this.phase = 'place';
      this.ui();
    } catch (e) {
      this.ui(e.message);
    }
  }
  startAdding() {
    if (this.item()?.type !== 'dimension') return;
    this.contextMenu.hidden = true;
    this.mode = 'add';
    this.phase = 'points';
    this.hover = null;
    this.ui();
    this.adapter.redraw();
    this.surface.setAttribute('tabindex', '-1');
    this.surface.focus({ preventScroll: true });
  }
  context(e) {
    const target = e.target.closest('[data-annotation]');
    if (!target) {
      this.contextMenu.hidden = true;
      return;
    }
    const item = this.items.find((a) => a.id === target.dataset.annotation);
    if (item?.type !== 'dimension') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.endDrag(true);
    this.selected = item.id;
    this.mode = null;
    this.hover = null;
    const anchor = e.target.closest('[data-anchor]');
    const index = anchor ? Number(anchor.dataset.anchor) : null;
    this.ui();
    this.adapter.redraw();
    this.contextMenu.replaceChildren();
    const add = (label, fn, disabled = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.textContent = label;
      button.disabled = disabled;
      button.onclick = () => {
        this.contextMenu.hidden = true;
        fn();
      };
      this.contextMenu.append(button);
    };
    add('Lägg till måttpunkt', () => this.startAdding());
    if (index !== null)
      add(
        'Ta bort måttpunkt',
        () => {
          this.checkpoint();
          item.points.splice(index, 1);
          item.references?.splice(index, 1);
          this.ui();
          this.adapter.redraw();
        },
        item.points.length <= 2,
      );
    this.contextMenu.hidden = false;
    const box = this.dialog.getBoundingClientRect();
    this.contextMenu.style.left =
      Math.max(0, Math.min(e.clientX - box.left, box.width - 210)) + 'px';
    this.contextMenu.style.top =
      Math.max(0, Math.min(e.clientY - box.top, box.height - 100)) + 'px';
    this.contextMenu.querySelector('button').focus();
  }
  key(e) {
    if (e.key === 'Escape' && !this.contextMenu.hidden) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.contextMenu.hidden = true;
      return;
    }
    if (this.drag) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.endDrag(true);
      }
      return;
    }
    if (e.key === 'Escape' && (this.mode || this.selected)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.selected = null;
      this.cancel();
      return;
    }
    if (e.target.closest('input,select,textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.undo(e.shiftKey);
      return;
    }
    if (e.key === 'Enter' && this.mode) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.finishPoints();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected && !this.mode) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.checkpoint();
      this.items.splice(this.items.indexOf(this.item()), 1);
      this.selected = null;
      this.cancel();
    }
  }
  location(e, view, snap = true) {
    const hit = this.adapter.locate(e, view);
    if (!hit) return null;
    if (snap) {
      const p = this.adapter.project(hit.point, hit.view);
      let best = 10;
      for (const candidate of this.adapter.candidates(hit.view)) {
        const q = this.adapter.project(candidate, hit.view),
          distance = Math.hypot(q[0] - p[0], q[1] - p[1]) * this.adapter.pixelScale();
        if (distance < best) {
          best = distance;
          hit.point = candidate;
          hit.reference = candidate.reference || null;
          hit.snapped = true;
        }
      }
      if (!hit.snapped && this.adapter.gridSnap) {
        const gridPoint = this.adapter.gridSnap(hit.point);
        if (gridPoint) {
          hit.point = gridPoint;
          hit.reference = this.adapter.gridReference?.(gridPoint) || null;
          hit.snapped = true;
        }
      }
    }
    return hit;
  }
  down(e) {
    if (e.button !== 0) return;
    const target = e.target.closest('[data-annotation]');
    if (!this.mode) {
      if (target) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.selected = target.dataset.annotation;
        const anchor = e.target.closest('[data-anchor]');
        if (anchor) {
          this.anchorIndex = Number(anchor.dataset.anchor);
          this.mode = 'move-anchor';
          this.phase = 'points';
          this.hover = null;
          this.ui();
          this.adapter.redraw();
          return;
        }
        const item = this.item(),
          hit = this.location(e, item.view, false);
        if (hit) {
          this.drag = {
            pointerId: e.pointerId,
            start: hit.point,
            line: [...item.line],
            points: structuredClone(item.points),
            pointIndex: e.target.closest('[data-anchor]')
              ? Number(e.target.closest('[data-anchor]').dataset.anchor)
              : null,
            item,
            x: e.clientX,
            y: e.clientY,
            moved: false,
          };
          this.surface.setPointerCapture(e.pointerId);
        }
        this.ui();
        this.adapter.redraw();
      } else if (this.selected) {
        this.selected = null;
        this.ui();
        this.adapter.redraw();
      }
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    const item = this.item(),
      view = this.draft?.view || item?.view,
      hit = this.location(e, view, this.phase !== 'place' && this.mode !== 'place-existing');
    if (!hit) return;
    if (this.mode === 'add') {
      this.checkpoint();
      if (!insertDimensionPoint(item, hit.point)) {
        this.history.pop();
        this.ui('Den måttpunkten finns redan i kedjan.');
        return;
      }
      item.references ??= Array(item.points.length - 1).fill(null);
      item.references.push(hit.reference || null);
      this.ui();
      this.adapter.redraw();
      return;
    }
    if (this.mode === 'move-anchor') {
      if (!this.validAnchor(item, hit.point)) {
        this.ui('Fästpunkten måste ligga på samma objekt som part mark tillhör.');
        return;
      }
      const next = structuredClone(item);
      if (next.type === 'dimension' && !moveDimensionPoint(next, this.anchorIndex, hit.point)) {
        this.ui('Punkten sammanfaller med ett annat delmått. Välj en annan punkt.');
        return;
      }
      this.checkpoint();
      if (item.type === 'dimension') item.points = next.points;
      else item.points[this.anchorIndex] = [...hit.point];
      item.references ??= Array(item.points.length).fill(null);
      item.references[this.anchorIndex] = this.referenceFor(hit, item.sourceId);
      this.cancel();
      return;
    }
    if (this.mode === 'place-existing') {
      this.checkpoint();
      item.line = hit.point;
      this.cancel();
      return;
    }
    if (this.phase === 'place' || (this.mode === 'leader' && this.draft)) {
      this.checkpoint();
      this.draft.line = hit.point;
      this.items.push(this.draft);
      this.selected = this.draft.id;
      this.cancel();
      return;
    }
    if (this.mode === 'leader' && this.adapter.manualLeaders) {
      this.draft = {
        id: crypto.randomUUID(),
        type: 'leader',
        manual: true,
        comment: '',
        view: hit.view,
        points: [hit.point],
        sourceId: this.adapter.pick(e, hit) || undefined,
        references: [this.referenceFor(hit, this.adapter.pick(e, hit))],
      };
    } else if (this.mode === 'leader') {
      const source = this.adapter.pick(e, hit);
      if (!source || !this.adapter.mark(source)) {
        this.ui('Välj en numrerad detalj. Numrering finns i ritningshanterarens Mer-meny.');
        return;
      }
      this.draft = {
        id: crypto.randomUUID(),
        type: 'leader',
        view: hit.view,
        sourceId: source,
        points: [hit.point],
        references: [this.referenceFor(hit, source)],
      };
    } else if (!this.draft)
      this.draft = {
        id: crypto.randomUUID(),
        type: 'dimension',
        kind: this.mode,
        view: hit.view,
        points: [hit.point],
        references: [hit.reference || null],
      };
    else {
      if (
        this.draft.points.some((p) => Math.hypot(p[0] - hit.point[0], p[1] - hit.point[1]) < 1e-5)
      )
        return;
      this.draft.points.push(hit.point);
      this.draft.references.push(hit.reference || null);
    }
    this.ui();
    this.adapter.redraw();
  }
  endDrag(cancel = false) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (cancel && d.moved) {
      d.item.line = d.line;
      d.item.points = d.points;
    } else if (d.moved) {
      this.history.push(d.before);
      this.future = [];
    }
    if (this.surface.hasPointerCapture(d.pointerId))
      this.surface.releasePointerCapture(d.pointerId);
    this.hover = null;
    this.surface.classList.remove('annotation-dragging');
    this.ui();
    this.adapter.redraw();
  }
  up(e, cancel = false) {
    if (this.drag) {
      e.stopImmediatePropagation();
      e.preventDefault();
      this.endDrag(cancel);
    } else if (this.mode) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }
  validAnchor(item, point) {
    return (
      item?.type !== 'leader' ||
      !item.sourceId ||
      !this.adapter.validAnchor ||
      this.adapter.validAnchor(item, point)
    );
  }
  move(e) {
    if (this.drag) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const d = this.drag;
      if (e.pointerId !== d.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3) return;
      const hit = this.location(e, d.item.view, d.pointIndex !== null);
      if (!hit) return;
      if (!d.moved) {
        d.before = structuredClone(this.items);
        d.moved = true;
        this.surface.classList.add('annotation-dragging');
      }
      if (d.pointIndex !== null) {
        if (d.item.type === 'dimension') moveDimensionPoint(d.item, d.pointIndex, hit.point);
        else d.item.points[d.pointIndex] = [...hit.point];
        this.hover = hit;
      } else
        d.item.line = [
          d.line[0] + hit.point[0] - d.start[0],
          d.line[1] + hit.point[1] - d.start[1],
        ];
      this.adapter.redraw();
      return;
    }
    if (!this.mode) return;
    this.hover = this.location(
      e,
      this.draft?.view || this.item()?.view,
      this.phase !== 'place' && this.mode !== 'place-existing',
    );
    if (
      this.mode === 'move-anchor' &&
      this.hover &&
      !this.validAnchor(this.item(), this.hover.point)
    )
      this.hover = null;
    this.adapter.redraw();
  }
  render(root) {
    const layer = el('g', { class: 'drawing-annotations' });
    root.append(layer);
    for (const item of this.items) {
      if (this.adapter.visible && !this.adapter.visible(item)) continue;
      const broken = updateAnnotationReferences(
        item,
        (ref) => resolveReference(ref, this.adapter.candidates(item.view), this.adapter.grid?.()),
        (point) => this.validAnchor(item, point),
      );
      if (item.id === this.selected) this.referenceStatus(item, broken);
      let display = item;
      if (item.id === this.selected && this.mode === 'move-anchor' && this.hover) {
        display = structuredClone(item);
        if (display.type === 'dimension')
          moveDimensionPoint(display, this.anchorIndex, this.hover.point);
        else display.points[this.anchorIndex] = [...this.hover.point];
      }
      this.paint(layer, display, item.id === this.selected);
      if (broken.length) {
        const p = this.adapter.project(item.points[broken[0]], item.view);
        const warning = el(
          'text',
          {
            x: p[0] + 5 * this.adapter.unit(),
            y: p[1],
            fill: '#b45309',
            'font-size': 5 * this.adapter.unit(),
            'font-weight': 'bold',
          },
          '!',
        );
        warning.append(
          el('title', {}, 'Bruten modellkoppling. Flytta måttpunkten till en ny snappunkt.'),
        );
        layer.append(warning);
      }
    }
    if (this.draft) {
      if ((this.phase === 'place' || this.draft.type === 'leader') && this.hover)
        this.paint(layer, { ...this.draft, line: this.hover.point }, true);
      else for (const p of this.draft.points) this.dot(layer, p, this.draft.view);
    }
    if (this.hover?.snapped && (this.mode || this.drag)) {
      const p = this.adapter.project(this.hover.point, this.hover.view),
        r = this.adapter.unit() * 1.2;
      layer.append(
        el('rect', {
          x: p[0] - r,
          y: p[1] - r,
          width: 2 * r,
          height: 2 * r,
          fill: 'white',
          stroke: '#299378',
          'stroke-width': 1,
          'vector-effect': 'non-scaling-stroke',
        }),
      );
    }
  }
  referenceFor(hit, source) {
    const id = this.adapter.referenceSource?.(source) || source;
    if (hit.reference && (!source || hit.reference.source === id)) return hit.reference;
    return source ? surfaceReference(hit.point, id, this.adapter.candidates(hit.view)) : null;
  }
  referenceStatus(item, broken = []) {
    const status = this.panel.querySelector('.annotation-reference-status');
    if (!status) return;
    const linked = item.references?.filter(Boolean).length || 0;
    status.textContent = broken.length
      ? `${broken.length} bruten koppling – flytta fästpunkten till en ny snappunkt.`
      : `${linked} av ${item.points.length} punkter kopplade till modellen`;
    status.classList.toggle('broken', broken.length > 0);
  }
  dot(root, p, view) {
    const q = this.adapter.project(p, view);
    root.append(el('circle', { cx: q[0], cy: q[1], r: this.adapter.unit(), fill: '#299378' }));
  }
  paint(root, item, selected) {
    const project = (p) => this.adapter.project(p, item.view),
      unit = this.adapter.unit(),
      fontSize =
        (item.textSize ??
          this.record?.drawingPreset?.[item.type === 'leader' ? 'leaderSize' : 'dimensionSize'] ??
          2.5) * unit,
      g = el('g', {
        'data-annotation': item.id,
        class: 'drawing-annotation',
        fill: 'none',
        stroke: selected ? '#287c65' : '#263a42',
        'stroke-width': (this.record?.drawingPreset?.lineWidth ?? 0.22) * unit,
      });
    root.append(g);
    const line = (a, b, hit = false) =>
      g.append(
        el('path', {
          d: `M${a}L${b}`,
          ...(hit
            ? { stroke: 'transparent', 'stroke-width': 5 * unit, class: 'annotation-hit' }
            : {}),
        }),
      );
    const text = (p, value, angle = 0) =>
      g.append(
        el(
          'text',
          {
            x: p[0],
            y: p[1],
            transform: `rotate(${angle} ${p[0]} ${p[1]})`,
            fill: selected ? '#287c65' : '#263a42',
            stroke: 'white',
            'stroke-width': 0.8 * unit,
            'paint-order': 'stroke',
            'text-anchor': 'middle',
            'font-size': fontSize,
          },
          value,
        ),
      );
    if (item.type === 'leader') {
      const a = project(item.points[0]),
        b = project(item.line),
        sign = b[0] >= a[0] ? 1 : -1,
        mark = this.adapter.mark(item.sourceId) || 'Ej numrerad',
        label = item.manual
          ? item.comment || ''
          : item.comment?.trim()
            ? `${item.comment.trim()} · ${mark}`
            : mark,
        labelWidth = Math.max(14 * unit, label.length * fontSize * 0.65 + 2 * unit),
        end = [b[0] + sign * labelWidth, b[1]];
      line(a, b);
      line(b, end);
      line(a, b, true);
      const d = [b[0] - a[0], b[1] - a[1]],
        len = Math.hypot(...d) || 1,
        u = d.map((v) => v / len),
        n = [-u[1], u[0]];
      g.append(
        el('path', {
          d: `M${a}L${[a[0] + u[0] * 2.5 * unit + n[0] * 0.65 * unit, a[1] + u[1] * 2.5 * unit + n[1] * 0.65 * unit]}L${[a[0] + u[0] * 2.5 * unit - n[0] * 0.65 * unit, a[1] + u[1] * 2.5 * unit - n[1] * 0.65 * unit]}Z`,
          fill: selected ? '#287c65' : '#263a42',
        }),
      );
      text([(b[0] + end[0]) / 2, b[1] - unit], label);
    } else {
      let chain;
      try {
        chain = chainGeometry(item);
      } catch {
        return;
      }
      for (const p of chain.points) {
        const a = project(p.point),
          b = project(p.end),
          d = [b[0] - a[0], b[1] - a[1]],
          len = Math.hypot(...d) || 1;
        line(
          [a[0] + (d[0] / len) * 0.8 * unit, a[1] + (d[1] / len) * 0.8 * unit],
          [b[0] + (d[0] / len) * 1.2 * unit, b[1] + (d[1] / len) * 1.2 * unit],
        );
        line([b[0] - unit, b[1] + unit], [b[0] + unit, b[1] - unit]);
      }
      for (const segment of chain.segments) {
        const a = project(segment.a),
          b = project(segment.b);
        line(a, b);
        line(a, b, true);
        let angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        const rad = (angle * Math.PI) / 180;
        text(
          [(a[0] + b[0]) / 2 + Math.sin(rad) * unit, (a[1] + b[1]) / 2 - Math.cos(rad) * unit],
          Number(segment.length.toFixed(1)).toLocaleString('sv-SE'),
          angle,
        );
      }
      if (item.comment?.trim()) {
        const ends = chain.points.map((p) => project(p.end)),
          left = ends.reduce((a, b) => (b[0] < a[0] ? b : a)),
          vertical = Math.abs(ends[0][0] - ends.at(-1)[0]) < 0.001,
          y = vertical ? (ends[0][1] + ends.at(-1)[1]) / 2 : left[1] - unit;
        g.append(
          el(
            'text',
            {
              class: 'annotation-comment',
              x: left[0] - 3 * unit,
              y,
              fill: selected ? '#287c65' : '#263a42',
              stroke: 'white',
              'stroke-width': 0.8 * unit,
              'paint-order': 'stroke',
              'text-anchor': 'end',
              'font-size': fontSize,
            },
            item.comment.trim(),
          ),
        );
      }
    }
    if (selected) {
      for (const [index, p] of item.points.entries()) {
        const q = project(p),
          r = 5 / this.adapter.pixelScale();
        const handle = el('rect', {
          'data-anchor': index,
          class: 'annotation-anchor',
          x: q[0] - r,
          y: q[1] - r,
          width: 2 * r,
          height: 2 * r,
          rx: r * 0.3,
          fill: 'white',
          stroke: '#287c65',
          'stroke-width': 1.5,
          'vector-effect': 'non-scaling-stroke',
        });
        handle.append(
          el(
            'title',
            {},
            item.type === 'leader'
              ? 'Klicka för att flytta hänvisningens fästpunkt'
              : 'Klicka för att flytta måttpunkt',
          ),
        );
        g.append(handle);
      }
    }
  }
}
