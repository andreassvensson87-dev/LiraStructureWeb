import { actionButton } from './drawing-toolbar.js';
import { shapeSnapPoints } from './drawing-shapes.js';

export function rotatedShapes(items, ids, center, angle) {
  const chosen = items.filter((item) => ids.includes(item.id));
  if (
    !chosen.length ||
    chosen.some((item) => item.type !== 'shape' || item.view !== chosen[0].view)
  )
    throw Error('Välj ritad geometri i samma vy.');
  if (
    !center?.every(Number.isFinite) ||
    !Number.isFinite(angle) ||
    Math.abs(angle % (2 * Math.PI)) < 1e-9
  )
    throw Error('Ange en vinkel som ändrar objektens riktning.');
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return chosen.map((item) => ({
    ...structuredClone(item),
    ...(item.shape === 'rectangle' ? { shape: 'polyline', closed: true } : {}),
    points: shapeSnapPoints(item).map(([x, y]) => [
      center[0] + (x - center[0]) * c - (y - center[1]) * s,
      center[1] + (x - center[0]) * s + (y - center[1]) * c,
    ]),
  }));
}

export function rotationAngle(center, reference, target) {
  if ([reference, target].some((p) => Math.hypot(p[0] - center[0], p[1] - center[1]) < 1e-7))
    throw Error('Välj en riktning en bit från rotationscentrum.');
  const angle =
    Math.atan2(target[1] - center[1], target[0] - center[0]) -
    Math.atan2(reference[1] - center[1], reference[0] - center[0]);
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function translatedShapes(items, ids, from, to, copy = false) {
  const chosen = items.filter((item) => ids.includes(item.id));
  if (
    !chosen.length ||
    chosen.some((item) => item.type !== 'shape' || item.view !== chosen[0].view)
  )
    throw Error('Välj ritad geometri i samma vy.');
  const delta = to.map((v, i) => v - from[i]);
  if (delta.length !== 2 || !delta.every(Number.isFinite) || Math.hypot(...delta) < 1e-7)
    throw Error('Välj en annan tillpunkt.');
  return chosen.map((item) => ({
    ...structuredClone(item),
    id: copy ? crypto.randomUUID() : item.id,
    points: item.points.map((point) => point.map((v, i) => v + delta[i])),
  }));
}

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
    this.ids = selected?.type === 'shape' ? [selected.id] : [];
    this.view = selected?.type === 'shape' ? selected.view : null;
    this.phase = 'select';
    this.base = null;
    this.reference = null;
    this.numericAngle = null;
    this.editor.start(mode);
  }
  ui(message) {
    const a = this.editor;
    a.panel.replaceChildren();
    const title = document.createElement('h3');
    const rotate = a.mode === 'rotate-shapes';
    title.textContent = rotate
      ? 'Rotera geometri'
      : a.mode === 'copy-shapes'
        ? 'Kopiera geometri'
        : 'Flytta geometri';
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
            rotatedShapes(a.items, this.ids, this.base, (this.numericAngle * Math.PI) / 180),
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
    a.hint.textContent =
      message ||
      (this.phase === 'select'
        ? 'Klicka på ritade objekt för flerval · klick igen tar bort valet · Enter fortsätter'
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
      if (item?.type !== 'shape') {
        this.ui('Välj linjer, cirklar eller annan ritad geometri.');
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
    a.selected = result.length === 1 ? result[0].id : null;
    a.cancel();
  }
  render(layer) {
    if (this.editor.mode === 'rotate-shapes' && this.base) {
      this.editor.dot(layer, this.base, this.view);
      try {
        const angle =
          this.numericAngle !== null
            ? (this.numericAngle * Math.PI) / 180
            : this.reference && this.editor.hover
              ? rotationAngle(this.base, this.reference, this.editor.hover.point)
              : null;
        if (angle !== null)
          for (const item of rotatedShapes(this.editor.items, this.ids, this.base, angle))
            this.editor.paint(layer, item, true);
      } catch {
        /* A coincident or zero angle has no preview. */
      }
      return;
    }
    if (this.phase !== 'destination' || !this.editor.hover) return;
    try {
      for (const item of translatedShapes(
        this.editor.items,
        this.ids,
        this.base,
        this.editor.hover.point,
      ))
        this.editor.paint(layer, item, true);
    } catch {
      /* Coincident points have no preview. */
    }
  }
}
