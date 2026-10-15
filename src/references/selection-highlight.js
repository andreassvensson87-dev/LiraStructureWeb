/** Temporary selection colour for IFC meshes and CAD line/surface materials. */
export function highlightReferenceParts(parts, selected) {
  for (const part of parts) {
    if (part.selectionHighlight) {
      for (const { material, field, value } of part.selectionHighlight) material[field].copy(value);
      delete part.selectionHighlight;
    }
    if (!selected) continue;
    const materials = Array.isArray(part.mesh.material) ? part.mesh.material : [part.mesh.material];
    part.selectionHighlight = materials.flatMap((material) => {
      const field = material.emissive ? 'emissive' : 'color';
      if (!material[field]) return [];
      const value = material[field].clone();
      material[field].setHex(0x176b53);
      return [{ material, field, value }];
    });
  }
}
