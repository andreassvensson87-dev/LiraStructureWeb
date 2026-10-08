import * as THREE from 'three';
import { gridLabel, GRID_LABEL_MAX_LENGTH } from '../grid-labels.js';
import { addGridLine, changeGridLine, removeGridLine, gridSegmentDistance } from '../grid-edit.js';

/** Owns grid gestures only while explicitly activated. Project changes occur on confirmation. */
export function createGridModelEditor({
  host,
  camera,
  grid,
  project,
  getControls,
  elevation,
  begin,
  checkpoint,
  changed,
  invalidate,
  status,
  undo,
}) {
  const bar = document.createElement('div');
  bar.className = 'grid-edit-bar';
  bar.hidden = true;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Redigera stomlinjer');
  bar.innerHTML = `<strong><i></i>Stomlinjer</strong><button type="button" data-move aria-pressed="true">↔ Flytta</button><button type="button" data-add aria-pressed="false">+ Ny</button><button type="button" data-remove title="Ta bort stomlinje" aria-label="Ta bort stomlinje">⌫</button><span class="grid-edit-separator"></span><label>Riktning<select data-grid-axis aria-label="Stomlinjeriktning"><option value="x">X</option><option value="y">Y</option></select></label><label>Linje<input data-label aria-label="Stomlinjebeteckning" maxlength="${GRID_LABEL_MAX_LENGTH}"></label><label>Position<input data-position aria-label="Stomlinjeposition" type="number" step="any"><small>mm</small></label><button type="button" data-snap aria-pressed="true" title="Snapping" aria-label="Snapping">⌁</button><small class="grid-edit-escape">Esc</small><button type="button" data-done class="primary">Klar</button>`;
  host.append(bar);
  const $ = (selector) => bar.querySelector(selector);
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'grid-edit-handle';
  handle.hidden = true;
  handle.textContent = '↔';
  handle.setAttribute('aria-label', 'Dra markerad stomlinje');
  host.append(handle);
  const hint = document.createElement('div');
  hint.className = 'grid-edit-delta';
  hint.hidden = true;
  host.append(hint);
  const note = document.createElement('p');
  note.className = 'grid-edit-lock-note';
  note.hidden = true;
  note.textContent = 'Modellen är låst under stomlinjeredigering.';
  document.getElementById('inspector-model').prepend(note);
  let active = false,
    selection = null,
    drag = null,
    adding = false,
    snapping = true,
    locks = [];
  const ray = new THREE.Raycaster();
  const controls = () => getControls();
  function point(e) {
    const r = host.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        1 - ((e.clientY - r.top) / r.height) * 2,
      ),
      camera,
    );
    const p = ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -elevation()),
      new THREE.Vector3(),
    );
    return p;
  }
  function display(data = project.grid) {
    grid.set({ ...data, z: elevation() });
    grid.overlay.classList.toggle('grid-editable', active);
    grid.overlay.setAttribute('aria-hidden', String(!active));
    for (const { el, id } of grid.labels) {
      if (active) {
        el.dataset.gridId = id;
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.setAttribute('aria-label', `Stomlinje ${el.textContent}`);
      }
    }
    grid.highlight(selection ? [`${selection.axis}:${selection.index}`] : []);
    invalidate();
  }
  function fields() {
    const selected = selection && project.grid[selection.axis]?.[selection.index] !== undefined;
    $('[data-label]').disabled = $('[data-position]').disabled = !selected || adding;
    $('[data-remove]').disabled = !selected || adding || project.grid[selection.axis].length <= 2;
    $('[data-label]').value = selected
      ? gridLabel(project.grid, selection.axis, selection.index)
      : '';
    $('[data-position]').value = selected ? project.grid[selection.axis][selection.index] : '';
    if (selected && !adding) $('[data-grid-axis]').value = selection.axis;
    $('[data-move]').setAttribute('aria-pressed', String(!adding));
    $('[data-add]').setAttribute('aria-pressed', String(adding));
    handle.hidden = !selected || adding;
  }
  function message(text) {
    status(text);
  }
  function commit(result, axis) {
    if (JSON.stringify(project.grid) !== JSON.stringify(result.grid)) {
      checkpoint();
      project.grid = result.grid;
      selection = result.index >= 0 ? { axis, index: result.index } : null;
      changed();
    }
    display();
    fields();
  }
  function snap(value) {
    if (!snapping) return value;
    const step = project.snap.gridStep || 100;
    return Math.round(value / step) * step;
  }
  function pick(e) {
    const bubble = e.target.closest?.('[data-grid-id]');
    if (bubble && grid.overlay.contains(bubble)) {
      const [axis, index] = bubble.dataset.gridId.split(':');
      return { axis, index: Number(index) };
    }
    const r = host.getBoundingClientRect(),
      p = [e.clientX - r.left, e.clientY - r.top];
    let hit = null,
      distance = 9;
    for (const line of grid.group.children) {
      const positions = line.geometry.attributes.position;
      const ends = [0, 1].map((i) =>
        new THREE.Vector3().fromBufferAttribute(positions, i).project(camera),
      );
      if (ends.some((p) => Math.abs(p.z) > 1)) continue;
      const d = gridSegmentDistance(
        p,
        ...ends.map((p) => [((p.x + 1) * r.width) / 2, ((1 - p.y) * r.height) / 2]),
      );
      if (d < distance) {
        distance = d;
        const [axis, index] = line.userData.gridId.split(':');
        hit = { axis, index: Number(index) };
      }
    }
    return hit;
  }
  function cancelDrag() {
    if (!drag) return false;
    const previous = drag;
    drag = null;
    controls().enabled = previous.controlsEnabled;
    if (host.hasPointerCapture(previous.id)) host.releasePointerCapture(previous.id);
    if (previous.ghost) {
      previous.ghost.removeFromParent();
      previous.ghost.geometry.dispose();
      previous.ghost.material.dispose();
    }
    hint.hidden = true;
    display();
    fields();
    return true;
  }
  function finish() {
    cancelDrag();
    active = false;
    selection = null;
    adding = false;
    for (const [element, inert] of locks) element.inert = inert;
    locks = [];
    bar.hidden = handle.hidden = note.hidden = true;
    host.classList.remove('grid-editing');
    display();
    message('Stomlinjer klara · Modellering aktiverad');
  }
  function start() {
    if (active) return;
    begin();
    active = true;
    selection = null;
    adding = false;
    locks = [
      ...document.querySelectorAll(
        '.toolbox, aside, .level-controls, #work-plane, #work-plane-view, header button:not(#undo):not(#redo), header details',
      ),
    ].map((element) => [element, element.inert]);
    for (const [element] of locks) element.inert = true;
    host.classList.add('grid-editing');
    bar.hidden = note.hidden = false;
    display();
    fields();
    message('Redigerar stomlinjer · Dra en linje eller bubbla · Esc avslutar');
  }
  function down(e) {
    if (!active || e.button !== 0 || bar.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (adding) {
      const p = point(e);
      if (!p) {
        message('Byt till ovanifrån för att placera stomlinjen.');
        return;
      }
      const axis = $('[data-grid-axis]').value;
      try {
        commit(addGridLine(project.grid, axis, snap(p[axis])), axis);
        adding = false;
        fields();
        message('Stomlinje tillagd · Kan ångras');
      } catch (error) {
        message(error.message);
      }
      return;
    }
    const hit = e.target === handle ? selection : pick(e);
    selection = hit;
    display();
    fields();
    if (!hit) return;
    const p = point(e);
    if (!p) {
      message('Byt till ovanifrån eller ange position i menyn.');
      return;
    }
    const line = grid.group.children.find(
      (line) => line.userData.gridId === `${hit.axis}:${hit.index}`,
    );
    const ghost = new THREE.Line(
      line.geometry.clone(),
      new THREE.LineDashedMaterial({
        color: 0x16815e,
        dashSize: 100,
        gapSize: 180,
        transparent: true,
        opacity: 0.4,
      }),
    );
    ghost.computeLineDistances();
    grid.group.parent.add(ghost);
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: p[hit.axis],
      source: project.grid[hit.axis][hit.index],
      result: null,
      moved: false,
      controlsEnabled: controls().enabled,
      ghost,
    };
    controls().enabled = false;
    host.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!active || bar.contains(e.target)) return;
    if (e.buttons === 0 || drag) e.stopImmediatePropagation();
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3 && !drag.moved) return;
    const p = point(e);
    if (!p) return;
    drag.moved = true;
    const axis = selection.axis,
      position = snap(drag.source + p[axis] - drag.start);
    try {
      drag.result = changeGridLine(project.grid, axis, selection.index, { position });
      const selected = selection;
      selection = { axis, index: drag.result.index };
      display(drag.result.grid);
      selection = selected;
      $('[data-position]').value = position;
      hint.textContent = `${position - drag.source > 0 ? '+' : ''}${+(position - drag.source).toFixed(3)} mm`;
      hint.style.left = `${e.clientX - host.getBoundingClientRect().left + 18}px`;
      hint.style.top = `${e.clientY - host.getBoundingClientRect().top + 18}px`;
      hint.hidden = false;
    } catch (error) {
      drag.result = null;
      hint.hidden = true;
      display();
      message(error.message);
    }
    invalidate();
  }
  function up(e) {
    if (!active || e.button !== 0 || bar.contains(e.target)) return;
    e.stopImmediatePropagation();
    if (drag?.id !== e.pointerId) return;
    const result = drag.result,
      axis = selection.axis;
    cancelDrag();
    if (result) {
      commit(result, axis);
      message('Stomlinje flyttad · Kan ångras');
    }
  }
  host.addEventListener('pointerdown', down, true);
  host.addEventListener('pointermove', move, true);
  host.addEventListener('pointerup', up, true);
  host.addEventListener('pointercancel', () => cancelDrag(), true);
  host.addEventListener('lostpointercapture', () => cancelDrag());
  window.addEventListener('blur', cancelDrag);
  document.addEventListener(
    'keydown',
    (e) => {
      if (!active) return;
      const editing = e.target.matches?.('input,select,textarea');
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!cancelDrag()) finish();
        return;
      }
      if (!editing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelDrag();
        undo(e.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (!editing && ['Delete', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        $('[data-remove]').click();
        return;
      }
      if (e.target.dataset?.gridId && ['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        const [axis, index] = e.target.dataset.gridId.split(':');
        selection = { axis, index: Number(index) };
        display();
        fields();
        return;
      }
      if (e.key === 'Enter' && editing) {
        e.preventDefault();
        e.target.onchange?.();
        e.target.blur();
        e.stopImmediatePropagation();
        return;
      }
      // Keep ordinary model shortcuts and delete out of this mode.
      e.stopPropagation();
    },
    true,
  );
  bar.addEventListener('focusout', (e) => {
    if (active && e.target.matches?.('[data-label], [data-position]')) e.target.onchange?.();
  });
  $('[data-done]').onclick = finish;
  $('[data-move]').onclick = () => {
    cancelDrag();
    adding = false;
    fields();
    message('Dra en stomlinje eller bubbla.');
  };
  $('[data-add]').onclick = () => {
    cancelDrag();
    adding = true;
    fields();
    message('Ny stomlinje · Välj riktning och klicka i modellen');
  };
  $('[data-grid-axis]').onchange = () => {
    cancelDrag();
    selection = null;
    display();
    fields();
  };
  $('[data-snap]').onclick = () => {
    snapping = !snapping;
    $('[data-snap]').setAttribute('aria-pressed', String(snapping));
  };
  $('[data-remove]').onclick = () => {
    if (!selection) return;
    cancelDrag();
    try {
      commit(removeGridLine(project.grid, selection.axis, selection.index), selection.axis);
      message('Stomlinje borttagen · Kan ångras');
    } catch (error) {
      message(error.message);
    }
  };
  for (const [selector, key] of [
    ['[data-label]', 'label'],
    ['[data-position]', 'position'],
  ])
    $(selector).onchange = () => {
      if (!selection) return;
      try {
        if (!$(selector).value.trim()) throw Error('Ange ett värde.');
        commit(
          changeGridLine(project.grid, selection.axis, selection.index, {
            [key]: $(selector).value,
          }),
          selection.axis,
        );
        message('Stomlinje uppdaterad · Kan ångras');
      } catch (error) {
        message(error.message);
        fields();
      }
    };
  return {
    start,
    finish,
    cancelDrag,
    get active() {
      return active;
    },
    refresh() {
      if (active) {
        cancelDrag();
        selection = null;
        display();
        fields();
      }
    },
    update() {
      if (!active || !selection || adding) {
        handle.hidden = true;
        return;
      }
      const id = `${selection.axis}:${drag?.result?.index ?? selection.index}`;
      const label = grid.labels.find((label) => label.id === id && !label.el.hidden);
      handle.hidden = !label;
      if (!label) return;
      handle.style.left = `${parseFloat(label.el.style.left) + 36}px`;
      handle.style.top = label.el.style.top;
      const a = new THREE.Vector3(0, 0, elevation()).project(camera),
        b = new THREE.Vector3(
          selection.axis === 'x' ? 1000 : 0,
          selection.axis === 'y' ? 1000 : 0,
          elevation(),
        ).project(camera);
      const angle = Math.atan2(-(b.y - a.y) * host.clientHeight, (b.x - a.x) * host.clientWidth);
      handle.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    },
  };
}
