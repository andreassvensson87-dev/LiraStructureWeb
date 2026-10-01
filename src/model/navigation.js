import * as THREE from 'three';
/** Owns orthographic framing and control replacement, independent of project and DOM. */
export class ModelNavigation {
  constructor({ camera, controls, createControls, getSize }) {
    Object.assign(this, { camera, controls, createControls, getSize });
    this.viewHeight = 10000;
    this.projectionOffset = new THREE.Vector2();
  }
  updateProjection() {
    const [width, height] = this.getSize();
    const aspect = width / Math.max(height, 1);
    const { camera, projectionOffset, viewHeight } = this;
    camera.left = projectionOffset.x - (viewHeight * aspect) / 2;
    camera.right = projectionOffset.x + (viewHeight * aspect) / 2;
    camera.top = projectionOffset.y + viewHeight / 2;
    camera.bottom = projectionOffset.y - viewHeight / 2;
    camera.updateProjectionMatrix();
  }
  fit(bounds, direction) {
    const { camera, controls } = this;
    this.projectionOffset.set(0, 0);
    const center = bounds.isEmpty()
      ? new THREE.Vector3(1500, 0, 0)
      : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty()
      ? 4000
      : Math.max(bounds.getSize(new THREE.Vector3()).length(), 500);
    const d = direction || camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(center);
    const [width, height] = this.getSize();
    const aspect = width / Math.max(height, 1);
    this.viewHeight = (size * 1.35) / Math.min(aspect, 1);
    camera.zoom = 1;
    this.updateProjection();
    camera.position.copy(center).addScaledVector(d, Math.max(size * 2, 10000));
    controls.update();
  }
  // OrbitControls caches camera.up at construction; replace controls when axes change.
  setViewUp(up) {
    const { camera } = this;
    const previous = this.controls,
      target = previous.target.clone(),
      position = camera.position.clone();
    const options = Object.fromEntries(
      ['enableDamping', 'enabled', 'zoomToCursor', 'minZoom', 'maxZoom'].map((key) => [
        key,
        previous[key],
      ]),
    );
    const mouseButtons = { ...previous.mouseButtons },
      touches = { ...previous.touches };
    previous.dispose();
    camera.up.copy(up);
    this.controls = this.createControls();
    Object.assign(this.controls, options, { mouseButtons, touches });
    this.controls.target.copy(target);
    camera.position.copy(position);
  }
  lookAtPlane(center, normal, up) {
    const { camera } = this;
    const distance = Math.max(camera.position.distanceTo(this.controls.target), 10000);
    this.setViewUp(up);
    this.projectionOffset.set(0, 0);
    this.updateProjection();
    this.controls.target.copy(center);
    camera.position.copy(center).addScaledVector(normal, distance);
    this.controls.update();
    camera.updateMatrixWorld();
  }
  movePivot(point) {
    const { camera, controls } = this;
    const delta = point.clone().sub(controls.target);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    // Preserve the image while moving the orbit pivot.
    this.projectionOffset.x -= delta.dot(right);
    this.projectionOffset.y -= delta.dot(up);
    camera.position.add(delta);
    controls.target.copy(point);
    this.updateProjection();
    camera.updateMatrixWorld();
  }
}
