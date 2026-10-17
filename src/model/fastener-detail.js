import { fastenerDisplayTemplate } from '../fasteners/geometry.js';
import { addDisplayProxy } from './display-detail.js';

export function addFastenerOverviewMesh(object, source) {
  const proxy = addDisplayProxy(object, fastenerDisplayTemplate(source, true));
  proxy.userData.detailDiameter = object.userData.detailDiameter;
}

/** Small hardware uses a cheaper surface; subpixel hardware remains available for modelling. */
export function updateFastenerDetail(children, camera, height, selectedIds) {
  if (!camera.isOrthographicCamera) return;
  const pixelsPerUnit = (height * camera.zoom) / (camera.top - camera.bottom);
  for (const object of children) {
    const diameter = object.userData.detailDiameter;
    if (!diameter) continue;
    const pixels = diameter * pixelsPerUnit;
    const selected = selectedIds.size < 5 && selectedIds.has(object.userData.id);
    const visible = pixels >= 1.5 || selected;
    const proxy = object.userData.overviewMesh;
    const detailed =
      visible &&
      (!proxy || selected || pixels >= (object.userData.detailVisible === false ? 12 : 9));
    object.userData.detailVisible = detailed;
    const layer = detailed ? (object.userData.instanced ? 3 : 0) : visible && proxy ? 3 : 2;
    if (object.layers.mask !== 1 << layer) {
      object.layers.set(layer);
      object.children[0].layers.set(layer);
    }
    if (proxy) {
      proxy.userData.detailVisible = visible && !detailed;
      const proxyLayer = proxy.userData.instanced ? 3 : visible && !detailed ? 0 : 2;
      if (proxy.layers.mask !== 1 << proxyLayer) {
        proxy.layers.set(proxyLayer);
        proxy.children[0].layers.set(proxyLayer);
      }
    }
  }
}
