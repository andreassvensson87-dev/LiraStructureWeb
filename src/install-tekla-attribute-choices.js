import { ATTRIBUTE_SETTINGS_KEY, standardChoices } from './drawing-attributes.js';
import { FRAME_LIBRARY_KEY } from './frame-model.js';
const installedKey = 'lirastructure.tekla-attribute-choices.v1';

/** Adopt the supplied lists once, including installations with older defaults. */
export function installTeklaAttributeChoices(storage = localStorage) {
  if (storage.getItem(installedKey)) return;
  const keys = [ATTRIBUTE_SETTINGS_KEY, FRAME_LIBRARY_KEY, installedKey];
  const previous = keys.map((key) => storage.getItem(key));
  const parse = (value, fallback) => {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  };
  const raw = parse(previous[0], {});
  const settings = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  for (const [key, options] of Object.entries(standardChoices))
    settings[key] = {
      ...settings[key],
      dataType: settings[key]?.dataType === 'multichoice' ? 'multichoice' : 'choice',
      options,
    };
  const blocks = parse(previous[1], []);
  // Update the original category placeholders without replacing edited geometry.
  for (const block of Array.isArray(blocks) ? blocks : [])
    if (['mall-rithuvud_a1', 'mall-rithuvud_a3_a4'].includes(block.id))
      for (const entity of block.entities || [])
        if (entity.type === 'attribute' && entity.key === 'drawing.type')
          entity.key = 'drawing.category';
  try {
    storage.setItem(ATTRIBUTE_SETTINGS_KEY, JSON.stringify(settings));
    if (Array.isArray(blocks) && previous[1] !== null)
      storage.setItem(FRAME_LIBRARY_KEY, JSON.stringify(blocks));
    storage.setItem(installedKey, '1');
  } catch (error) {
    keys.forEach((key, i) => {
      if (previous[i] === null) storage.removeItem(key);
      else storage.setItem(key, previous[i]);
    });
    throw error;
  }
}
