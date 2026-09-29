export const propertyFields = {
  line: ['color', 'stroke'],
  text: ['text', 'font', 'size', 'color', 'align', 'angle'],
  attribute: ['attribute', 'font', 'size', 'color', 'align', 'angle'],
  image: ['imageWidth', 'imageHeight', 'angle'],
  block: ['blockChoice', 'anchor', 'offsetX', 'offsetY', 'blockAngle'],
};
export const propertyNames = {
  attribute: 'key',
  imageWidth: 'width',
  imageHeight: 'height',
  blockChoice: 'blockId',
  blockAngle: 'angle',
};
export const propertyDefaults = {
  color: '#233940',
  font: 'Arial, sans-serif',
  size: 3.5,
  angle: 0,
  stroke: 0.25,
  align: 'start',
};
export function commonFields(items) {
  return items.length
    ? (propertyFields[items[0].type] || []).filter((k) =>
        items.every((e) => propertyFields[e.type]?.includes(k)),
      )
    : [];
}
export function propertyValue(e, key) {
  return key === 'offsetX'
    ? e.point[0]
    : key === 'offsetY'
      ? e.point[1]
      : (e[propertyNames[key] || key] ?? propertyDefaults[key] ?? '');
}
export function patchFrameProperties(entity, changes, lockRatio = true) {
  const result = { ...entity };
  for (const [key, value] of Object.entries(changes)) {
    if (!propertyFields[entity.type]?.includes(key)) continue;
    if (
      ['size', 'stroke', 'imageWidth', 'imageHeight'].includes(key) &&
      (!Number.isFinite(+value) || +value <= 0)
    )
      throw Error('Storlek och tjocklek måste vara positiva tal.');
    if (['angle', 'blockAngle'].includes(key) && !Number.isFinite(+value))
      throw Error('Ange en giltig vinkel.');
    result[propertyNames[key] || key] = [
      'size',
      'stroke',
      'imageWidth',
      'imageHeight',
      'angle',
      'blockAngle',
    ].includes(key)
      ? +value
      : value;
  }
  if (entity.type === 'image' && lockRatio) {
    if ('imageWidth' in changes && !('imageHeight' in changes))
      result.height = (entity.height * result.width) / entity.width;
    else if ('imageHeight' in changes && !('imageWidth' in changes))
      result.width = (entity.width * result.height) / entity.height;
  }
  return result;
}
