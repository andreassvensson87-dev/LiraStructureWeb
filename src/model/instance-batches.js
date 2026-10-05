import * as THREE from 'three';
import { displayObjects, invalidateDisplayDetail } from './display-detail.js';
import { HoleBatches } from './hole-batches.js';

const displayed = (object) =>
  object.visible &&
  object.userData.lodOwner?.visible !== false &&
  object.userData.detailVisible !== false;
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
uniform float opacity;
varying vec3 tint;
void main() {
  gl_FragColor = vec4(tint, opacity);
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
    this.holes = new HoleBatches(this.group);
  }
  prepareRebuild() {
    invalidateDisplayDetail(this.objects);
    for (const batch of this.batches)
      for (const entry of batch.entries) {
        entry.object.traverse((part) => part.layers.set(0));
        delete entry.object.userData.instanced;
      }
    for (const entry of this.holes.batch?.entries || []) entry.marker.layers.set(0);
  }
  clear() {
    this.prepareRebuild();
    for (const batch of this.batches) {
      batch.mesh.geometry.dispose();
      batch.mesh.material.dispose();
      batch.lines.geometry.dispose();
      batch.lines.material.dispose();
      batch.mesh.dispose();
    }
    this.holes.clear();
    this.group.clear();
    this.batches = [];
  }
  rebuild(objects) {
    this.clear();
    this.objects = objects;
    invalidateDisplayDetail(objects);
    if (objects.length < this.minimumObjects) return;
    const shapes = new Map();
    for (const object of displayObjects(objects)) {
      const descriptor = object.userData.instanceDescriptor;
      if (!descriptor) continue;
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
        new THREE.ShaderMaterial({
          vertexShader: lineVertex,
          fragmentShader: lineFragment,
          uniforms: { opacity: { value: first.object.material.transparent ? 0.35 : 1 } },
          transparent: first.object.material.transparent,
          depthWrite: !first.object.material.transparent,
        }),
      );
      // Bounds of the small template cannot bound all the transformed copies.
      lines.frustumCulled = false;
      const entries = copies.map(({ object, descriptor }, index) => {
        mesh.setMatrixAt(index, descriptor.matrix);
        object.traverse((part) => part.layers.set(3));
        // Bore markers have their own small geometry and remain visible beside
        // the shared, unperforated body template.
        for (const child of object.children) if (child.userData.holeMarker) child.layers.set(0);
        object.userData.instanced = true;
        return {
          object,
          matrix: descriptor.matrix,
          index,
          center: geometry.boundingBox
            .getCenter(new THREE.Vector3())
            .applyMatrix4(descriptor.matrix),
          depth: 0,
          visible: null,
          bodyColor: new THREE.Color(-1, -1, -1),
          edgeColor: new THREE.Color(-1, -1, -1),
        };
      });
      // Retain conservative bounds when individual copies are hidden and restored.
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      const batch = {
        key: first.descriptor.key,
        mesh,
        lines,
        buffer,
        colors,
        entries,
        cameraSignature: '',
      };
      this.batches.push(batch);
      this.group.add(mesh, lines);
      this.syncBatch(batch);
      edges.dispose();
    }
    this.holes.rebuild(objects);
  }
  /** Keep GPU buffers when a joint edit leaves the same repeated body shapes. */
  update(objects) {
    this.objects = objects;
    invalidateDisplayDetail(objects);
    const shapes = new Map();
    for (const object of displayObjects(objects)) {
      const descriptor = object.userData.instanceDescriptor;
      if (!descriptor) continue;
      if (!shapes.has(descriptor.key)) shapes.set(descriptor.key, new Map());
      shapes.get(descriptor.key).set(object.userData.id, object);
    }
    for (const [key, copies] of shapes) if (copies.size < 2) shapes.delete(key);
    if (
      objects.length < this.minimumObjects ||
      shapes.size !== this.batches.length ||
      this.batches.some((batch) => {
        const copies = shapes.get(batch.key);
        return (
          !copies ||
          copies.size !== batch.entries.length ||
          batch.entries.some((entry) => !copies.has(entry.object.userData.id))
        );
      })
    ) {
      this.rebuild(objects);
      return;
    }
    for (const batch of this.batches) {
      const copies = shapes.get(batch.key);
      let placementChanged = false;
      for (const entry of batch.entries) {
        entry.object = copies.get(entry.object.userData.id);
        const matrix = entry.object.userData.instanceDescriptor.matrix;
        if (!entry.matrix.equals(matrix)) {
          entry.matrix = matrix;
          entry.center
            .copy(batch.mesh.geometry.boundingBox.getCenter(new THREE.Vector3()))
            .applyMatrix4(matrix);
          entry.visible = null;
          placementChanged = true;
        }
        entry.object.traverse((part) =>
          part.layers.set(entry.object.userData.detailVisible === false ? 2 : 3),
        );
        for (const child of entry.object.children)
          if (child.userData.holeMarker) child.layers.set(0);
        entry.object.userData.instanced = true;
      }
      if (placementChanged) {
        batch.cameraSignature = '';
        const bounds = new THREE.Box3(),
          box = new THREE.Box3();
        for (const entry of batch.entries)
          bounds.union(box.copy(batch.mesh.geometry.boundingBox).applyMatrix4(entry.matrix));
        batch.mesh.boundingBox = bounds;
        batch.mesh.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
      }
      this.syncBatch(batch);
    }
    this.holes.update(objects);
  }
  setTransparentView(transparentView) {
    this.holes.setTransparentView(transparentView);
    for (const batch of this.batches) {
      batch.mesh.material.transparent = transparentView;
      batch.mesh.material.opacity = transparentView ? 0.3 : 1;
      batch.mesh.material.depthWrite = !transparentView;
      batch.mesh.material.needsUpdate = true;
      batch.lines.material.transparent = transparentView;
      batch.lines.material.depthWrite = !transparentView;
      batch.lines.material.uniforms.opacity.value = transparentView ? 0.35 : 1;
      batch.lines.material.needsUpdate = true;
      batch.cameraSignature = '';
    }
  }
  syncBatch(batch, camera = null) {
    if (!batch.entries.some((entry) => displayed(entry.object))) {
      if (batch.mesh.visible) {
        for (const entry of batch.entries) {
          entry.visible = false;
          batch.mesh.setMatrixAt(entry.index, emptyMatrix);
          emptyMatrix.toArray(batch.buffer.array, entry.index * 16);
        }
        batch.mesh.instanceMatrix.needsUpdate = true;
        batch.buffer.needsUpdate = true;
      }
      batch.mesh.visible = batch.lines.visible = false;
      batch.mesh.count = batch.lines.geometry.instanceCount = 0;
      return;
    }
    let reordered = false;
    if (camera && batch.mesh.material.transparent) {
      const signature = camera.matrixWorldInverse.elements.join(',');
      if (signature !== batch.cameraSignature) {
        batch.cameraSignature = signature;
        const e = camera.matrixWorldInverse.elements;
        for (const entry of batch.entries)
          entry.depth =
            e[2] * entry.center.x + e[6] * entry.center.y + e[10] * entry.center.z + e[14];
        batch.entries.sort((a, b) => a.depth - b.depth);
      }
    }
    // Submit only visible instances. Hidden screws must not consume vertex work
    // when a single screw is selected in an otherwise distant overview.
    let hiddenSeen = false,
      partitionNeeded = false,
      visibleCount = 0;
    for (const entry of batch.entries) {
      if (displayed(entry.object)) {
        visibleCount++;
        partitionNeeded ||= hiddenSeen;
      } else hiddenSeen = true;
    }
    if (partitionNeeded)
      batch.entries = [
        ...batch.entries.filter((entry) => displayed(entry.object)),
        ...batch.entries.filter((entry) => !displayed(entry.object)),
      ];
    reordered = batch.entries.some((entry, index) => entry.index !== index);
    for (let i = 0; i < batch.entries.length; i++) batch.entries[i].index = i;
    batch.mesh.count = batch.lines.geometry.instanceCount = visibleCount;
    let matricesChanged = false,
      bodyChanged = false,
      edgesChanged = false,
      anyVisible = false;
    for (const entry of batch.entries) {
      const { object, index } = entry;
      const visible = displayed(object);
      anyVisible ||= visible;
      if (reordered || entry.visible !== visible) {
        entry.visible = visible;
        const matrix = visible ? entry.matrix : emptyMatrix;
        batch.mesh.setMatrixAt(index, matrix);
        matrix.toArray(batch.buffer.array, index * 16);
        matricesChanged = true;
      }
      if (reordered || !entry.bodyColor.equals(object.material.color)) {
        entry.bodyColor.copy(object.material.color);
        batch.mesh.setColorAt(index, entry.bodyColor);
        bodyChanged = true;
      }
      const edge = object.children[0].material.color;
      if (reordered || !entry.edgeColor.equals(edge)) {
        entry.edgeColor.copy(edge);
        batch.colors.setXYZ(index, edge.r, edge.g, edge.b);
        edgesChanged = true;
      }
    }
    batch.mesh.visible = batch.lines.visible = anyVisible;
    if (matricesChanged) {
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.buffer.needsUpdate = true;
    }
    if (bodyChanged) batch.mesh.instanceColor.needsUpdate = true;
    if (edgesChanged) batch.colors.needsUpdate = true;
  }
  sync(camera = null) {
    for (const batch of this.batches) this.syncBatch(batch, camera);
    this.holes.sync(camera);
  }
}
