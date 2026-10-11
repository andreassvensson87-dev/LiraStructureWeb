import { actionButton } from './drawing-toolbar.js';
import { lengthPoint } from './frame-model.js';

import {
  translatedShapes,
  rotatedShapes,
  rotationAngle,
  transformableDrawingObject,
} from './drawing-object-transform.js';
export { translatedShapes, rotatedShapes, rotationAngle } from './drawing-object-transform.js';

export class DrawingShapeTransform {
  constructor(editor, toolbar) {
    this.editor = editor;
    this.ids = [];
    for (const [mode, name] of [
      ['move-shapes', 'Flytta'],
      ['copy-shapes', 'Kopiera'],
      ['rotate-shapes', 'Rotera'],
    ]) {
      const button = actionButton(
        document.createElement('button'),
        mode === 'move-shapes' ? 'move' : mode === 'copy-shapes' ? 'copy' : 'rotate',
        name,
      );
      button.dataset.drawingGroup = 'modify';
      button.dataset.drawingCategory = 'Placering';
      button.dataset.annotationMode = mode;
      const key = { 'move-shapes': 'M', 'copy-shapes': 'C', 'rotate-shapes': 'R' }[mode];
      button.title = `${name} · Ctrl/⌘ + ${key}`;
      button.setAttribute('aria-keyshortcuts', `Control+${key} Meta+${key}`);
      button.onclick = () => this.start(mode);
      toolbar.append(button);
      editor.toolButtons.push(button);
    }
  }
  active() {
    return ['move-shapes', 'copy-shapes', 'rotate-shapes'].includes(this.editor.mode);
  }
  start(mode) {
    const selected = this.editor.item();
    this.ids = [
      ...(this.editor.selectedIds?.size
        ? this.editor.selectedIds
        : new Set(selected ? [selected.id] : [])),
    ].filter((id) => transformableDrawingObject(this.editor.items.find((item) => item.id === id)));
    if (
      new Set(
        this.editor.items.filter((item) => this.ids.includes(item.id)).map((item) => item.view),
      ).size > 1
    ) {
      this.editor.hint.textContent = 'Välj ritobjekt i samma vy eller text på bladet.';
      return;
    }
    this.view = this.ids.length ? selected.view : null;
    this.phase = this.ids.length ? 'base' : 'select';
    this.base = null;
    this.reference = null;
    this.numericAngle = null;
    this.exactDistance = null;
    if (this.editor.dynamicInput) this.editor.dynamicInput.querySelector('input').value = '';
    this.editor.start(mode);
  }
  ui(message) {
    const a = this.editor;
    a.panel.replaceChildren();
    const title = document.createElement('h3');
    const rotate = a.mode === 'rotate-shapes';
    title.textContent = rotate
      ? 'Rotera ritobjekt'
      : a.mode === 'copy-shapes'
        ? 'Kopiera ritobjekt'
        : 'Flytta ritobjekt';
    const count = document.createElement('p');
    count.textContent = `${this.ids.length} objekt valda`;
    a.panel.append(title, count);
    const button = (label, action, disabled = false) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.disabled = disabled;
      b.onclick = action;
      a.panel.append(b);
    };
    if (this.phase === 'select')
      button(
        rotate ? 'Välj rotationscentrum ↵' : 'Välj från-punkt ↵',
        () => this.finishSelection(),
        !this.ids.length,
      );
    else
      button('Ändra urval', () => {
        this.phase = 'select';
        this.base = null;
        this.reference = null;
        this.numericAngle = null;
        a.hover = null;
        a.ui();
        a.adapter.redraw();
      });
    if (this.ids.some((id) => a.items.find((item) => item.id === id)?.references?.some(Boolean))) {
      const note = document.createElement('p');
      note.textContent =
        'Transformerade fästpunkter blir fristående från modellen. Ångra återställer kopplingarna.';
      a.panel.append(note);
    }
    if (rotate && this.base) {
      const label = document.createElement('label'),
        input = document.createElement('input');
      label.textContent = 'Vinkel · °';
      input.type = 'number';
      input.step = 'any';
      input.placeholder = 'Exempel: 90';
      input.value = this.numericAngle === null ? '' : this.numericAngle;
      label.append(input);
      a.panel.append(label);
      const apply = document.createElement('button');
      apply.textContent = 'Rotera med vinkel';
      apply.disabled = this.numericAngle === null;
      input.oninput = () => {
        this.numericAngle =
          input.value.trim() && Number.isFinite(+input.value) ? +input.value : null;
        apply.disabled = this.numericAngle === null;
        a.adapter.redraw();
      };
      const applyAngle = () => {
        if (this.numericAngle === null) return;
        try {
          this.commit(
            rotatedShapes(
              a.items,
              this.ids,
              this.base,
              ((this.numericAngle * Math.PI) / 180) * (this.view === 'paper' ? -1 : 1),
            ),
          );
        } catch (error) {
          this.ui(error.message);
        }
      };
      apply.onclick = applyAngle;
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyAngle();
        }
      };
      a.panel.append(apply);
      button('Välj vinkel med musen', () => {
        this.numericAngle = null;
        this.reference = null;
        this.phase = 'angle-reference';
        a.hover = null;
        a.ui();
        a.surface.focus({ preventScroll: true });
        a.adapter.redraw();
      });
    }
    button('Avbryt · Esc', () => a.cancel());
    button('Ångra', () => a.undo(), !a.history.length);
    button('Gör om', () => a.undo(true), !a.future.length);
    if (a.dynamicInput) {
      a.dynamicInput.hidden = !(this.base && (rotate || this.phase === 'destination'));
      a.dynamicInput.querySelector('.ui-exact-length-field span').textContent = rotate ? '°' : 'mm';
      a.dynamicInput
        .querySelector('input')
        .setAttribute('aria-label', rotate ? 'Exakt vinkel · grader' : 'Exakt längd · mm');
      a.dynamicInput.querySelector('.ui-exact-length-label span').textContent = rotate
        ? 'Vinkel · °'
        : 'Längd · mm';
    }
    a.hint.textContent =
      message ||
      (this.phase === 'select'
        ? 'Klicka på ritobjekt för flerval · klick igen tar bort valet · Enter fortsätter'
        : this.phase === 'base'
          ? rotate
            ? 'Klicka rotationscentrum · snappning till hörn och ändpunkter'
            : 'Klicka från-punkt · snappning till hörn och ändpunkter'
          : this.phase === 'angle-reference'
            ? 'Ange vinkel i panelen eller klicka start­riktning från centrum'
            : rotate
              ? 'Klicka slutriktning för att rotera · Esc avbryter'
              : 'Klicka tillpunkt · Esc avbryter');
  }
  finishSelection() {
    if (!this.ids.length || this.phase !== 'select') return;
    this.phase = 'base';
    this.editor.hover = null;
    this.editor.ui();
    this.editor.surface.focus({ preventScroll: true });
    this.editor.adapter.redraw();
  }
  down(e) {
    const a = this.editor;
    if (this.phase === 'select') {
      const id = e.target.closest('[data-annotation]')?.dataset.annotation;
      const item = a.items.find((item) => item.id === id);
      if (!transformableDrawingObject(item)) {
        this.ui('Välj ritad geometri, text, mått eller hänvisningar.');
        return;
      }
      if (this.ids.length && item.view !== this.view) {
        this.ui('Välj objekt i samma ritningsvy.');
        return;
      }
      this.ids = this.ids.includes(id)
        ? this.ids.filter((value) => value !== id)
        : [...this.ids, id];
      this.view = this.ids.length ? item.view : null;
      a.ui();
    } else {
      const hit = a.location(e, this.view, true);
      if (!hit || hit.view !== this.view) return;
      if (this.phase === 'base') {
        this.base = [...hit.point];
        this.phase = a.mode === 'rotate-shapes' ? 'angle-reference' : 'destination';
        a.hover = null;
        a.ui();
      } else if (this.phase === 'angle-reference') {
        if (Math.hypot(hit.point[0] - this.base[0], hit.point[1] - this.base[1]) < 1e-7) {
          this.ui('Välj en riktning en bit från rotationscentrum.');
          return;
        }
        this.reference = [...hit.point];
        this.numericAngle = null;
        this.phase = 'destination';
        a.ui();
      } else {
        try {
          const copy = a.mode === 'copy-shapes';
          const result =
            a.mode === 'rotate-shapes'
              ? rotatedShapes(
                  a.items,
                  this.ids,
                  this.base,
                  rotationAngle(this.base, this.reference, hit.point),
                )
              : translatedShapes(a.items, this.ids, this.base, hit.point, copy);
          this.commit(result);
        } catch (error) {
          this.ui(error.message);
        }
      }
    }
    a.adapter.redraw();
  }
  commit(result) {
    const a = this.editor;
    a.checkpoint();
    if (a.mode === 'copy-shapes') a.items.push(...result);
    else
      for (const item of result)
        Object.assign(
          a.items.find((original) => original.id === item.id),
          item,
        );
    a.selected = result.at(-1).id;
    a.selectedIds = new Set(result.map((item) => item.id));
    a.cancel();
  }
  submit(value) {
    try {
      const rotate = this.editor.mode === 'rotate-shapes';
      const number = Number(String(value).replace(',', '.'));
      if (!Number.isFinite(number) || !String(value).trim()) throw Error('Ange ett giltigt värde.');
      const result = rotate
        ? rotatedShapes(
            this.editor.items,
            this.ids,
            this.base,
            ((number * Math.PI) / 180) * (this.view === 'paper' ? -1 : 1),
          )
        : translatedShapes(
            this.editor.items,
            this.ids,
            this.base,
            lengthPoint(this.base, this.editor.hover?.point || this.base, value),
            this.editor.mode === 'copy-shapes',
          );
      this.commit(result);
      this.editor.dynamicInput.querySelector('input').value = '';
      this.editor.surface.focus({ preventScroll: true });
    } catch (error) {
      this.ui(error.message);
    }
  }
  preview() {
    if (!this.base) return [];
    try {
      if (this.editor.mode === 'rotate-shapes') {
        const angle =
          this.numericAngle !== null
            ? ((this.numericAngle * Math.PI) / 180) * (this.view === 'paper' ? -1 : 1)
            : this.reference && this.editor.hover
              ? rotationAngle(this.base, this.reference, this.editor.hover.point)
              : null;
        return angle === null ? [] : rotatedShapes(this.editor.items, this.ids, this.base, angle);
      }
      return this.phase === 'destination' && this.editor.hover
        ? translatedShapes(
            this.editor.items,
            this.ids,
            this.base,
            this.exactDistance
              ? lengthPoint(this.base, this.editor.hover.point, this.exactDistance)
              : this.editor.hover.point,
          )
        : [];
    } catch {
      return [];
    }
  }
  render(layer) {
    for (const item of this.preview()) this.editor.paint(layer, item, false, true);
  }
}
