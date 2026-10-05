import * as THREE from 'three';

/** Merge symbolic bores, retaining a triangle range and visibility for each part. */
export class HoleBatches {
  constructor(group) {
    this.group = group;
    this.batch = null;
  }
  clear() {
    if (!this.batch) return;
    const { mesh, entries } = this.batch;
    for (const { marker } of entries) {
      marker.layers.set(marker.userData.detailVisible === false ? 2 : 0);
      delete marker.userData.grouped;
    }
    this.group.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    this.batch = null;
  }
  rebuild(objects) {
    this.clear();
    const entries = [];
    let count = 0;
    for (const object of objects) {
      if (object.userData.ghost) continue;
      for (const marker of object.children) {
        if (!marker.userData.holeMarker) continue;
        const position = marker.geometry.attributes.position;
        entries.push({
          object,
          marker,
          start: count,
          count: position.count,
          center: marker.geometry.boundingBox.getCenter(new THREE.Vector3()),
          offset: -1,
          visible: null,
          depth: 0,
        });
        count += position.count;
      }
    }
    if (entries.length < 2) return;
    const positions = new Float32Array(count * 3);
    for (const { marker, start } of entries) {
      positions.set(marker.geometry.attributes.position.array, start * 3);
      marker.layers.set(3);
      marker.userData.grouped = true;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(count), 1));
    geometry.boundingBox = new THREE.Box3();
    for (const { marker } of entries) geometry.boundingBox.union(marker.geometry.boundingBox);
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(geometry, entries[0].marker.material.clone());
    mesh.raycast = () => {};
    this.batch = { mesh, entries, cameraSignature: '' };
    this.group.add(mesh);
    this.sync();
  }
  update(objects) {
    const markers = new Map();
    for (const object of objects) {
      if (object.userData.ghost) continue;
      const marker = object.children.find((child) => child.userData.holeMarker);
      if (marker) markers.set(object.userData.id, { object, marker });
    }
    const batch = this.batch;
    if (
      !batch ||
      markers.size !== batch.entries.length ||
      batch.entries.some(
        (entry) =>
          markers.get(entry.object.userData.id)?.marker.geometry.attributes.position.count !==
          entry.count,
      )
    ) {
      this.rebuild(objects);
      return;
    }
    const position = batch.mesh.geometry.attributes.position;
    let changed = false;
    const bounds = new THREE.Box3();
    for (const entry of batch.entries) {
      const next = markers.get(entry.object.userData.id);
      if (next.marker.geometry !== entry.marker.geometry) {
        position.array.set(next.marker.geometry.attributes.position.array, entry.start * 3);
        position.addUpdateRange(entry.start * 3, entry.count * 3);
        changed = true;
      }
      entry.marker.layers.set(0);
      entry.object = next.object;
      entry.marker = next.marker;
      entry.marker.layers.set(3);
      entry.marker.userData.grouped = true;
      entry.marker.geometry.boundingBox.getCenter(entry.center);
      bounds.union(entry.marker.geometry.boundingBox);
    }
    if (changed) position.needsUpdate = true;
    batch.mesh.geometry.boundingBox = bounds;
    batch.mesh.geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    batch.cameraSignature = '';
    this.sync();
  }
  setTransparentView(transparent) {
    if (!this.batch) return;
    const material = this.batch.mesh.material;
    material.transparent = transparent;
    material.opacity = transparent ? 0.65 : 1;
    material.depthWrite = !transparent;
    material.needsUpdate = true;
    this.batch.cameraSignature = '';
  }
  sync(camera = null) {
    const batch = this.batch;
    if (!batch) return;
    const shown = (entry) =>
      entry.object.visible && entry.marker.visible && entry.marker.userData.detailVisible !== false;
    if (!batch.mesh.visible && !batch.entries.some(shown)) return;
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
    let hiddenSeen = false,
      partition = false,
      visibleCount = 0;
    for (const entry of batch.entries) {
      if (shown(entry)) {
        visibleCount += entry.count;
        partition ||= hiddenSeen;
      } else hiddenSeen = true;
    }
    if (partition)
      batch.entries = [
        ...batch.entries.filter(shown),
        ...batch.entries.filter((entry) => !shown(entry)),
      ];
    batch.mesh.visible = visibleCount > 0;
    batch.mesh.geometry.setDrawRange(0, visibleCount);
    const index = batch.mesh.geometry.index;
    let offset = 0,
      changed = false;
    for (const entry of batch.entries) {
      const visible = shown(entry);
      if (entry.offset !== offset || entry.visible !== visible) {
        // A hidden range consists of degenerate triangles; restoring it keeps
        // its original vertices and requires no geometry rebuild.
        for (let i = 0; i < entry.count; i++)
          index.array[offset + i] = entry.start + (visible ? i : 0);
        entry.offset = offset;
        entry.visible = visible;
        changed = true;
      }
      offset += entry.count;
    }
    if (changed) index.needsUpdate = true;
  }
}
