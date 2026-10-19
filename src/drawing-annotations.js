import { installInspectorEnter } from './inspector/enter.js';
import { createCreationDefaults } from './inspector/creation-defaults.js';
import { createDrawingPropertyActions } from './drawing/ui/property-actions.js';
import { insertDrawingVertex, removeDrawingVertex } from './drawing-vertex-editing.js';
import { beginDrawingMarkerGrip } from './drawing-marker-grip-editor.js';
import { pickShapePoint, completeShape, shapeLengthPoint } from './drawing-shape-creation.js';
import {
  pickDimensionPoint,
  prepareDimensionPlacement,
  withDimensionPoint,
  dimensionDirections as names,
} from './drawing-dimension-creation.js';
import {
  renderAnnotationInspector,
  renderAnnotationReferenceStatus,
} from './drawing-annotation-inspector.js';
import { DrawingGripInteraction } from './drawing-grip-interaction.js';
import { beginDrawingObjectGrip } from './drawing-object-grip-editor.js';
import { paintDrawingObject } from './drawing-object-renderer.js';
import {
  createDrawingPreview,
  tintDrawingPreview,
  paintDrawingOverlay,
} from './drawing-overlay.js';
import { locateDrawingPoint } from './drawing-point-placement.js';
import { DrawingPointerTimings } from './drawing-pointer-timings.js';
import { DrawingRichTextEditor } from './drawing-rich-text-editor.js';
import { installExactLength } from './ui/exact-length.js';
import { createCadStatusbar } from './cad-statusbar.js';
import { CadTracking } from './cad-tracking.js';
import { actionButton } from './drawing-toolbar.js';
import { DrawingDimensionAssistant } from './drawing-dimension-assistant.js';
import { DrawingShapeTransform } from './drawing-shape-transform.js';
import { drawingFeedbackMeasures } from './drawing-measurements.js';
import { paintMeasurements as paintMeasurementOverlay } from './ui/measurement-overlay.js';
import { DrawingMarquee } from './drawing-marquee.js';
import { DrawingBlocks } from './blocks/drawing-controller.js';
import { blockSelection } from './blocks/placement.js';
import { shapeToolSettings, applyShapeToolSettings } from './drawing-shape-style.js';
import { linkedDimensions, moveLinkedDimensions } from './dimension-links.js';
import { shapeNames } from './drawing-shapes.js';
import {
  resolveReference,
  surfaceReference,
  updateAnnotationReferences,
} from './annotation-references.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
export class DrawingAnnotations {
  constructor({ dialog, surface, toolbar, adapter }) {
    Object.assign(this, { dialog, surface, adapter });
    if (
      import.meta.env?.DEV &&
      new URLSearchParams(location.search).get('drawingPerformance') === '1'
    ) {
      this.pointerTimings = new DrawingPointerTimings();
      dialog.addEventListener('close', () => this.pointerTimings.report());
    }
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
    installInspectorEnter(this.panel);
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
    this.cad = createCadStatusbar(dialog, footer || dialog, () => this.syncCadSettings());
    const lengthLabel = document.createElement('label');
    lengthLabel.innerHTML = '<span>Längd · mm</span>';
    const lengthControl = installExactLength(footer || dialog, { label: lengthLabel });
    this.dynamicInput = lengthControl.form;
    this.dynamicInput.hidden = true;
    this.dynamicInput.onsubmit = (event) => {
      event.preventDefault();
      if (this.grips?.session) {
        this.grips.submit(this.dynamicInput.querySelector('input').value);
        return;
      }
      if (this.transform?.active() && this.transform.base) {
        this.transform.submit(this.dynamicInput.querySelector('input').value);
        return;
      }
      if (!this.draft || !this.hover) return;
      try {
        const target = shapeLengthPoint(
          this.draft,
          this.hover.point,
          this.dynamicInput.querySelector('input').value,
        );
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
    this.grips = new DrawingGripInteraction(this);
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
    // Embedded browsers can route Ctrl/⌘ C through the native Copy command.
    // Keep editable text's clipboard behavior; only a drawing selection is a tool intent.
    dialog.addEventListener('copy', (event) => this.copySelection(event), true);
    dialog.addEventListener('close', () => {
      this.propertyUI?.reset();
      this.endDrag(true);
      this.mode = null;
      this.draft = null;
      this.selected = null;
      this.selectedIds = new Set();
      this.releaseGraphics();
    });
    this.assistant = new DrawingDimensionAssistant(this, toolbar);
    this.transform = new DrawingShapeTransform(this, toolbar);
    this.marquee = new DrawingMarquee(this, toolbar);
    this.blocks = new DrawingBlocks(this, toolbar);
    this.propertyUI = createDrawingPropertyActions(this, createCreationDefaults(localStorage));
    this.ui();
  }
  beginGrip(event, node) {
    if (this.propertyUI?.active()) return null;
    for (const tool of this.markerTools || []) {
      const session = beginDrawingMarkerGrip(tool, event, node);
      if (session) return session;
    }
    if (node.closest('[data-rich-text]')) return this.richText?.beginGrip(event, node);
    return beginDrawingObjectGrip(this, event, node) || this.adapter.beginViewGrip?.(event, node);
  }
  recordOperation(before, after, apply) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.history.push({ drawingOperation: true, before, after, apply });
    this.future = [];
  }
  open(record) {
    this.propertyUI?.reset();
    this.selectionScope?.clear();
    this.grips?.cancel();
    this.marquee?.cancel();
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
  syncCadSettings() {
    this.tracking?.reset();
    this.trackHit = null;
    this.previousPointSnap = null;
    this.hover = null;
    if (this.record && this.dialog.open) this.adapter.redraw();
  }
  checkpoint() {
    this.history.push(structuredClone(this.items));
    this.future = [];
  }
  undo(redo = false) {
    this.propertyUI?.reset();
    const from = redo ? this.future : this.history,
      to = redo ? this.history : this.future;
    if (!from.length) return;
    this.grips?.cancel();
    const entry = from.at(-1);
    if (entry.drawingOperation) {
      from.pop();
      to.push(entry);
      entry.apply(redo ? entry.after : entry.before);
      this.ui();
      this.adapter.redraw();
      return;
    }
    to.push(structuredClone(this.items));
    this.items = from.pop();
    this.record.annotations = this.items;
    this.selected = null;
    this.selectedIds?.clear();
    this.cancel();
  }
  cancel() {
    if (this.blocks) this.blocks.preview = null;
    this.grips?.cancel();
    this.marquee?.cancel();
    this.richText?.cancel(false);
    this.assistant?.cancel();
    this.contextMenu?.close();
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
    if (this.propertyUI?.active()) this.propertyUI.cancel();
    this.marquee?.cancel();
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
    if (workflow === 'shape' && this.propertyUI && this.record) {
      const settings = shapeToolSettings(this.record, mode);
      Object.assign(settings, this.propertyUI.defaultsFor({ type: 'shape', ...settings }));
      delete settings.type;
    }
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
    this.selectionScope?.sync();
    for (const button of this.dialog.querySelectorAll('[data-drawing-history]'))
      button.disabled = !(button.dataset.drawingHistory === 'redo' ? this.future : this.history)
        .length;
    if (this.selectedIds?.size) this.selectedIds = blockSelection(this.items, this.selectedIds);
    const selectedViews = this.marquee?.views?.ids()?.size || 0;
    for (const button of this.toolButtons || [])
      if (button.dataset.annotationMode === 'rotate-shapes') button.disabled = selectedViews > 0;
    const focus = this.selected || this.mode;
    if (focus && focus !== this.inspectorFocus) this.showProperties?.();
    this.inspectorFocus = focus;
    if (!this.selected && !this.mode) this.selectedIds?.clear();
    for (const button of this.toolButtons || [])
      button.setAttribute(
        'aria-pressed',
        String(
          button.dataset.annotationMode === 'box-select'
            ? !!this.marquee?.enabled
            : button.dataset.annotationMode === this.mode,
        ),
      );
    this.surface.classList.toggle('annotating', !!this.mode);
    if (this.blocks?.ui(message)) return;
    renderAnnotationInspector(
      {
        state: {
          item: this.item(),
          items: this.items,
          record: this.record,
          mode: this.mode,
          workflow: this.workflow,
          draft: this.draft,
          phase: this.phase,
          selectedIds: this.selectedIds,
          selectedViewCount: selectedViews,
          history: this.history,
          future: this.future,
          drag: this.drag,
        },
        panel: this.panel,
        hint: this.hint,
        dialog: this.dialog,
        dynamicInput: this.dynamicInput,
        adapter: this.adapter,
        tools: {
          transform: this.transform,
          richText: this.richText,
          assistant: this.assistant,
          marquee: this.marquee,
        },
        commands: {
          refresh: (message) => this.ui(message),
          checkpoint: () => this.checkpoint(),
          history: () => ({ history: this.history, future: this.future }),
          cancel: () => this.cancel(),
          clearSelection: () => {
            this.selected = null;
          },
          finishShape: (close) => this.finishShape(close),
          finishPoints: () => this.finishPoints(),
          addDimensionPoint: () => this.startAdding(),
          removeDimensionPoint: (index) => this.removeDimensionPoint(index),
          undo: (redo) => this.undo(redo),
        },
      },
      message,
    );
    this.propertyUI?.sync();
  }
  finishPoints() {
    if (!this.draft || this.draft.points.length < 2) return;
    try {
      this.draft = prepareDimensionPlacement(this.draft);
      this.phase = 'place';
      this.ui();
    } catch (e) {
      this.ui(e.message);
    }
  }
  finishShape(close = false) {
    if (!this.draft) return;
    try {
      const shape = completeShape(this.draft, close);
      this.checkpoint();
      this.items.push(shape);
      const mode = this.mode;
      if (mode === 'insulation') {
        this.selected = this.draft.id;
        this.selectedIds = new Set([this.selected]);
        this.cancel();
        return;
      }
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
  editVertex(change, value) {
    const item = this.item();
    if (!['polyline', 'polygon'].includes(item?.shape) || item.parametricBlock) return;
    try {
      const next =
        change === 'insert' ? insertDrawingVertex(item, value) : removeDrawingVertex(item, value);
      this.checkpoint();
      Object.assign(item, next);
      this.ui();
      this.adapter.redraw();
    } catch (error) {
      this.ui(error.message);
    }
  }
  placeDimensionLine() {
    if (this.item()?.type !== 'dimension') return;
    this.mode = 'place-existing';
    this.hover = null;
    this.ui();
    this.adapter.redraw();
    this.surface.focus({ preventScroll: true });
  }
  removeDimensionPoint(index) {
    const item = this.item();
    if (
      item?.type !== 'dimension' ||
      item.points.length <= 2 ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= item.points.length
    )
      return;
    this.checkpoint();
    item.points.splice(index, 1);
    item.references?.splice(index, 1);
    this.ui();
    this.adapter.redraw();
  }
  startAdding() {
    if (this.item()?.type !== 'dimension') return;
    this.contextMenu?.close();
    this.mode = 'add';
    this.phase = 'points';
    this.hover = null;
    this.ui();
    this.adapter.redraw();
    this.surface.setAttribute('tabindex', '-1');
    this.surface.focus({ preventScroll: true });
  }
  completionCommand() {
    if (this.propertyUI?.active()) return 'property-copy';
    if (this.drag || this.grips?.session || this.richText?.draft) return null;
    if (this.transform?.active())
      return this.transform.phase === 'select' ? `${this.mode}:select` : null;
    if (this.mode === 'assistant')
      return this.assistant.phase === 'select' ? 'assistant:select' : null;
    if (this.workflow === 'shape')
      return ['polyline', 'polygon'].includes(this.mode) && this.draft ? this.draft : null;
    return this.mode && this.phase === 'points' && this.draft?.type === 'dimension'
      ? this.draft
      : null;
  }
  complete() {
    if (this.propertyUI?.active()) {
      this.propertyUI.confirm();
      return;
    }
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
  }
  key(e) {
    if (
      this.propertyUI?.active() &&
      ['Escape', 'Enter'].includes(e.key) &&
      !e.target.closest('input,select,textarea,[contenteditable=true]')
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') this.propertyUI.cancel();
      else this.propertyUI.confirm();
      return;
    }
    if (e.key === 'Escape') {
      const menu = e.target?.closest?.('.cad-status-menu[open], .ui-command-menu');
      if (
        menu &&
        (menu.matches?.('.cad-status-menu') ||
          menu.querySelector?.('.ui-command-panel:popover-open'))
      )
        return;
    }
    if (e.key === 'Escape' && this.marquee?.enabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.selected = null;
      this.marquee?.clearViews();
      this.selectionScope?.clear();
      this.cancel();
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
      ['line', 'polyline', 'polygon', 'circle', 'insulation'].includes(this.mode)
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.dynamicInput.hidden = false;
      const input = this.dynamicInput.querySelector('input');
      input.value = e.key;
      input.focus();
      return;
    }
    if (e.key === 'Escape' && this.contextMenu?.isOpen()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.contextMenu?.close();
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
    if (
      e.key === 'Escape' &&
      (this.mode ||
        this.selected ||
        this.marquee?.views?.ids()?.size ||
        this.selectionScope?.hasSelection())
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.selected = null;
      this.marquee?.clearViews();
      this.selectionScope?.clear();
      this.cancel();
      return;
    }
    if (e.target.closest('input,select,textarea,[contenteditable="true"]')) return;
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.altKey &&
      !e.shiftKey &&
      (this.selected || this.marquee?.views?.ids()?.size)
    ) {
      const mode = { m: 'move-shapes', c: 'copy-shapes', r: 'rotate-shapes' }[e.key.toLowerCase()];
      if (mode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) this.transform.start(mode);
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.undo(e.shiftKey);
      return;
    }
    if (e.key === 'Enter' && this.mode) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.complete();
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
  copySelection(event) {
    if (
      (!this.selected && !this.marquee?.views?.ids()?.size) ||
      this.mode ||
      event.target.closest('input,select,textarea,[contenteditable="true"]')
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.transform.start('copy-shapes');
  }
  location(...args) {
    if (this.pointerTimings)
      return this.pointerTimings.measure('snap', this.cad.get(), () =>
        locateDrawingPoint(this, ...args),
      );
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
        this.showProperties?.();
        this.selectedIds ??= new Set();
        if (e.shiftKey) {
          if (this.selected && !this.selectedIds.size) this.selectedIds.add(this.selected);
          const group = blockSelection(this.items, [id]);
          if (this.selectedIds.has(id)) for (const member of group) this.selectedIds.delete(member);
          else for (const member of group) this.selectedIds.add(member);
          this.selected = [...this.selectedIds].at(-1) || null;
          this.ui();
          this.adapter.redraw();
          return;
        }
        this.selected = id;
        this.selectedIds = new Set([id]);
        if (this.propertyUI?.active() || this.item()?.type === 'shape') {
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
    if (this.mode === 'block-place') {
      this.blocks.down(e);
      return;
    }
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
      const picked = pickShapePoint(this.draft, this.mode, hit);
      if (picked.duplicate) return;
      this.draft =
        !this.draft && this.propertyUI ? this.propertyUI.defaultsFor(picked.draft) : picked.draft;
      if (this.record)
        applyShapeToolSettings(this.draft, shapeToolSettings(this.record, this.mode));
      if (picked.finish === 'closed') {
        this.finishShape(true);
        return;
      }
      if (picked.finish) {
        const draft = this.draft;
        this.finishShape();
        if (this.draft === draft && picked.finish === 'open') this.draft.points.pop();
      }
      this.ui();
      this.adapter.redraw();
      return;
    }
    if (this.mode === 'add') {
      const next = withDimensionPoint(item, hit);
      if (!next) {
        this.ui('Den måttpunkten finns redan i kedjan.');
        return;
      }
      this.checkpoint();
      Object.assign(item, next);
      this.ui();
      this.adapter.redraw();
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
    const source = this.mode === 'leader' ? this.adapter.pick(e, hit) : undefined;
    const picked = pickDimensionPoint(
      { draft: this.draft, mode: this.mode, workflow: this.workflow },
      hit,
      {
        candidates: this.workflow === 'holes' ? this.adapter.candidates(hit.view) : [],
        source,
        sourceMark:
          source && this.mode === 'leader' && !this.adapter.manualLeaders
            ? this.adapter.mark(source)
            : null,
        reference: this.mode === 'leader' ? this.referenceFor(hit, source) : null,
        manualLeaders: this.adapter.manualLeaders,
      },
    );
    if (picked.message) {
      this.ui(picked.message);
      return;
    }
    if (picked.duplicate) return;
    this.draft =
      !this.draft && this.propertyUI ? this.propertyUI.defaultsFor(picked.draft) : picked.draft;
    if (picked.place) {
      this.finishPoints();
      if (this.phase !== 'place' && this.workflow === 'point') {
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
      d.item.line = d.line;
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
    if (this.pointerTimings && (this.mode || this.drag))
      return this.pointerTimings.measure('pointer', this.cad.get(), () => this.movePoint(e));
    return this.movePoint(e);
  }
  movePoint(e) {
    if (this.mode === 'block-place') {
      this.blocks.move(e);
      return;
    }
    if (this.drag) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const d = this.drag;
      if (e.pointerId !== d.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3) return;
      const hit = this.location(e, d.item.view, false);
      if (!hit) return;
      if (!d.moved) {
        d.before = structuredClone(this.items);
        d.moved = true;
        this.surface.classList.add('annotation-dragging');
      }
      for (const { member, line } of d.linkedLines || []) member.line = [...line];
      moveLinkedDimensions(this.items, d.item, [
        d.line[0] + hit.point[0] - d.start[0],
        d.line[1] + hit.point[1] - d.start[1],
      ]);
      this.redrawFeedback(true);
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
      this.redrawFeedback();
      return;
    }
    this.hover = this.location(
      e,
      this.draft?.view || this.item()?.view,
      this.phase !== 'place' && this.mode !== 'place-existing',
    );
    this.redrawFeedback();
  }
  releaseGraphics() {
    this.overlay?.remove();
    this.overlay = null;
    this.graphicsRoot = null;
  }
  redrawFeedback(objects = false) {
    if (!this.graphicsRoot?.isConnected) return this.adapter.redraw();
    if (objects) {
      this.render(this.graphicsRoot);
      if (this.richText?.graphicsRoot) this.richText.paint(this.richText.graphicsRoot);
    } else {
      this.paintOverlay();
      this.richText?.paintFeedback();
    }
  }
  render(root) {
    this.graphicsRoot = root;
    root
      .querySelectorAll(':scope > .drawing-annotations,:scope > .drawing-overlay')
      .forEach((node) => node.remove());
    if (!this.selected && !this.mode) this.selectedIds?.clear();
    const back = el('g', { class: 'drawing-annotations drawing-annotations-back' }),
      front = el('g', { class: 'drawing-annotations drawing-annotations-front' });
    const boundary = root.querySelector(':scope > [data-paper-boundary]');
    root.insertBefore(back, boundary ? boundary.nextSibling : root.firstChild);
    root.append(front);
    this.overlay = el('g', { class: 'drawing-overlay', 'data-annotation-helper': 'overlay' });
    root.append(this.overlay);
    let layer = front;
    for (const item of this.propertyUI?.display(this.items) || this.items) {
      if (item.type === 'richtext') continue;
      if (item.parametricBlock && item.view === 'paper') continue;
      layer = item.drawOrder === 'back' ? back : front;
      if (this.adapter.visible && !this.adapter.visible(item)) continue;
      const broken = updateAnnotationReferences(
        item,
        (ref) => resolveReference(ref, this.adapter.candidates(item.view), this.adapter.grid?.()),
        (point) => this.validAnchor(item, point),
      );
      if (item.id === this.selected) this.referenceStatus(item, broken);
      this.paint(
        layer,
        item,
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
    this.paintOverlay();
  }
  paintOverlay() {
    if (!this.overlay) return;
    this.overlay.querySelector(':scope > .drawing-dynamic-overlay')?.remove();
    const layer = el('g', { class: 'drawing-dynamic-overlay' });
    this.overlay.append(layer);
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
    this.blocks?.render(layer);
    if (this.transform?.active()) this.transform.render(layer);
    if (this.hover?.view !== 'paper' || !this.richText) paintDrawingOverlay(layer, this);
    this.paintMeasurements();
  }
  paintMeasurements() {
    if (!this.overlay?.isConnected) return;
    this.overlay.querySelector(':scope > [data-annotation-helper="measurements"]')?.remove();
    paintMeasurementOverlay(
      this.overlay,
      drawingFeedbackMeasures(this),
      (p, measure) => this.adapter.project(p, measure.view),
      this.adapter.pixelScale(),
    );
  }
  referenceFor(hit, source) {
    const id = this.adapter.referenceSource?.(source) || source;
    if (hit.reference && (!source || hit.reference.source === id)) return hit.reference;
    return source ? surfaceReference(hit.point, id, this.adapter.candidates(hit.view)) : null;
  }
  referenceStatus(item, broken = []) {
    renderAnnotationReferenceStatus(this.panel, item, broken);
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
