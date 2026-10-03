/** Render after edits or camera changes; a resting model should not occupy the GPU. */
export class FrameGate {
  constructor() {
    this.dirty = true;
    this.world = [];
    this.projection = [];
  }
  invalidate() {
    this.dirty = true;
  }
  consume(camera) {
    const world = camera.matrixWorld.elements;
    const projection = camera.projectionMatrix.elements;
    const changed =
      world.some((v, i) => v !== this.world[i]) ||
      projection.some((v, i) => v !== this.projection[i]);
    if (!this.dirty && !changed) return false;
    this.dirty = false;
    this.world = [...world];
    this.projection = [...projection];
    return true;
  }
}
