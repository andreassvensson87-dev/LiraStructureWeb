import * as THREE from 'three';

const emptyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const lineVertex = `
attribute vec4 instanceRow0;
attribute vec4 instanceRow1;
attribute vec4 instanceRow2;
attribute vec4 instanceRow3;
attribute vec3 instanceTint;
varying vec3 tint;
void main() {
  tint = instanceTint;
  mat4 placement = mat4(instanceRow0, instanceRow1, instanceRow2, instanceRow3);
  gl_Position = projectionMatrix * modelViewMatrix * placement * vec4(position, 1.0);
}`;
const lineFragment = `
varying vec3 tint;
void main() {
  gl_FragColor = vec4(tint, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Display copies together; retain original meshes for exact picking and editing. */
export class InstanceBatches {
  constructor(scene, { minimumObjects = 200 } = {}) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.minimumObjects = minimumObjects;
    this.batches = [];
  }
  clear() {
    for (const batch of this.batches) {
      for (const entry of batch.entries) {
        entry.object.traverse((part) => part.layers.set(0));
        delete entry.object.userData.instanced;
      }
      batch.mesh.geometry.dispose();
      batch.mesh.material.dispose();
      batch.lines.geometry.dispose();
      batch.lines.material.dispose();
      batch.mesh.dispose();
    }
    this.group.clear();
    this.batches = [];
  }
  rebuild(objects) {
    this.clear();
    if (objects.length < this.minimumObjects) return;
    const shapes = new Map();
    for (const object of objects) {
      const descriptor = object.userData.instanceDescriptor;
      if (!descriptor || object.material.transparent) continue;
      if (!shapes.has(descriptor.key)) shapes.set(descriptor.key, []);
      shapes.get(descriptor.key).push({ object, descriptor });
    }
    for (const copies of shapes.values()) {
      if (copies.length < 2) continue;
      const first = copies[0];
      const inverse = first.descriptor.matrix.clone().invert();
      const geometry = first.descriptor.geometry.clone();
      if (!first.descriptor.local) geometry.applyMatrix4(inverse);
      const edges = (first.descriptor.edges || first.object.children[0].geometry).clone();
      if (!first.descriptor.local) edges.applyMatrix4(inverse);
      const material = first.object.material.clone();
      material.color.set(0xffffff);
      const mesh = new THREE.InstancedMesh(geometry, material, copies.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const lineGeometry = new THREE.InstancedBufferGeometry();
      lineGeometry.setAttribute('position', edges.getAttribute('position'));
      const matrices = new Float32Array(copies.length * 16);
      const buffer = new THREE.InstancedInterleavedBuffer(matrices, 16).setUsage(
        THREE.DynamicDrawUsage,
      );
      for (let i = 0; i < 4; i++)
        lineGeometry.setAttribute(
          `instanceRow${i}`,
          new THREE.InterleavedBufferAttribute(buffer, 4, i * 4),
        );
      const colors = new THREE.InstancedBufferAttribute(
        new Float32Array(copies.length * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage);
      lineGeometry.setAttribute('instanceTint', colors);
      lineGeometry.instanceCount = copies.length;
      const lines = new THREE.LineSegments(
        lineGeometry,
        new THREE.ShaderMaterial({ vertexShader: lineVertex, fragmentShader: lineFragment }),
      );
      // Bounds of the small template cannot bound all the transformed copies.
      lines.frustumCulled = false;
      const entries = copies.map(({ object, descriptor }, index) => {
        mesh.setMatrixAt(index, descriptor.matrix);
        object.traverse((part) => part.layers.set(3));
        object.userData.instanced = true;
        return {
          object,
          matrix: descriptor.matrix,
          index,
          visible: null,
          bodyColor: new THREE.Color(-1, -1, -1),
          edgeColor: new THREE.Color(-1, -1, -1),
        };
      });
      // Retain conservative bounds when individual copies are hidden and restored.
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      const batch = { mesh, lines, buffer, colors, entries };
      this.batches.push(batch);
      this.group.add(mesh, lines);
      this.syncBatch(batch);
      edges.dispose();
    }
  }
  syncBatch(batch) {
    let matricesChanged = false,
      bodyChanged = false,
      edgesChanged = false;
    for (const entry of batch.entries) {
      const { object, index } = entry;
      if (entry.visible !== object.visible) {
        entry.visible = object.visible;
        const matrix = object.visible ? entry.matrix : emptyMatrix;
        batch.mesh.setMatrixAt(index, matrix);
        matrix.toArray(batch.buffer.array, index * 16);
        matricesChanged = true;
      }
      if (!entry.bodyColor.equals(object.material.color)) {
        entry.bodyColor.copy(object.material.color);
        batch.mesh.setColorAt(index, entry.bodyColor);
        bodyChanged = true;
      }
      const edge = object.children[0].material.color;
      if (!entry.edgeColor.equals(edge)) {
        entry.edgeColor.copy(edge);
        batch.colors.setXYZ(index, edge.r, edge.g, edge.b);
        edgesChanged = true;
      }
    }
    if (matricesChanged) {
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.buffer.needsUpdate = true;
    }
    if (bodyChanged) batch.mesh.instanceColor.needsUpdate = true;
    if (edgesChanged) batch.colors.needsUpdate = true;
  }
  sync() {
    for (const batch of this.batches) this.syncBatch(batch);
  }
}
