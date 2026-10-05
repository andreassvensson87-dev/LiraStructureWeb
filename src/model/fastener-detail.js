/** Subpixel hardware is retained for modelling, but needs no detailed draw calls. */
export function updateFastenerDetail(children, camera, height, selectedIds) {
  if (!camera.isOrthographicCamera) return;
  const pixelsPerUnit = (height * camera.zoom) / (camera.top - camera.bottom);
  for (const object of children) {
    const diameter = object.userData.detailDiameter;
    if (!diameter) continue;
    const detailed =
      diameter * pixelsPerUnit >= 1.5 ||
      (selectedIds.size < 5 && selectedIds.has(object.userData.id));
    object.userData.detailVisible = detailed;
    const layer = detailed ? (object.userData.instanced ? 3 : 0) : 2;
    if (object.layers.mask === 1 << layer) continue;
    object.traverse((part) => part.layers.set(layer));
  }
}
