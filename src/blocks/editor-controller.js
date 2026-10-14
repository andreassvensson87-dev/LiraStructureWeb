import { blockPoints, withPointBindings } from './point-bindings.js';
import { validateBlockGeometry } from './validation.js';
import { BlockSession } from './session.js';
import { createBlockPreview } from './editor-renderer.js';
import { renderBlockInspector } from './editor-inspector.js';
import { blockButton, flushBlockFields } from './editor-fields.js';
import { installEditorWorkspace } from '../ui/editor-workspace.js';
import { installEditorSurface } from '../ui/editor-surface.js';
import { installInspectorRail } from '../ui/inspector-rail.js';
/** Detached editing: save is supplied by the library/application transaction owner. */
let editorSequence = 0;
export class BlockEditor {
  constructor() {
    this.dialog = document.createElement('dialog');
    this.dialog.id = `block-editor-${++editorSequence}`;
    this.dialog.className = 'block-editor';
    const header = document.createElement('header'),
      title = document.createElement('strong');
    title.textContent = 'Parametriskt block';
    header.append(
      title,
      blockButton('Tillbaka', () => this.dialog.close()),
    );
    const body = document.createElement('div');
    body.className = 'block-editor-body';
    this.host = document.createElement('div');
    this.host.className = 'block-editor-preview';
    const inspector = document.createElement('aside');
    this.panels = Object.fromEntries(
      ['parameters', 'references', 'bindings', 'anchors'].map((id) => [
        id,
        document.createElement('section'),
      ]),
    );
    body.append(this.host, inspector);
    this.dialog.append(header, body);
    document.body.append(this.dialog);
    this.rail = installInspectorRail(
      inspector,
      [
        { id: 'parameters', label: 'Parametrar', icon: 'settings', panel: this.panels.parameters },
        { id: 'references', label: 'Referenser', icon: 'grid', panel: this.panels.references },
        { id: 'bindings', label: 'Låsningar', icon: 'lock', panel: this.panels.bindings },
        { id: 'anchors', label: 'Insättningspunkter', icon: 'origin', panel: this.panels.anchors },
      ],
      this.dialog.id,
    );
    inspector.addEventListener('focusin', (event) => {
      const reference = event.target.closest('[data-block-reference]')?.dataset.blockReference;
      const parameter = event.target.closest('[data-block-parameter]')?.dataset.blockParameter;
      if (reference) this.highlight([reference]);
      else if (parameter && this.session) {
        const token = new RegExp(`\\b${parameter}\\b`);
        this.highlight(
          this.session.definition.references
            .filter((r) => token.test(String(r.value)))
            .map((r) => r.id),
        );
      }
    });
    const ribbon = document.createElement('div');
    this.saveButton = blockButton('Spara block', () => this.save());
    this.undoButton = blockButton('Ångra', () => this.run(() => this.session.undo()));
    this.redoButton = blockButton('Gör om', () => this.run(() => this.session.undo(true)));
    installEditorWorkspace(this.dialog, {
      ribbon,
      groups: [
        { label: 'Block', items: [{ node: this.saveButton, size: 'large', icon: 'save' }] },
        {
          label: 'Kontroll',
          items: [
            { node: this.undoButton, icon: 'undo' },
            { node: this.redoButton, icon: 'redo' },
            { node: blockButton('Standardvärden', () => this.run(() => this.session.test({}))) },
            {
              node: blockButton('Passa in', () => {
                this.preview.fit();
                this.refresh();
              }),
              icon: 'fit',
            },
          ],
        },
      ],
    });
    this.message = document.createElement('div');
    this.message.setAttribute('role', 'status');
    installEditorSurface(this.dialog, { layout: body, inspector, status: this.message });
    this.dialog.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.dialog.close();
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'z' &&
        !event.target.closest('input,textarea')
      ) {
        event.preventDefault();
        this.run(() => this.session.undo(event.shiftKey));
      }
    });
    this.dialog.addEventListener('close', () => {
      cancelAnimationFrame(this.refreshFrame);
      this.preview?.dispose();
      this.preview = null;
      this.session?.release();
      this.session = null;
      this.onSave = null;
      this.points.clear();
      this.bindingDraft = { referenceId: '', offset: '0' };
      Object.values(this.panels).forEach((panel) => panel.replaceChildren());
    });
  }
  open(definition, onSave) {
    if (this.dialog.open) throw Error('Avsluta den öppna blockeditorn först.');
    this.session = new BlockSession(definition, validateBlockGeometry);
    this.onSave = onSave;
    this.points = new Set();
    this.bindingDraft = { referenceId: '', offset: '0' };
    this.highlighted = [];
    this.message.textContent =
      'Shift-klick väljer fler punkter · Klicka på en referens för att koppla';
    this.saveButton.disabled = false;
    this.dialog.showModal();
    this.preview = createBlockPreview(
      this.host,
      definition.dimension,
      (point, additive) => this.selectPoint(point, true, additive),
      (text) => (this.message.textContent = text),
      (id) => {
        if (this.points.size) {
          this.bindingDraft.referenceId = id;
          this.rail.show('bindings');
          this.refresh();
          return;
        }
        this.rail.show('references');
        this.highlight([id]);
        const section = [...this.panels.references.querySelectorAll('[data-block-reference]')].find(
          (node) => node.dataset.blockReference === id,
        );
        if (section) section.open = true;
        section?.scrollIntoView({ block: 'nearest' });
        section?.querySelector('input')?.focus({ preventScroll: true });
      },
    );
    this.rail.show('parameters');
    this.refresh();
  }
  run(action) {
    try {
      action();
      this.message.textContent =
        'Shift-klick väljer fler punkter · Klicka på en referens för att koppla';
      // A field commit can fire before the next field receives focus. Rebuild
      // after that pointer/focus sequence, retaining any uncommitted text.
      cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = requestAnimationFrame(() => this.refresh());
      return true;
    } catch (error) {
      this.message.textContent = error.message;
      return false;
    }
  }
  highlight(ids) {
    if (!this.session) return;
    this.highlighted = ids;
    this.preview.render(this.session.definition, this.session.evaluate(), this.points, ids);
  }
  selectPoint(point, show = false, additive = false) {
    if (!blockPoints(this.session.definition).some((p) => p.key === point)) return;
    if (additive) {
      if (this.points.has(point)) this.points.delete(point);
      else this.points.add(point);
    } else this.points = new Set([point]);
    if (!this.bindingDraft.referenceId) {
      const definition = this.session.definition;
      const binding = definition.bindings
        .filter((b) => `${b.memberId}:${b.pointIndex}` === point)
        .sort(
          (a, b) =>
            definition.references.find((r) => r.id === a.referenceId).axis -
            definition.references.find((r) => r.id === b.referenceId).axis,
        )[0];
      if (binding)
        this.bindingDraft = { referenceId: binding.referenceId, offset: String(binding.offset) };
    }
    if (show) this.rail.show('bindings');
    this.refresh();
  }
  stageBinding(patch) {
    Object.assign(this.bindingDraft, patch);
    cancelAnimationFrame(this.refreshFrame);
    this.refreshFrame = requestAnimationFrame(() => this.refresh());
    return true;
  }
  applyBinding(axis) {
    this.run(() => {
      flushBlockFields(this.panels.bindings);
      const edit = axis === undefined ? this.bindingDraft : { axis };
      const next = withPointBindings(
        this.session.definition,
        [...this.points],
        edit,
        this.session.values,
      );
      if (JSON.stringify(next) !== JSON.stringify(this.session.definition))
        this.session.change((definition) => Object.assign(definition, next));
    });
  }
  refresh() {
    if (!this.session) return;
    const controls = () => [...this.dialog.querySelectorAll('section input,section select')],
      before = controls(),
      focus = before.indexOf(document.activeElement),
      pending = before.flatMap((control, index) =>
        control.hasAttribute('data-block-pending') ? [{ index, value: control.value }] : [],
      ),
      scroll = Object.values(this.panels).map((panel) => panel.scrollTop);
    const result = this.session.evaluate(),
      definition = this.session.definition;
    this.undoButton.disabled = !this.session.past.length;
    this.redoButton.disabled = !this.session.future.length;
    const valid = new Set(blockPoints(definition).map((p) => p.key));
    this.points = new Set([...this.points].filter((p) => valid.has(p)));
    if (!definition.references.some((r) => r.id === this.bindingDraft.referenceId))
      this.bindingDraft.referenceId = '';
    renderBlockInspector({
      panels: this.panels,
      definition,
      result,
      points: this.points,
      draft: this.bindingDraft,
      stage: (patch) => this.stageBinding(patch),
      apply: () => this.applyBinding(),
      release: (axis) => this.applyBinding(axis),
      change: (edit) => this.run(() => this.session.change(edit)),
      test: (name, value) =>
        this.run(() => this.session.test({ ...this.session.values, [name]: value })),
      selectPoint: (point, show, additive) => this.selectPoint(point, show, additive),
    });
    if (!this.panels.bindings.hidden && this.points.size)
      this.highlighted = this.bindingDraft.referenceId
        ? [this.bindingDraft.referenceId]
        : definition.bindings
            .filter((b) => this.points.has(`${b.memberId}:${b.pointIndex}`))
            .map((b) => b.referenceId);
    this.preview.render(
      definition,
      result,
      this.points,
      this.highlighted,
      !this.panels.bindings.hidden ? this.bindingDraft.referenceId : null,
    );
    const after = controls();
    if (before.length === after.length) {
      for (const { index, value } of pending) {
        after[index].value = value;
        after[index].dataset.blockPending = '';
      }
      if (focus >= 0) after[focus]?.focus({ preventScroll: true });
    }
    Object.values(this.panels).forEach((panel, index) => (panel.scrollTop = scroll[index]));
  }
  async save() {
    if (this.saveButton.disabled) return;
    const session = this.session;
    this.saveButton.disabled = true;
    try {
      flushBlockFields(this.dialog);
      session.evaluate();
      await this.onSave(structuredClone(session.definition));
      if (this.session === session) this.dialog.close();
    } catch (error) {
      if (this.session === session) {
        this.message.textContent = error.message;
        this.saveButton.disabled = false;
      }
    }
  }
}
