import { gridSegments } from '../grid-geometry.js';
import * as THREE from 'three';
import { gridLabel, GRID_LABEL_MAX_LENGTH } from '../grid-labels.js';
import {
  addGridLine,
  changeGridLine,
  removeGridLine,
  gridSegmentDistance,
  parallelGridLine,
} from '../grid-edit.js';

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
  bar.innerHTML = `<strong><i></i>Stomlinjer</strong><button type="button" data-move aria-pressed="true">↔ Flytta</button><button type="button" data-add aria-pressed="false">+ Ny</button><button type="button" data-remove title="Ta bort stomlinje" aria-label="Ta bort stomlinje">⌫</button><span class="grid-edit-separator"></span><label>Grupp<select data-grid-axis aria-label="Stomlinjeriktning"><option value="x">X</option><option value="y">Y</option></select></label><label>Linje<input data-label aria-label="Stomlinjebeteckning" maxlength="${GRID_LABEL_MAX_LENGTH}"></label><input data-position type="hidden"><button type="button" data-snap aria-pressed="true" title="Snapping" aria-label="Snapping">⌁</button><small class="grid-edit-escape">Esc</small><button type="button" data-done class="primary">Klar</button>`;
  host.append(bar);
  const $ = (selector) => bar.querySelector(selector);
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'grid-edit-handle';
  handle.hidden = true;
  handle.textContent = '✥';
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
  const panel = document.createElement('section');
  panel.id = 'grid-inspector';
  panel.hidden = true;
  panel.innerHTML = `<h2>Stomlinje</h2><p data-grid-empty>Markera en linje eller bubbla i modellen.</p><div data-grid-fields><label class="field">Beteckning<input data-name maxlength="${GRID_LABEL_MAX_LENGTH}" aria-label="Linjenamn"></label><div class="grid-endpoint-fields"><h3>Startpunkt · mm</h3><label>X<input data-start-x type="number" step="any" aria-label="Startpunkt X"></label><label>Y<input data-start-y type="number" step="any" aria-label="Startpunkt Y"></label><h3>Slutpunkt · mm</h3><label>X<input data-end-x type="number" step="any" aria-label="Slutpunkt X"></label><label>Y<input data-end-y type="number" step="any" aria-label="Slutpunkt Y"></label></div><label class="field">Vinkel · °<input data-angle type="number" step="any" aria-label="Stomlinjevinkel"></label><h3>Parallell linje</h3><label class="field">Avstånd · mm<input data-offset type="number" step="any" value="3000" aria-label="Parallellavstånd"></label><button type="button" data-parallel>Skapa parallell linje</button></div><p class="inspector-note">Dra linjen för att flytta den. Dra ett ändpunktshandtag för att ändra riktningen.</p>`;
  document.getElementById('inspector-properties').append(panel);
  const field = (selector) => panel.querySelector(selector);
  const endpoints = [0, 1].map((index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grid-endpoint-handle';
    button.hidden = true;
    button.dataset.endpoint = String(index);
    button.setAttribute(
      'aria-label',
      index ? 'Dra stomlinjens slutpunkt' : 'Dra stomlinjens startpunkt',
    );
    host.append(button);
    return button;
  });
  let newStart = null;
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
    if (active) document.getElementById('properties-tab')?.click?.();
    const selected = selection && project.grid[selection.axis]?.[selection.index] !== undefined;
    $('[data-label]').disabled = $('[data-position]').disabled = !selected || adding;
    $('[data-remove]').disabled = !selected || adding || project.grid[selection.axis].length <= 2;
    $('[data-label]').value = selected
      ? gridLabel(project.grid, selection.axis, selection.index)
      : '';
    $('[data-position]').value = selected ? project.grid[selection.axis][selection.index] : '';
    panel.hidden = !active;
    field('[data-grid-empty]').hidden = !!selected;
    field('[data-grid-fields]').hidden = !selected || adding;
    if (selected) {
      const line = gridSegments(project.grid).find(
        (line) => line.axis === selection.axis && line.index === selection.index,
      );
      field('[data-name]').value = line.label;
      for (const end of ['start', 'end'])
        for (const [i, coord] of ['x', 'y'].entries())
          field(`[data-${end}-${coord}]`).value = +line[end][i].toFixed(3);
      field('[data-angle]').value = +(
        (Math.atan2(line.end[1] - line.start[1], line.end[0] - line.start[0]) * 180) /
        Math.PI
      ).toFixed(3);
    }
    if (!selected || adding) endpoints.forEach((button) => (button.hidden = true));
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
    newStart = null;
    panel.hidden = true;
    document.getElementById('model-tab')?.click?.();
    endpoints.forEach((button) => (button.hidden = true));
    for (const [element, inert] of locks) element.inert = inert;
    locks = [];
    bar.hidden = handle.hidden = note.hidden = true;
    host.classList.remove('grid-editing');
    display();
    message('Stomlinjer klara · Modellering aktiverad');
  }
  function start(initialSelection = null) {
    if (active) {
      if (initialSelection) selection = initialSelection;
      display();
      fields();
      return;
    }
    begin();
    active = true;
    selection = initialSelection;
    adding = false;
    newStart = null;
    locks = [
      ...document.querySelectorAll(
        '.toolbox, #inspector-model, #inspector-filter, #inspector-references, .inspector-tabs button:not(#properties-tab), [role=tab]:not(#properties-tab), .model-selection-switch, .level-controls, #work-plane, #work-plane-view, header button:not(#undo):not(#redo), header details',
      ),
    ].map((element) => [element, element.inert]);
    for (const [element] of locks) element.inert = true;
    host.classList.add('grid-editing');
    bar.hidden = note.hidden = false;
    document.getElementById('properties-tab')?.click?.();
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
      const axis = $('[data-grid-axis]').value,
        coords = [snap(p.x), snap(p.y)];
      if (!newStart) {
        newStart = coords;
        message('Ny stomlinje · Klicka på slutpunkten · Esc avbryter');
        invalidate();
        return;
      }
      try {
        commit(
          addGridLine(project.grid, axis, coords[axis === 'x' ? 0 : 1], {
            start: newStart,
            end: coords,
          }),
          axis,
        );
        newStart = null;
        adding = false;
        fields();
        message('Stomlinje tillagd · Kan ångras');
      } catch (error) {
        message(error.message);
      }

      return;
    }
    const endpoint = endpoints.indexOf(e.target);
    const hit = e.target === handle || endpoint >= 0 ? selection : pick(e);
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
      start: [p.x, p.y],
      source: gridSegments(project.grid).find(
        (line) => line.axis === hit.axis && line.index === hit.index,
      ),
      endpoint,
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
      delta = [snap(p.x - drag.start[0]), snap(p.y - drag.start[1])],
      position = project.grid[axis][selection.index] + delta[axis === 'x' ? 0 : 1],
      patch =
        drag.endpoint >= 0
          ? {
              [drag.endpoint ? 'end' : 'start']: drag.source[drag.endpoint ? 'end' : 'start'].map(
                (v, i) => v + delta[i],
              ),
            }
          : { translation: delta };
    try {
      drag.result = changeGridLine(project.grid, axis, selection.index, patch);
      const selected = selection;
      selection = { axis, index: drag.result.index };
      display(drag.result.grid);
      selection = selected;
      $('[data-position]').value = position;
      hint.textContent =
        drag.endpoint >= 0 ? `${snap(p.x)}, ${snap(p.y)} mm` : `${delta[0]}, ${delta[1]} mm`;
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
      message('Stomlinje uppdaterad · Kan ångras');
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
        if (!cancelDrag()) {
          if (adding) {
            adding = false;
            newStart = null;
            display();
            fields();
          } else finish();
        }
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
    newStart = null;
    fields();
    message('Dra en stomlinje eller bubbla.');
  };
  $('[data-add]').onclick = () => {
    cancelDrag();
    adding = true;
    newStart = null;
    fields();
    message('Ny stomlinje · Välj grupp och klicka på start- och slutpunkt');
  };
  $('[data-grid-axis]').onchange = () => {
    cancelDrag();
    selection = null;
    newStart = null;
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
  function updateField(patch) {
    if (!selection || !active) return;
    const current = gridSegments(project.grid).find(
      (line) => line.axis === selection.axis && line.index === selection.index,
    );
    if (patch.label !== undefined && patch.label.trim() === current.label) return;
    if (
      patch.angle !== undefined &&
      Math.abs(
        Number(patch.angle) -
          +(
            (Math.atan2(current.end[1] - current.start[1], current.end[0] - current.start[0]) *
              180) /
            Math.PI
          ).toFixed(3),
      ) < 1e-9
    )
      return;
    for (const end of ['start', 'end'])
      if (
        patch[end] &&
        patch[end].every((v, i) => Math.abs(v - +current[end][i].toFixed(3)) < 1e-9)
      )
        return;
    try {
      commit(changeGridLine(project.grid, selection.axis, selection.index, patch), selection.axis);
      message('Stomlinje uppdaterad · Kan ångras');
    } catch (error) {
      message(error.message);
      fields();
    }
  }
  field('[data-name]').onchange = () => updateField({ label: field('[data-name]').value });
  field('[data-angle]').onchange = () => {
    if (!field('[data-angle]').value.trim()) {
      fields();
      return;
    }
    updateField({ angle: field('[data-angle]').value });
  };
  for (const end of ['start', 'end'])
    for (const coord of ['x', 'y'])
      field(`[data-${end}-${coord}]`).onchange = () => {
        const inputs = ['x', 'y'].map((key) => field(`[data-${end}-${key}]`));
        if (inputs.some((input) => !input.value.trim())) {
          fields();
          return;
        }
        updateField({ [end]: inputs.map((input) => Number(input.value)) });
      };
  field('[data-parallel]').onclick = () => {
    if (!selection) return;
    try {
      commit(
        parallelGridLine(
          project.grid,
          selection.axis,
          selection.index,
          field('[data-offset]').value,
        ),
        selection.axis,
      );
      message('Parallell stomlinje skapad · Kan ångras');
    } catch (error) {
      message(error.message);
    }
  };
  panel.addEventListener('focusout', (e) => {
    if (active) e.target.onchange?.();
  });
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
      const selected =
        active && selection && !adding
          ? gridSegments(drag?.result?.grid ?? project.grid).find(
              (line) => line.axis === selection.axis && line.index === selection.index,
            )
          : null;
      const points = selected
        ? [selected.start, selected.end]
        : adding && newStart
          ? [newStart]
          : [];
      endpoints.forEach((button, index) => {
        const point = points[index];
        button.hidden = !point;
        if (!point) return;
        const p = new THREE.Vector3(...point, elevation()).project(camera);
        button.hidden = Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1;
        button.style.left = `${((p.x + 1) * host.clientWidth) / 2 - (selected ? 28 : 0)}px`;
        button.style.top = `${((1 - p.y) * host.clientHeight) / 2}px`;
      });
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
      handle.style.transform = 'translate(-50%, -50%)';
    },
  };
}
