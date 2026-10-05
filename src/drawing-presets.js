import { drawingFont, readDrawingPreferences } from './drawing-preferences.js';
export const DRAWING_PRESETS_KEY = 'lirastructure.drawing-presets.v1';
const number = (value, fallback, max = 20) =>
  Number.isFinite(+value) && +value > 0 && +value <= max ? +value : fallback;
export function normalizePreset(value = {}) {
  return {
    id: String(value.id || 'standard'),
    name:
      String(value.name || 'Standard')
        .trim()
        .slice(0, 80) || 'Standard',
    font: drawingFont({ typography: value }),
    dimensionSize: number(value.dimensionSize, 2.5),
    leaderSize: number(value.leaderSize, 2.5),
    lineWidth: number(value.lineWidth, 0.22, 2),
    hiddenLines: typeof value.hiddenLines === 'boolean' ? value.hiddenLines : null,
    showGrid: value.showGrid !== false,
    showLevels: value.showLevels !== false,
    layoutId: typeof value.layoutId === 'string' ? value.layoutId : '',
  };
}
export function readDrawingPresets() {
  try {
    const data = JSON.parse(localStorage.getItem(DRAWING_PRESETS_KEY));
    if (Array.isArray(data?.items) && data.items.length) {
      const items = data.items.map(normalizePreset);
      return {
        items,
        defaultId: items.some((p) => p.id === data.defaultId) ? data.defaultId : items[0].id,
      };
    }
  } catch {
    /* Use legacy defaults when the library is absent or invalid. */
  }
  return {
    items: [normalizePreset({ ...readDrawingPreferences(), name: 'Standard' })],
    defaultId: 'standard',
  };
}
export function applyDrawingPreset(record, preset) {
  const p = normalizePreset(preset);
  record.drawingPreset = structuredClone(p);
  record.typography = { font: p.font };
  const settings = {
    hiddenLines: p.hiddenLines ?? ['SP', 'AS'].includes(record.type),
    showGrid: p.showGrid,
    showLevels: p.showLevels,
  };
  Object.assign((record.settings ??= {}), settings);
  if (record.sheet) {
    record.sheet.layoutId = p.layoutId;
    for (const view of record.sheet.views || []) Object.assign((view.settings ??= {}), settings);
  }
  // Explicit application also resets existing annotations to the selected style.
  for (const item of record.annotations || [])
    item.textSize = item.type === 'leader' ? p.leaderSize : p.dimensionSize;
  return record;
}
export function selectedDrawingPreset(id) {
  const library = readDrawingPresets();
  return library.items.find((p) => p.id === (id || library.defaultId)) || library.items[0];
}
export function drawingPresetPicker(labelText = 'Ritningsinställningar') {
  const label = document.createElement('label');
  label.textContent = labelText;
  const select = document.createElement('select');
  select.setAttribute('aria-label', labelText);
  const library = readDrawingPresets();
  select.append(...library.items.map((p) => new Option(p.name, p.id)));
  select.value = library.defaultId;
  label.append(select);
  return { label, select };
}
