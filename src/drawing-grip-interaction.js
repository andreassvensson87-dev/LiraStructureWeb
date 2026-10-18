// One pointer lifecycle for all drawing grips. Adapters own preview/commit/cancel.
export class DrawingGripInteraction {
  constructor(editor) {
    this.editor = editor;
    const dialog = editor.dialog;
    dialog.addEventListener('pointerdown', (event) => this.down(event), true);
    dialog.addEventListener('pointermove', (event) => this.move(event), true);
    dialog.addEventListener('pointerup', (event) => this.up(event), true);
    dialog.addEventListener('pointercancel', () => this.cancel(), true);
    dialog.addEventListener('keydown', (event) => this.key(event), true);
    dialog.addEventListener('close', () => this.cancel());
    dialog.ownerDocument?.defaultView?.addEventListener('blur', () => this.cancel());
  }
  stop(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  down(event) {
    if (event.button !== 0) return;
    if (this.session || this.editor.mode) return;
    let grip = event.target.closest('.cad-grip');
    if (grip) {
      let nearest = Infinity;
      for (const candidate of this.editor.dialog.querySelectorAll('.cad-grip')) {
        const box = candidate.getBoundingClientRect();
        if (
          candidate.ownerDocument.defaultView.getComputedStyle(candidate).visibility === 'hidden' ||
          !box.width ||
          !box.height ||
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          continue;
        const distance = Math.hypot(
          event.clientX - (box.left + box.width / 2),
          event.clientY - (box.top + box.height / 2),
        );
        if (distance < nearest) {
          grip = candidate;
          nearest = distance;
        }
      }
    }
    if (!grip) return;
    const session = this.editor.beginGrip(event, grip);
    if (!session) return;
    this.stop(event);
    this.session = {
      ...session,
      key: grip.dataset.gripKey,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    this.capture = this.editor.adapter.paper || this.editor.surface;
    this.capture.setPointerCapture(event.pointerId);
    this.editor.surface.setAttribute('tabindex', '-1');
    this.editor.surface.focus({ preventScroll: true });
    this.editor.dynamicInput.querySelector('input').value = '';
    this.feedback();
  }
  update(event) {
    const s = this.session;
    try {
      const hit = s.locate(event);
      if (!hit) {
        s.valid = false;
        return false;
      }
      s.apply(hit);
      s.hit = hit;
      this.editor.hover = hit;
      s.valid = true;
      s.preview();
      this.feedback();
      return true;
    } catch (error) {
      s.valid = false;
      this.editor.hint.textContent = error.message;
      return false;
    }
  }
  move(event) {
    const s = this.session;
    if (!s || event.pointerId !== s.id) return;
    this.stop(event);
    if (!s.moved && Math.hypot(event.clientX - s.x, event.clientY - s.y) < 3) return;
    s.moved = true;
    this.update(event);
  }
  release() {
    const id = this.session?.id;
    if (id !== undefined && this.capture?.hasPointerCapture(id))
      this.capture.releasePointerCapture(id);
  }
  up(event) {
    const s = this.session;
    if (!s || event.pointerId !== s.id) return;
    this.stop(event);
    this.release();
    if (s.moved && this.update(event)) this.finish();
    else this.cancel();
  }

  feedback() {
    const s = this.session;
    if (!s) return;
    for (const node of this.editor.dialog.querySelectorAll('.cad-grip'))
      node.classList.toggle('is-active', node.dataset.gripKey === s.key);
    this.editor.hint.textContent = `${s.label} · dra greppet · Esc avbryter`;
    const form = this.editor.dynamicInput;
    if (form) {
      form.hidden = !s.numeric;
      if (s.numeric) {
        form.querySelector('.ui-exact-length-label span').textContent = s.numeric.label;
        form.querySelector('input').setAttribute('aria-label', s.numeric.label);
      }
    }
  }
  submit(value) {
    const s = this.session;
    if (!s?.numeric) return;
    try {
      const number = Number(value.replace(',', '.'));
      if (!value.trim() || !Number.isFinite(number) || number <= 0)
        throw Error('Ange ett positivt mått i mm.');
      s.apply(s.numeric.hit(number));
      s.preview();
      this.finish();
    } catch (error) {
      this.editor.hint.textContent = error.message;
    }
  }
  key(event) {
    if (!this.session) return;
    if (event.key === 'Escape') {
      this.stop(event);
      this.cancel();
    } else if (
      this.session.numeric &&
      !event.target.closest('input,select,textarea,[contenteditable="true"]') &&
      /^[0-9+.,-]$/.test(event.key)
    ) {
      this.stop(event);
      const input = this.editor.dynamicInput.querySelector('input');
      input.value = event.key;
      input.focus();
    }
  }
  finish() {
    const s = this.session;
    this.release();
    this.session = null;
    s.commit();
    this.clear();
  }
  cancel() {
    const s = this.session;
    if (!s) return;
    this.release();
    this.session = null;
    s.cancel();
    this.clear();
  }
  clear() {
    for (const node of this.editor.dialog.querySelectorAll('.cad-grip.is-active'))
      node.classList.remove('is-active');
    this.editor.dynamicInput.hidden = true;
    this.editor.hover = null;
    this.editor.tracking?.reset();
    this.editor.ui();
    this.editor.adapter.redraw();
  }
}
