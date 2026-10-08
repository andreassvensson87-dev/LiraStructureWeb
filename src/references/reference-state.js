export const emptyReferences = () => ({ folders: ['Standard'], models: [] });
export function encodeReference(bytes) {
  const array = new Uint8Array(bytes);
  let text = '';
  for (let i = 0; i < array.length; i += 32768)
    text += String.fromCharCode(...array.subarray(i, i + 32768));
  return btoa(text);
}
export function decodeReference(source) {
  return Uint8Array.from(atob(source), (c) => c.charCodeAt(0)).buffer;
}
export function validateReferences(value = emptyReferences()) {
  const fail = () => {
    throw Error('Ogiltiga referenser i projektfilen.');
  };
  const name = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
  if (
    !value ||
    !Array.isArray(value.folders) ||
    !Array.isArray(value.models) ||
    value.folders.length > 1000 ||
    value.models.length > 1000 ||
    !value.folders.every(name) ||
    new Set(value.folders).size !== value.folders.length
  )
    fail();
  const ids = new Set();
  for (const model of value.models) {
    if (
      !model ||
      !name(model.id) ||
      ids.has(model.id) ||
      !name(model.title) ||
      !name(model.fileName) ||
      !value.folders.includes(model.folder) ||
      !['IFC', 'DXF', 'DWG'].includes(model.format) ||
      !['visible', 'transparent', 'corners', 'edges'].every((k) => typeof model[k] === 'boolean') ||
      typeof model.source !== 'string' ||
      !model.source.length ||
      model.source.length > 140000000 ||
      model.source.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(model.source)
    )
      fail();
    ids.add(model.id);
    if (model.locked !== undefined && typeof model.locked !== 'boolean') fail();
    if (
      model.layerVisibility !== undefined &&
      (!model.layerVisibility ||
        typeof model.layerVisibility !== 'object' ||
        Array.isArray(model.layerVisibility) ||
        Object.keys(model.layerVisibility).length > 100000 ||
        !Object.values(model.layerVisibility).every((v) => typeof v === 'boolean'))
    )
      fail();
    if (model.format !== 'IFC' || model.placement) {
      const p = model.placement;
      if (
        !p ||
        !Array.isArray(p.offset) ||
        p.offset.length !== 3 ||
        !p.offset.every(Number.isFinite) ||
        !Number.isFinite(p.rotation) ||
        !Number.isFinite(p.scale) ||
        p.scale <= 0 ||
        (p.quaternion &&
          (!Array.isArray(p.quaternion) ||
            p.quaternion.length !== 4 ||
            !p.quaternion.every(Number.isFinite) ||
            Math.abs(Math.hypot(...p.quaternion) - 1) > 1e-6)) ||
        (model.format !== 'IFC' &&
          (!Number.isFinite(model.unitFactor) ||
            model.unitFactor <= 0 ||
            typeof model.unitKnown !== 'boolean')) ||
        (model.format === 'IFC' && p.scale !== 1)
      )
        fail();
      if (model.format !== 'IFC' && model.source.length > Math.ceil((10 * 1024 * 1024) / 3) * 4)
        fail();
    }
  }
  return value;
}
