import { modelNearestFeedback } from '../nearest-feedback.js';
import { modelAxisFeedback } from '../axis-feedback.js';
import { drawingWorkPlane } from '../../work-plane.js';
import { paintAxisFeedback } from '../../ui/axis-feedback.js';
import { gridPickIds } from '../grid-objects.js';
import { paintCadSnap, paintCadNearestEdge } from '../../ui/cad-feedback.js';
import { nextPointSnapLabel } from '../next-point-snap.js';
import * as THREE from 'three';

export function createSnapOverlay({ project, ui, tools, host, camera, grid }) {
  const snapMarker = document.createElement('div');
  snapMarker.className = 'snap-marker';
  snapMarker.hidden = true;
  snapMarker.setAttribute('aria-hidden', 'true');
  const symbolRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  symbolRoot.setAttribute('viewBox', '-8 -8 16 16');
  snapMarker.append(symbolRoot);
  host.append(snapMarker);
  const axisRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  axisRoot.classList.add('model-axis-feedback');
  axisRoot.setAttribute('aria-hidden', 'true');
  host.append(axisRoot);
  const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const axisLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  axisRoot.append(edgeLayer, axisLayer);
  let feedbackKey = null,
    edgeKey = null;
  const snapStatus = document.createElement('span');
  snapStatus.id = 'snap-status';
  document.querySelector('footer').append(snapStatus);
  function updateSnapOverlay() {
    grid.highlight([
      ...gridPickIds(project.grid, ui.selectedIds),
      ...(tools.drawing ? tools.activeSnap?.gridIds || [] : []),
    ]);
    const active = tools.drawing && tools.activeSnap?.point;
    const snapText =
      active && tools.operation?.mode !== 'workPlane' && !tools.operation?.linearId
        ? tools.activeSnap.label
        : '';
    const text = tools.nextPointSnap
      ? `Nästa punkt: ${nextPointSnapLabel(tools.nextPointSnap)}${snapText ? ` · ${snapText}` : ''}`
      : snapText;
    if (snapStatus.textContent !== text) snapStatus.textContent = text;
    const feedback =
      tools.drawing && (project.snap.axes || +project.snap.polar || tools.axisLock)
        ? modelAxisFeedback({
            snap: tools.activeSnap,
            start: tools.first,
            workPlane: drawingWorkPlane(tools.operation, tools.temporaryPlane),
            camera,
            width: host.clientWidth,
            height: host.clientHeight,
          })
        : null;
    const key = JSON.stringify(feedback);
    if (key !== feedbackKey) {
      feedbackKey = key;
      paintAxisFeedback(axisLayer, feedback);
    }
    const nearest = tools.drawing
      ? modelNearestFeedback(tools.activeSnap, camera, host.clientWidth, host.clientHeight)
      : null;
    const nextEdgeKey = JSON.stringify(nearest);
    if (nextEdgeKey !== edgeKey) {
      edgeKey = nextEdgeKey;
      edgeLayer.replaceChildren();
      paintCadNearestEdge(edgeLayer, nearest);
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
  return { snapMarker, updateSnapOverlay };
}
