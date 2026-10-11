import { paintDrawingObject } from './drawing-object-renderer.js';
import {
  createDrawingPreview,
  tintDrawingPreview,
  paintDrawingOverlay,
} from './drawing-overlay.js';
import { installDrawingOrder, installDrawingGeometry } from './drawing-object-inspector.js';
import { locateDrawingPoint } from './drawing-point-placement.js';
import { DrawingRichTextEditor } from './drawing-rich-text-editor.js';
import { installExactLength } from './ui/exact-length.js';
import { createCadStatusbar } from './cad-statusbar.js';
import { CadTracking } from './cad-tracking.js';
import { lengthPoint } from './frame-model.js';
import { actionButton } from './drawing-toolbar.js';
import { DrawingDimensionAssistant } from './drawing-dimension-assistant.js';
import { DrawingShapeTransform } from './drawing-shape-transform.js';
import { shapeGrips, shapeWithGrip } from './drawing-shape-grips.js';
import {
  installShapeStyle,
  shapeToolSettings,
  applyShapeToolSettings,
} from './drawing-shape-style.js';
import {
  linkedDimensions,
  moveLinkedDimensions,
  unlinkDimensions,
  linkedPaperOffsets,
} from './dimension-links.js';
import { shapeNames, validateShape } from './drawing-shapes.js';
import {
  resolveReference,
  surfaceReference,
  updateAnnotationReferences,
} from './annotation-references.js';
import {
  dimensionAxis,
  holeDimensionPoints,
  dimensionPaperOffset,
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
    this.selectedIds = new Set();
    this.toolButtons = [];
    for (const [kind, label] of Object.entries(names)) {
      const button = actionButton(document.createElement('button'), 'dimension', label);
      button.dataset.drawingGroup = 'measure';
      button.dataset.annotationMode = kind;
      button.onclick = () => this.start(kind, 'chain');
      toolbar.append(button);
      this.toolButtons.push(button);
    }
    for (const [shape, label] of Object.entries(shapeNames)) {
      const button = actionButton(document.createElement('button'), shape, label);
      button.dataset.drawingGroup = 'draw';
      button.dataset.drawingCategory = ['line', 'polyline'].includes(shape) ? 'Linjer' : 'Former';
      button.dataset.annotationMode = shape;
      button.onclick = () => this.start(shape, 'shape');
      toolbar.append(button);
      this.toolButtons.push(button);
    }
    const leader = actionButton(
      document.createElement('button'),
      'leader',
      adapter.manualLeaders ? 'Leader' : 'Part mark',
    );
    leader.onclick = () => this.start('leader');
    leader.dataset.drawingGroup = 'notes';
    leader.dataset.annotationMode = 'leader';
    toolbar.append(leader);
    this.toolButtons.push(leader);
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
    this.overlayHost = dialog.querySelector('.drawing-body');
    this.hint.classList.add('cad-hint');
    this.overlayHost.append(this.hint);
    for (const message of dialog.querySelectorAll('#plan-error, #sheet-message')) {
      message.classList.add('cad-hint', 'cad-warning');
      (footer || dialog).append(message);
      message.tabIndex = 0;
      const describe = () => {
        message.title = message.textContent;
        message.setAttribute('aria-label', message.textContent);
        message.tabIndex = message.textContent ? 0 : -1;
      };
      new MutationObserver(describe).observe(message, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      describe();
    }
    this.tracking = new CadTracking();
    this.cad = createCadStatusbar(dialog, footer || dialog, () => {
      this.tracking?.reset();
      this.trackHit = null;
      if (this.drag) this.drag.magnetPoint = null;
      if (this.record) this.adapter.redraw();
    });
    const lengthLabel = document.createElement('label');
    lengthLabel.innerHTML = '<span>Längd · mm</span>';
    const lengthControl = installExactLength(footer || dialog, { label: lengthLabel });
    this.dynamicInput = lengthControl.form;
    this.dynamicInput.hidden = true;
    this.dynamicInput.onsubmit = (event) => {
      event.preventDefault();
      if (this.transform?.active() && this.transform.base) {
        this.transform.submit(this.dynamicInput.querySelector('input').value);
        return;
      }
      if (!this.draft || !this.hover) return;
      try {
        const base = this.draft.points.at(-1);
        const direction = this.mode === 'circle' ? [base[0] + 1, base[1]] : this.hover.point;
        const target = lengthPoint(base, direction, this.dynamicInput.querySelector('input').value);
        this.draft.points.push(target);
        if (!['polyline', 'polygon'].includes(this.mode)) this.finishShape();
        this.dynamicInput.querySelector('input').value = '';
        this.surface.focus({ preventScroll: true });
        this.ui();
        this.adapter.redraw();
      } catch (error) {
        this.ui(error.message);
      }
    };
    this.dynamicInput.querySelector('input').oninput = () => {
      if (!this.transform?.active() || !this.transform.base) return;
      const text = this.dynamicInput.querySelector('input').value.trim();
      const value = Number(text.replace(',', '.'));
      if (this.mode === 'rotate-shapes')
        this.transform.numericAngle = text && Number.isFinite(value) ? value : null;
      else this.transform.exactDistance = text && value > 0 ? text : null;
      this.adapter.redraw();
    };
    if (adapter.paper) this.richText = new DrawingRichTextEditor(this, toolbar);
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
        this.lostCapture(e);
      },
      true,
    );
    dialog.addEventListener('keydown', (e) => this.key(e), true);
    dialog.addEventListener('close', () => {
      this.endDrag(true);
      this.mode = null;
      this.draft = null;
      this.selected = null;
      this.selectedIds = new Set();
    });
    this.assistant = new DrawingDimensionAssistant(this, toolbar);
    this.transform = new DrawingShapeTransform(this, toolbar);
    this.ui();
  }
  open(record) {
    this.richText?.cancel(false);
    this.record = record;
    this.items = record.annotations ??= [];
    this.history = [];
    this.future = [];
    this.mode = null;
    this.draft = null;
    this.selected = null;
    this.selectedIds = new Set();
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
    this.selected = null;
    this.selectedIds?.clear();
    this.cancel();
  }
  cancel() {
    this.richText?.cancel(false);
    this.assistant?.cancel();
    this.contextMenu.hidden = true;
    this.phase = 'points';
    this.tracking?.reset();
    if (this.dynamicInput) this.dynamicInput.hidden = true;
    this.mode = null;
    this.draft = null;
    this.hover = null;
    if (!this.selected) this.selectedIds?.clear();
    this.ui();
    this.adapter.redraw();
  }
  start(mode, workflow = 'chain') {
    this.adapter.cancelTools?.();
    this.workflow = workflow;
    this.tracking?.reset();
    if (this.dynamicInput) this.dynamicInput.hidden = true;
    this.selected = null;
    this.selectedIds?.clear();
    if (this.dynamicInput) {
      this.dynamicInput.querySelector('.ui-exact-length-field span').textContent = 'mm';
      this.dynamicInput
        .querySelector('input')
        .setAttribute('aria-label', 'Exakt längd eller radie · mm');
      this.dynamicInput.querySelector('input').value = '';
    }
    this.mode = mode;
    this.draft = null;
    this.hover = null;
    this.phase = 'points';
    this.ui();
    this.adapter.redraw();
    this.surface.setAttribute('tabindex', '-1');
    this.surface.focus({ preventScroll: true });
  }
  item() {
    return this.items.find((a) => a.id === this.selected);
  }
  ui(message) {
    if (!this.selected && !this.mode) this.selectedIds?.clear();
    for (const button of this.toolButtons || [])
      button.setAttribute('aria-pressed', String(button.dataset.annotationMode === this.mode));
    this.surface.classList.toggle('annotating', !!this.mode);
    if (this.transform?.active()) {
      this.panel.parentElement.classList.add('annotation-focused');
      this.transform.ui(message);
      this.assistant?.cancel();
      return;
    }
    if (!this.mode && this.selectedIds?.size > 1) {
      this.panel.replaceChildren();
      const title = document.createElement('h3'),
        text = document.createElement('p');
      title.textContent = `${this.selectedIds.size} ritobjekt markerade`;
      text.textContent =
        'Använd Flytta, Kopiera eller Rotera i den övre menyn. Shift-klick ändrar urvalet.';
      this.panel.append(title, text);
      this.panel.parentElement.classList.add('annotation-focused');
      this.hint.textContent = 'Shift-klick för flerval · Esc avmarkerar';
      return;
    }
    if (this.richText && (this.mode === 'richtext' || this.item()?.type === 'richtext')) {
      this.richText.ui();
      return;
    }
    this.panel.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = 'Anteckningar';
    this.panel.append(title);
    const item = this.item();
    const shapeTool = this.workflow === 'shape' && shapeNames[this.mode];
    this.panel.parentElement.classList.toggle('annotation-focused', !!item || !!shapeTool);
    if (shapeTool && this.record) {
      title.textContent = `${shapeTool} · verktyg`;
      const info = document.createElement('p');
      info.textContent = 'Inställningar för nästa objekt';
      this.panel.append(info);
      const settings = shapeToolSettings(this.record, this.mode);
      installShapeStyle(
        {
          panel: this.panel,
          record: this.record,
          history: this.history,
          future: this.future,
          checkpoint() {},
          ui: () => this.ui(),
          adapter: {
            redraw: () => {
              if (this.draft?.type === 'shape') applyShapeToolSettings(this.draft, settings);
              this.adapter.redraw();
            },
          },
        },
        settings,
      );
    }
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
      if (item.type !== 'shape') {
        this.panel.append(status);
        this.referenceStatus(item);
      }
      title.textContent =
        item.type === 'shape'
          ? shapeNames[item.shape]
          : item.type === 'dimension'
            ? item.points.length > 2
              ? 'Måttkedja'
              : 'Mått'
            : item.manual
              ? 'Leader'
              : 'Part mark';
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
          for (const member of linkedDimensions(this.items, item)) member[key] = value;
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
      if (item.type !== 'shape') {
        field('Kommentar', 'comment', 'text', item.comment || '');
        field(
          'Textstorlek · mm',
          'textSize',
          'number',
          item.textSize ??
            this.record?.drawingPreset?.[item.type === 'leader' ? 'leaderSize' : 'dimensionSize'] ??
            2.5,
        );
      }
      if (item.type === 'shape') {
        installDrawingGeometry(this, item);
        installShapeStyle(this, item);
      }
      installDrawingOrder(this, item);
      if (item.type === 'dimension') {
        const linked = linkedDimensions(this.items, item);
        if (linked.length > 1) {
          const info = document.createElement('p');
          info.textContent = `${linked.length} länkade mått · flytt och måttstil ändras tillsammans`;
          this.panel.append(info);
          button('Bryt länk', () => {
            this.checkpoint();
            unlinkDimensions(this.items, item);
            this.ui();
            this.adapter.redraw();
          });
        }
        const choice = (title, options, value, change) => {
          const label = document.createElement('label'),
            select = document.createElement('select');
          label.textContent = title;
          select.append(...options.map(([v, name]) => new Option(name, v)));
          select.value = String(value);
          select.onchange = () => change(select.value);
          label.append(select);
          this.panel.append(label);
          return select;
        };
        const direction = choice('Riktning', Object.entries(names), item.kind, (kind) => {
          try {
            const next = { ...item, kind, axis: dimensionAxis(kind, item.points) };
            if (chainGeometry(next).points.length < 2)
              throw Error('Punkterna ger inget mått i vald riktning.');
            this.checkpoint();
            item.kind = kind;
            item.axis = next.axis;
            this.ui();
            this.adapter.redraw();
          } catch (error) {
            direction.value = item.kind;
            this.hint.textContent = error.message;
          }
        });
        choice(
          'Decimaler',
          [['auto', 'Automatiskt'], ...[0, 1, 2, 3].map((n) => [String(n), String(n)])],
          item.precision ?? 'auto',
          (value) => {
            this.checkpoint();
            for (const member of linkedDimensions(this.items, item)) {
              if (value === 'auto') delete member.precision;
              else member.precision = +value;
            }
            this.adapter.redraw();
          },
        );
        const label = document.createElement('label'),
          offset = document.createElement('input');
        label.textContent = 'Avstånd · mm';
        offset.type = 'number';
        offset.min = -500;
        offset.max = 500;
        offset.step = 1;
        const project = (p) => this.adapter.project(p, item.view);
        offset.value = Number(
          dimensionPaperOffset(item, project, this.adapter.unit()).value.toFixed(2),
        );
        offset.onchange = () => {
          try {
            if (!offset.value.trim()) throw Error('Ange ett avstånd.');
            const changes = linkedPaperOffsets(
              this.items,
              item,
              +offset.value,
              project,
              this.adapter.unit(),
            );
            this.checkpoint();
            for (const { member, line } of changes) member.line = line;
            this.adapter.redraw();
          } catch (error) {
            this.hint.textContent = error.message;
            offset.value = Number(
              dimensionPaperOffset(item, project, this.adapter.unit()).value.toFixed(2),
            );
          }
        };
        label.append(offset);
        this.panel.append(label);
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
      if (this.mode === 'circle' && this.draft) {
        const label = document.createElement('label'),
          radius = document.createElement('input');
        label.textContent = 'Radie · mm i vyn';
        radius.type = 'number';
        radius.min = '0.001';
        radius.step = 'any';
        radius.onkeydown = (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.stopPropagation();
          const value = Number(radius.value);
          if (!(value > 0) || !Number.isFinite(value)) {
            radius.setCustomValidity('Ange en positiv radie.');
            radius.reportValidity();
            return;
          }
          const p = this.draft.points[0];
          this.draft.points.push([p[0] + value, p[1]]);
          this.finishShape();
        };
        radius.oninput = () => radius.setCustomValidity('');
        label.append(radius);
        this.panel.append(label);
      }
      if (this.draft?.type === 'shape' && ['polyline', 'polygon'].includes(this.draft.shape)) {
        button(
          this.mode === 'polygon' ? 'Stäng polygon ↵' : 'Avsluta polylinje ↵',
          () => this.finishShape(),
          this.draft.points.length < (this.mode === 'polygon' ? 3 : 2),
        );
        if (this.mode === 'polyline')
          button('Stäng polylinje · C', () => this.finishShape(true), this.draft.points.length < 3);
      }
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
    for (const b of this.dialog.querySelectorAll('[data-drawing-history]'))
      b.disabled = !(b.dataset.drawingHistory === 'redo' ? this.future : this.history).length;
    const instructions =
      this.workflow === 'shape' && this.mode
        ? this.mode === 'circle'
          ? this.draft
            ? 'Välj radiepunkt eller ange radie vid pekaren · Esc avbryter.'
            : 'Välj cirkelns centrum.'
          : this.mode === 'arc'
            ? ['Välj bågens startpunkt.', 'Välj en punkt på bågen.', 'Välj bågens slutpunkt.'][
                this.draft?.points.length || 0
              ]
            : this.mode === 'rectangle'
              ? this.draft
                ? 'Välj motsatt hörn.'
                : 'Välj rektangelns första hörn.'
              : ['polyline', 'polygon'].includes(this.mode)
                ? 'Välj hörnpunkter · klicka första punkten eller C för att stänga · Enter avslutar · Esc avbryter.'
                : this.draft
                  ? 'Välj linjens slutpunkt.'
                  : 'Välj linjens startpunkt.'
        : this.mode === 'leader'
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
                    : this.workflow === 'holes'
                      ? 'Klicka på ett hålcentrum.'
                      : this.workflow === 'point'
                        ? this.draft
                          ? 'Välj andra måttpunkten.'
                          : 'Välj första måttpunkten.'
                        : `Välj måttpunkter · Enter placerar kedjan · Esc avbryter`
                  : '';
    this.hint.textContent = message || instructions || '';
    this.hint.title = this.hint.textContent;
    if (this.dynamicInput) {
      this.dynamicInput.querySelector('.ui-exact-length-label span').textContent =
        this.mode === 'circle' ? 'Radie · mm' : 'Längd · mm';
      this.dynamicInput.hidden = !(
        this.workflow === 'shape' &&
        this.draft?.points.length &&
        ['line', 'polyline', 'polygon', 'circle'].includes(this.mode) &&
        !this.drag
      );
    }
    this.assistant?.ui();
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
  finishShape(close = false) {
    if (!this.draft) return;
    try {
      close ||= this.draft.shape === 'polygon';
      validateShape(this.draft.shape, this.draft.points, close);
      this.checkpoint();
      this.draft.closed = close;
      this.items.push(this.draft);
      const mode = this.mode;
      const last = this.draft.points.at(-1),
        view = this.draft.view;
      this.start(mode, 'shape');
      if (mode === 'line') {
        this.draft = {
          id: crypto.randomUUID(),
          type: 'shape',
          shape: 'line',
          view,
          points: [[...last]],
        };
        if (this.record) applyShapeToolSettings(this.draft, shapeToolSettings(this.record, mode));
        this.ui();
        this.adapter.redraw();
      }
    } catch (error) {
      this.ui(error.message);
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
    if (e.key === 'Escape') {
      const menu = e.target?.closest?.('.cad-status-menu[open], .ui-command-menu');
      if (
        menu &&
        (menu.matches?.('.cad-status-menu') ||
          menu.querySelector?.('.ui-command-panel:popover-open'))
      )
        return;
    }
    if (this.cad?.key(e)) {
      e.stopImmediatePropagation();
      return;
    }
    if (
      this.transform?.active() &&
      this.transform.base &&
      !e.target?.closest?.('input,select,textarea,[contenteditable="true"]') &&
      /^[0-9+.,-]$/.test(e.key)
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.dynamicInput.hidden = false;
      const input = this.dynamicInput.querySelector('input');
      input.value = e.key;
      input.focus();
      return;
    }
    if (
      !e.target?.closest?.('input,select,textarea,[contenteditable="true"]') &&
      /^[0-9+.,-]$/.test(e.key) &&
      this.draft &&
      this.hover &&
      this.workflow === 'shape' &&
      ['line', 'polyline', 'polygon', 'circle'].includes(this.mode)
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.dynamicInput.hidden = false;
      const input = this.dynamicInput.querySelector('input');
      input.value = e.key;
      input.focus();
      return;
    }
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
    if (e.target.closest('input,select,textarea,[contenteditable="true"]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.undo(e.shiftKey);
      return;
    }
    if (e.key === 'Enter' && this.mode) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (this.transform?.active()) this.transform.finishSelection();
      else if (this.mode === 'assistant') {
        if (this.assistant.phase === 'select' && this.assistant.sources.length) {
          this.assistant.phase = 'place';
          this.assistant.ui();
        }
      } else if (this.mode === 'line' && this.draft?.points.length === 1) this.cancel();
      else if (this.workflow === 'shape') this.finishShape();
      else this.finishPoints();
      this.adapter.redraw();
    } else if (e.key.toLowerCase() === 'c' && ['polyline', 'polygon'].includes(this.mode)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.finishShape(true);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected && !this.mode) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.checkpoint();
      const ids = this.selectedIds?.size ? this.selectedIds : new Set([this.selected]);
      this.items = this.record.annotations = this.items.filter((item) => !ids.has(item.id));
      this.selected = null;
      this.cancel();
    }
  }
  location(...args) {
    return locateDrawingPoint(this, ...args);
  }
  down(e) {
    if (e.button !== 0) return;
    const target = e.target.closest('[data-annotation]');
    if (!this.mode) {
      if (target) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const id = target.dataset.annotation;
        this.selectedIds ??= new Set();
        if (e.shiftKey) {
          if (this.selected && !this.selectedIds.size) this.selectedIds.add(this.selected);
          if (this.selectedIds.has(id)) this.selectedIds.delete(id);
          else this.selectedIds.add(id);
          this.selected = [...this.selectedIds].at(-1) || null;
          this.ui();
          this.adapter.redraw();
          return;
        }
        this.selected = id;
        this.selectedIds = new Set([id]);
        if (this.item()?.type === 'shape') {
          const handle = e.target.closest('[data-shape-grip]');
          if (handle) {
            const item = this.item();
            this.drag = {
              pointerId: e.pointerId,
              item,
              shapeBefore: structuredClone(item),
              grip: shapeGrips(item)[Number(handle.dataset.shapeGrip)],
              points: structuredClone(item.points),
              pointIndex: 0,
              x: e.clientX,
              y: e.clientY,
              moved: false,
            };
            this.surface.setPointerCapture(e.pointerId);
          }
          this.ui();
          this.adapter.redraw();
          return;
        }
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
            linkedLines: linkedDimensions(this.items, item).map((member) => ({
              member,
              line: [...member.line],
            })),
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
        this.selectedIds?.clear();
        this.ui();
        this.adapter.redraw();
      }
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (this.transform?.active()) {
      this.transform.down(e);
      return;
    }
    if (this.mode === 'assistant') {
      this.assistant.down(e);
      return;
    }
    const item = this.item(),
      view = this.draft?.view || item?.view,
      hit = this.location(e, view, this.phase !== 'place' && this.mode !== 'place-existing');
    if (!hit) return;
    if (this.workflow === 'shape' && shapeNames[this.mode]) {
      if (!this.draft)
        this.draft = {
          id: crypto.randomUUID(),
          type: 'shape',
          shape: this.mode,
          view: hit.view,
          points: [],
        };
      if (this.record)
        applyShapeToolSettings(this.draft, shapeToolSettings(this.record, this.mode));
      if (
        this.draft.points.length >= 3 &&
        ['polyline', 'polygon'].includes(this.mode) &&
        Math.hypot(this.draft.points[0][0] - hit.point[0], this.draft.points[0][1] - hit.point[1]) <
          1e-7
      ) {
        this.finishShape(true);
        return;
      }
      if (
        this.draft.points.some((p) => Math.hypot(p[0] - hit.point[0], p[1] - hit.point[1]) < 1e-7)
      )
        return;
      this.draft.points.push([...hit.point]);
      const required =
        this.mode === 'arc' ? 3 : ['polyline', 'polygon'].includes(this.mode) ? Infinity : 2;
      if (this.draft.points.length === required) {
        this.finishShape();
        if (this.draft?.points.length === required) this.draft.points.pop();
      }
      this.ui();
      this.adapter.redraw();
      return;
    }
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
      moveLinkedDimensions(this.items, item, hit.point);
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
    if (
      this.workflow === 'holes' &&
      !this.draft &&
      ['horizontal', 'vertical'].includes(this.mode)
    ) {
      const points = holeDimensionPoints(
        this.adapter.candidates(hit.view),
        hit.reference,
        this.mode,
      );
      if (points.length < 2) {
        this.ui('Välj en hålbild med minst två hålcentrum i måttriktningen.');
        return;
      }
      this.draft = {
        id: crypto.randomUUID(),
        type: 'dimension',
        kind: this.mode,
        view: hit.view,
        points: points.map((p) => [...p]),
        references: points.map((p) => p.reference),
      };
      this.finishPoints();
      this.adapter.redraw();
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
        this.draft.points.length >= 3 &&
        ['polyline', 'polygon'].includes(this.mode) &&
        Math.hypot(this.draft.points[0][0] - hit.point[0], this.draft.points[0][1] - hit.point[1]) <
          1e-7
      ) {
        this.finishShape(true);
        return;
      }
      if (
        this.draft.points.some((p) => Math.hypot(p[0] - hit.point[0], p[1] - hit.point[1]) < 1e-5)
      )
        return;
      this.draft.points.push(hit.point);
      this.draft.references.push(hit.reference || null);
    }
    if (
      this.workflow === 'point' &&
      this.draft?.type === 'dimension' &&
      this.draft.points.length === 2
    ) {
      this.finishPoints();
      if (this.phase !== 'place') {
        this.draft.points.pop();
        this.draft.references.pop();
      }
      this.adapter.redraw();
      return;
    }
    this.ui();
    this.adapter.redraw();
  }
  endDrag(cancel = false) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (cancel && d.moved) {
      if (d.shapeBefore) Object.assign(d.item, d.shapeBefore);
      else d.item.line = d.line;
      d.item.points = d.points;
      for (const { member, line } of d.linkedLines || []) member.line = [...line];
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
      if (e.pointerId !== this.drag.pointerId) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.endDrag(cancel);
    } else if (this.mode) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }
  lostCapture(e) {
    // SVG redraws remove child grips. Their capture events must not cancel the
    // surface's drag. A capture loss after the button is released is a commit.
    if (!this.drag || e.target !== this.surface || e.pointerId !== this.drag.pointerId) return;
    this.up(e, e.buttons !== 0);
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
      const hit = this.location(
        e,
        d.item.view,
        d.pointIndex !== null,
        d.shapeBefore ? d.item.id : null,
      );
      if (!hit) return;
      let changedShape;
      if (d.shapeBefore) {
        try {
          changedShape = shapeWithGrip(d.shapeBefore, d.grip, hit.point);
        } catch {
          return;
        }
      }
      if (!d.moved) {
        d.before = structuredClone(this.items);
        d.moved = true;
        this.surface.classList.add('annotation-dragging');
      }
      if (changedShape) {
        Object.assign(d.item, changedShape);
        this.hover = hit;
      } else if (d.pointIndex !== null) {
        if (d.item.type === 'dimension') moveDimensionPoint(d.item, d.pointIndex, hit.point);
        else d.item.points[d.pointIndex] = [...hit.point];
        this.hover = hit;
      } else {
        for (const { member, line } of d.linkedLines || []) member.line = [...line];
        moveLinkedDimensions(this.items, d.item, [
          d.line[0] + hit.point[0] - d.start[0],
          d.line[1] + hit.point[1] - d.start[1],
        ]);
      }
      this.adapter.redraw();
      return;
    }
    if (!this.mode) {
      const hit = this.adapter.locate(e);
      if (hit) this.cad.coordinates(hit.point);
      return;
    }
    if (this.transform?.active()) {
      this.hover =
        this.transform.phase !== 'select' ? this.location(e, this.transform.view, true) : null;
      this.adapter.redraw();
      return;
    }
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
    if (!this.selected && !this.mode) this.selectedIds?.clear();
    const back = el('g', { class: 'drawing-annotations drawing-annotations-back' }),
      front = el('g', { class: 'drawing-annotations drawing-annotations-front' });
    const boundary = root.querySelector(':scope > [data-paper-boundary]');
    root.insertBefore(back, boundary ? boundary.nextSibling : root.firstChild);
    root.append(front);
    this.overlay = el('g', { class: 'drawing-overlay', 'data-annotation-helper': 'overlay' });
    root.append(this.overlay);
    let layer = front;
    for (const item of this.items) {
      if (item.type === 'richtext') continue;
      layer = item.drawOrder === 'back' ? back : front;
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
      this.paint(
        layer,
        display,
        item.id === this.selected ||
          this.selectedIds?.has(item.id) ||
          (this.transform?.active() && this.transform.ids.includes(item.id)),
      );
      if (broken.length) {
        const p = this.adapter.project(item.points[broken[0]], item.view);
        const warning = el(
          'text',
          {
            x: p[0] + 5 * this.adapter.unit(),
            y: p[1],
            fill: '#b45309',
            'data-annotation-helper': 'reference-warning',
            'font-size': 5 * this.adapter.unit(),
            'font-weight': 'bold',
          },
          '!',
        );
        warning.append(
          el('title', {}, 'Bruten modellkoppling. Flytta måttpunkten till en ny snappunkt.'),
        );
        this.overlay.append(warning);
      }
    }
    layer = this.overlay;
    if (this.draft) {
      if (this.draft.type === 'shape' && this.hover) {
        const preview = { ...this.draft, points: [...this.draft.points, this.hover.point] };
        this.paint(layer, preview, false, true);
        for (const p of this.draft.points) this.dot(layer, p, this.draft.view);
      } else if ((this.phase === 'place' || this.draft.type === 'leader') && this.hover)
        this.paint(layer, { ...this.draft, line: this.hover.point }, false, true);
      else for (const p of this.draft.points) this.dot(layer, p, this.draft.view);
    }
    this.assistant?.render(layer);
    if (this.transform?.active()) this.transform.render(layer);
    if (this.hover?.view !== 'paper' || !this.richText) paintDrawingOverlay(layer, this);
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
  paint(root, item, selected, preview = false) {
    if (item.type === 'richtext') return;
    const target = preview ? createDrawingPreview(root) : root;
    paintDrawingObject(this, target, item, selected);
    if (preview) tintDrawingPreview(target);
  }
}
