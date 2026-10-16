import { gridPickIds } from '../grid-objects.js';
import { cadFeedback, paintCadSnap } from '../../ui/cad-feedback.js';
import * as THREE from 'three';

export function createSnapOverlay({ project, ui, tools, host, scene, camera, grid }) {
  const snapMarker = document.createElement('div');
  snapMarker.className = 'snap-marker';
  snapMarker.hidden = true;
  snapMarker.setAttribute('aria-hidden', 'true');
  const symbolRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  symbolRoot.setAttribute('viewBox', '-8 -8 16 16');
  snapMarker.append(symbolRoot);
  host.append(snapMarker);
  const snapStatus = document.createElement('span');
  snapStatus.id = 'snap-status';
  document.querySelector('footer').append(snapStatus);
  const guide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({
      color: cadFeedback.snap,
      dashSize: 180,
      gapSize: 90,
      depthTest: false,
    }),
  );
  guide.visible = false;
  guide.renderOrder = 10;
  scene.add(guide);
  function updateSnapOverlay() {
    grid.highlight([
      ...gridPickIds(project.grid, ui.selectedIds),
      ...(tools.drawing ? tools.activeSnap?.gridIds || [] : []),
    ]);
    const active = tools.drawing && tools.activeSnap?.point;
    const text =
      active && tools.operation?.mode !== 'workPlane' && !tools.operation?.linearId
        ? tools.activeSnap.label
        : '';
    if (snapStatus.textContent !== text) snapStatus.textContent = text;
    const colors = { X: '#ba4b47', Y: '#22845f', Z: '#3e75b5' };
    guide.material.color.set(colors[tools.activeSnap?.axis] || cadFeedback.tracking);
    if (guide.visible) {
      const positions = guide.geometry.attributes.position;
      const a = new THREE.Vector3().fromBufferAttribute(positions, 0);
      const b = new THREE.Vector3().fromBufferAttribute(positions, 1);
      const worldLength = a.distanceTo(b);
      a.project(camera);
      b.project(camera);
      const screenLength = Math.hypot(
        ((a.x - b.x) * host.clientWidth) / 2,
        ((a.y - b.y) * host.clientHeight) / 2,
      );
      if (screenLength > 1) {
        guide.material.dashSize = (cadFeedback.dashPixels[0] * worldLength) / screenLength;
        guide.material.gapSize = (cadFeedback.dashPixels[1] * worldLength) / screenLength;
      }
    }
    snapMarker.hidden =
      !active || tools.activeSnap.kind === 'free' || tools.activeSnap.kind === 'direction';
    if (!snapMarker.hidden) {
      const p = new THREE.Vector3(...tools.activeSnap.point).project(camera);
      snapMarker.style.left = `${((p.x + 1) * host.clientWidth) / 2}px`;
      snapMarker.style.top = `${((1 - p.y) * host.clientHeight) / 2}px`;
      symbolRoot.replaceChildren();
      paintCadSnap(symbolRoot, [0, 0], { symbol: tools.activeSnap.symbol || 'square' });
    }
  }
  return { guide, snapMarker, updateSnapOverlay };
}
