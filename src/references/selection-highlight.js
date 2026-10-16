/** Temporary colour layers for IFC meshes and CAD line/surface materials. */
function highlight(parts, enabled, key, color) {
  for (const part of parts) {
    if (part[key]) {
      for (const { material, field, value } of part[key]) material[field].copy(value);
      delete part[key];
    }
    if (!enabled) continue;
    const materials = Array.isArray(part.mesh.material) ? part.mesh.material : [part.mesh.material];
    part[key] = materials.flatMap((material) => {
      const field = material.emissive ? 'emissive' : 'color';
      if (!material[field]) return [];
      const value = material[field].clone();
      material[field].setHex(color);
      return [{ material, field, value }];
    });
  }
}
export function highlightReferenceParts(parts, selected) {
  highlight(parts, selected, 'selectionHighlight', 0x176b53);
}
/** Removing hover restores the current selection colour, without mutating opacity. */
export function highlightReferenceHover(parts, hovered) {
  highlight(parts, hovered, 'hoverHighlight', 0xe1b84d);
}
