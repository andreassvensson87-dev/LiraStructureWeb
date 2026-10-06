import * as THREE from 'three';
import { inputWheelGesture, zoomSpeed } from '../input-device.js';
export function cameraPanOffset(camera, x, y, width, height) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  return right
    .multiplyScalar((x * (camera.right - camera.left)) / camera.zoom / Math.max(width, 1))
    .addScaledVector(up, (-y * (camera.top - camera.bottom)) / camera.zoom / Math.max(height, 1));
}
export function installInputNavigation(host, camera, getControls) {
  const wheel = (event) => {
    const gesture = inputWheelGesture(event, undefined, host.clientHeight);
    const controls = getControls();
    controls.zoomSpeed = zoomSpeed();
    if (gesture.action !== 'pan') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!controls.enabled || !controls.enablePan) return;
    const offset = cameraPanOffset(
      camera,
      gesture.x,
      gesture.y,
      host.clientWidth,
      host.clientHeight,
    );
    camera.position.add(offset);
    controls.target.add(offset);
    controls.update();
  };
  host.addEventListener('wheel', wheel, { capture: true, passive: false });
  return () => host.removeEventListener('wheel', wheel, { capture: true });
}
