import * as THREE from 'three';

export function createSnapOverlay({ project, ui, tools, host, scene, camera, grid }) {
  const snapMarker = document.createElement('div');
  snapMarker.className = 'snap-marker';
  snapMarker.hidden = true;
  snapMarker.setAttribute('aria-hidden', 'true');
  host.append(snapMarker);
  const snapStatus = document.createElement('span');
  snapStatus.id = 'snap-status';
  document.querySelector('footer').append(snapStatus);
  const guide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0x16815e, dashSize: 180, gapSize: 90, depthTest: false }),
  );
  guide.visible = false;
  guide.renderOrder = 10;
  scene.add(guide);
  function updateSnapOverlay() {
    grid.highlight([
      ...project.objects
        .filter((s) => s.type === 'gridline' && ui.selectedIds.has(s.id))
        .map((s) => s.gridPickId),
      ...(tools.drawing ? tools.activeSnap?.gridIds || [] : []),
    ]);
    const active = tools.drawing && tools.activeSnap?.point;
    const text = active ? tools.activeSnap.label : '';
    if (snapStatus.textContent !== text) snapStatus.textContent = text;
    const colors = { X: '#ba4b47', Y: '#22845f', Z: '#3e75b5' };
    guide.material.color.set(colors[tools.activeSnap?.axis] || '#16815e');
    snapMarker.hidden =
      !active || tools.activeSnap.kind === 'free' || tools.activeSnap.kind === 'direction';
    if (!snapMarker.hidden) {
      const p = new THREE.Vector3(...tools.activeSnap.point).project(camera);
      snapMarker.style.left = `${((p.x + 1) * host.clientWidth) / 2}px`;
      snapMarker.style.top = `${((1 - p.y) * host.clientHeight) / 2}px`;
      snapMarker.dataset.symbol = tools.activeSnap.symbol || 'square';
    }
  }
  return { guide, snapMarker, updateSnapOverlay };
}
