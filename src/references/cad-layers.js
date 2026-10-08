export function cadLayers(entities) {
  const layers = new Map();
  for (const entity of entities) {
    const name = entity.layer || '0';
    if (!layers.has(name)) layers.set(name, { name, color: entity.color, count: 0 });
    layers.get(name).count++;
  }
  return [...layers.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
}
export function applyLayerVisibility(model) {
  for (const part of model.parts)
    part.mesh.visible = !part.layer || model.layerVisibility?.[part.layer] !== false;
}
