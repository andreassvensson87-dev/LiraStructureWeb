import * as THREE from 'three';
import { modelFeedbackMeasures } from '../measurements.js';
import { paintMeasurements } from '../../ui/measurement-overlay.js';
import { paintFastenerDirections } from '../../fasteners/preview-directions.js';
export function createModelMeasurementOverlay({
  host,
  camera,
  project,
  ui,
  tools,
  visible,
  getBatch,
  getFastenerBatch = () => [],
  allowsPoint = () => true,
}) {
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('data-model-measurements', '');
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '3',
    overflow: 'hidden',
  });
  host.append(root);
  const projectPoint = (point) => {
    if (!allowsPoint(point)) return null;
    const p = new THREE.Vector3(...point).project(camera);
    if (p.z < -1 || p.z > 1) return null;
    return [((p.x + 1) * host.clientWidth) / 2, ((1 - p.y) * host.clientHeight) / 2];
  };
  return {
    update() {
      root.setAttribute('viewBox', `0 0 ${host.clientWidth} ${host.clientHeight}`);
      root.replaceChildren();
      const measures = modelFeedbackMeasures({ project, ui, tools, visible, batch: getBatch() });
      const fasteners = getFastenerBatch() || [];
      root.hidden = !measures.length && !fasteners.length;
      paintMeasurements(root, measures, projectPoint);
      paintFastenerDirections(root, fasteners, projectPoint);
    },
  };
}
