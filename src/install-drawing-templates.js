import templates from './bundled-drawing-templates.js';
import { FRAME_LIBRARY_KEY } from './frame-model.js';
import { LAYOUT_KEY } from './frame-layout.js';
import { DRAWING_PRESETS_KEY, normalizePreset, readDrawingPresets } from './drawing-presets.js';
const installedKey = 'lirastructure.bundled-drawing-templates.v1';

/** Install once, preserving saved libraries and subsequent edits/deletions. */
export function installDrawingTemplates(storage = localStorage) {
  if (storage.getItem(installedKey)) return;
  const keys = [FRAME_LIBRARY_KEY, LAYOUT_KEY, DRAWING_PRESETS_KEY, installedKey];
  const previous = keys.map((key) => storage.getItem(key));
  const read = (value, fallback) => {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  };
  const merge = (value, bundled) => {
    const items = read(value, []);
    const saved = Array.isArray(items) ? items : [];
    return [...saved, ...bundled.filter((item) => !saved.some((s) => s.id === item.id))];
  };
  const presets = read(previous[2], {});
  const savedPresets = Array.isArray(presets.items) && presets.items.length ? presets.items : null;
  const items = savedPresets || [
    normalizePreset({
      ...readDrawingPresets().items[0],
      layoutId: 'mall-layout-a3',
    }),
  ];
  const bundledPresets = templates.layouts.map((layout) =>
    normalizePreset({
      id: layout.id,
      name: `Mall ${layout.paperFormat}`,
      layoutId: layout.id,
    }),
  );
  try {
    storage.setItem(FRAME_LIBRARY_KEY, JSON.stringify(merge(previous[0], templates.blocks)));
    storage.setItem(LAYOUT_KEY, JSON.stringify(merge(previous[1], templates.layouts)));
    storage.setItem(
      DRAWING_PRESETS_KEY,
      JSON.stringify({
        items: [...items, ...bundledPresets.filter((p) => !items.some((s) => s.id === p.id))],
        defaultId: savedPresets ? presets.defaultId : 'standard',
      }),
    );
    storage.setItem(installedKey, '1');
  } catch (error) {
    keys.forEach((key, i) => {
      if (previous[i] === null) storage.removeItem(key);
      else storage.setItem(key, previous[i]);
    });
    throw error;
  }
}
