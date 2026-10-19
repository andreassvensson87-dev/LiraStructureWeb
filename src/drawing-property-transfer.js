import { propertyField as field, applyPropertyValues } from './property-transfer.js';

export function drawingPropertyType(item) {
  if (!item || item.parametricBlock) return null;
  return item.type === 'shape' ? `shape:${item.shape}` : item.type;
}
export function drawingPropertyFields(item) {
  if (!drawingPropertyType(item)) return [];
  const order = field('drawOrder', 'Framför/bakom');
  if (item.type === 'shape')
    return [
      field('strokeColor', 'Linjefärg'),
      field('strokeWidth', 'Linjetjocklek'),
      field('lineType', 'Linjetyp'),
      ...(['circle', 'rectangle', 'polygon'].includes(item.shape) || item.closed
        ? [field('fillColor', 'Fyllning'), field('hatch', 'Hatch')]
        : []),
      ...(item.shape === 'insulation'
        ? [
            field('insulationType', 'Isoleringstyp'),
            field('thickness', 'Tjocklek'),
            field('side', 'Sida'),
          ]
        : []),
      order,
    ];
  if (item.type === 'richtext')
    return [
      field('font', 'Typsnitt'),
      field('textSize', 'Texthöjd'),
      field('lineSpacing', 'Radavstånd'),
      field('frame', 'Ram'),
      field('background', 'Bakgrund'),
      order,
    ];
  if (['dimension', 'leader'].includes(item.type))
    return [
      field('textSize', 'Texthöjd'),
      ...(item.type === 'dimension' ? [field('precision', 'Decimaler')] : []),
      field('comment', 'Kommentar'),
      order,
    ];
  return [];
}
export function applyDrawingProperties(target, values, selected = Object.keys(values)) {
  const next = applyPropertyValues(target, values, drawingPropertyFields(target), selected);
  for (const [key, min, max] of [
    ['textSize', 0.5, 20],
    ['strokeWidth', 0.05, 5],
    ['lineSpacing', 1, 4],
    ['thickness', 0.001, 1e7],
  ]) {
    if (
      next[key] !== undefined &&
      (!Number.isFinite(next[key]) || next[key] < min || next[key] > max)
    )
      throw Error('Ogiltigt egenskapsvärde.');
  }
  if (next.precision !== undefined && ![0, 1, 2, 3].includes(next.precision))
    throw Error('Ogiltiga decimaler.');
  return next;
}
