import {
  defaultCoordinates,
  validateCoordinates,
  parseCoordinate,
} from '../coordinates/coordinates.js';
import { createCoordinateSettings } from '../ui/coordinate-settings.js';
/** Owns a detached multi-base draft. Only the parent Settings transaction commits it. */
export function createCoordinateSettingsController({ getCoordinates, pickPoint, reportError }) {
  const { tab, panel } = createCoordinateSettings();
  const $ = (s) => panel.querySelector(s);
  let draft = defaultCoordinates(),
    selectedId = null,
    picking = false;
  const selected = () => draft.basePoints.find((p) => p.id === selectedId);
  const format = (n) => n.toLocaleString('sv-SE', { useGrouping: false, maximumFractionDigits: 9 });
  function readBase() {
    const base = selected();
    if (!base) return;
    const next = {
      ...base,
      name: $('[data-base-name]').value.trim(),
      rotation: parseCoordinate($('[data-rotation]').value),
    };
    for (const key of ['local', 'map'])
      next[key] = [0, 1, 2].map((i) => parseCoordinate($(`[data-coordinate="${key}-${i}"]`).value));
    const value = {
      ...draft,
      basePoints: draft.basePoints.map((p) => (p.id === base.id ? next : p)),
    };
    validateCoordinates(value);
    draft = value;
  }
  function read() {
    readBase();
    return structuredClone(
      validateCoordinates({
        ...draft,
        crs:
          $('[data-crs]').value === 'custom'
            ? $('[data-custom-crs]').value.trim()
            : $('[data-crs]').value,
        verticalDatum:
          $('[data-datum]').value === 'custom'
            ? $('[data-custom-datum]').value.trim()
            : $('[data-datum]').value,
      }),
    );
  }
  function render() {
    const select = $('[data-base]');
    select.replaceChildren(
      ...draft.basePoints.map(
        (p) => new Option(p.name + (p.id === draft.activeId ? ' · aktiv' : ''), p.id),
      ),
    );
    select.value = selectedId || '';
    const base = selected();
    $('[data-base-fields]').hidden = !base;
    $('[data-empty]').hidden = !!base;
    $('[data-delete]').disabled = !base;
    $('[data-add]').disabled = draft.basePoints.length >= 100;
    if (!base) return;
    $('[data-base-name]').value = base.name;
    $('[data-active]').checked = draft.activeId === base.id;
    $('[data-rotation]').value = format(base.rotation);
    for (const key of ['local', 'map'])
      for (let i = 0; i < 3; i++) $(`[data-coordinate="${key}-${i}"]`).value = format(base[key][i]);
  }
  const attempt = (fn) => {
    try {
      fn();
      reportError('');
    } catch (e) {
      reportError(e.message);
    }
  };
  $('[data-base]').onchange = () =>
    attempt(() => {
      const id = $('[data-base]').value;
      try {
        readBase();
      } catch (e) {
        $('[data-base]').value = selectedId;
        throw e;
      }
      selectedId = id;
      render();
    });
  $('[data-add]').onclick = () =>
    attempt(() => {
      readBase();
      let n = 1;
      while (draft.basePoints.some((p) => p.name === `Baspunkt ${n}`)) n++;
      const base = {
        id: crypto.randomUUID(),
        name: `Baspunkt ${n}`,
        local: [0, 0, 0],
        map: [0, 0, 0],
        rotation: 0,
      };
      draft.basePoints.push(base);
      if (draft.basePoints.length === 1) draft.activeId = base.id;
      selectedId = base.id;
      render();
    });
  $('[data-delete]').onclick = () =>
    attempt(() => {
      draft.basePoints = draft.basePoints.filter((p) => p.id !== selectedId);
      if (draft.activeId === selectedId) draft.activeId = null;
      selectedId = draft.basePoints[0]?.id || null;
      render();
    });
  $('[data-active]').onchange = () =>
    attempt(() => {
      readBase();
      draft.activeId = $('[data-active]').checked ? selectedId : null;
      render();
    });
  for (const key of ['crs', 'datum'])
    $(`[data-${key}]`).onchange = () => {
      $(`[data-custom-${key}-row]`).hidden = $(`[data-${key}]`).value !== 'custom';
    };
  $('[data-pick]').onclick = async () => {
    if (picking) return;
    let base;
    try {
      readBase();
      base = selected();
      reportError('');
    } catch (e) {
      reportError(e.message);
      return;
    }
    picking = true;
    try {
      const p = await pickPoint();
      if (p) {
        base.local = [...p];
        render();
      }
    } catch (e) {
      reportError(e.message);
    } finally {
      picking = false;
    }
  };
  function fill() {
    draft = structuredClone(getCoordinates() || defaultCoordinates());
    selectedId = draft.activeId || draft.basePoints[0]?.id || null;
    for (const [key, value] of [
      ['crs', draft.crs],
      ['datum', draft.verticalDatum],
    ]) {
      const select = $(`[data-${key}]`);
      select.value = [...select.options].some((o) => o.value === value) ? value : 'custom';
      $(`[data-custom-${key}]`).value = value;
      $(`[data-custom-${key}-row]`).hidden = select.value !== 'custom';
    }
    render();
  }
  return { tab, panel, read, fill };
}
