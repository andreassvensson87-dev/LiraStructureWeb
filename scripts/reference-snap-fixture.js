import * as THREE from 'three';
import { edgeIndex } from '../src/edge-index.js';

/** Shared synthetic CAD/IFC feature geometry; no files or user project data. */
export function referenceSnapFixture({
  references = 20,
  partsPerReference = 1000,
  overlap = false,
} = {}) {
  const geometry = new THREE.BoxGeometry(200, 400, 600);
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edges = edgeGeometry.attributes.position.array.slice();
  const index = edgeIndex(edges);
  const root = new THREE.Group();
  const models = Array.from({ length: references }, (_, ref) => {
    const group = new THREE.Group();
    group.position.set(overlap ? 0 : ref * 20000, 0, 0);
    root.add(group);
    const parts = Array.from({ length: partsPerReference }, (_, i) => {
      const mesh = new THREE.Mesh(geometry);
      mesh.position.set((i % 25) * 600, Math.floor(i / 25) * 600, 0);
      group.add(mesh);
      return { mesh, edges, index };
    });
    return { id: `ref-${ref}`, group, parts, corners: true, edges: true, format: 'IFC' };
  });
  root.updateMatrixWorld(true);
  const camera = new THREE.OrthographicCamera(-4500, 4500, 4500, -4500, 1, 1000000);
  camera.position.set(6000, 6000, 10000);
  camera.lookAt(6000, 6000, 0);
  camera.updateMatrixWorld();
  const queries = Array.from({ length: 240 }, (_, i) => {
    const target = new THREE.Vector3(3000 + (i % 20) * 137, 3000 + Math.floor(i / 20) * 271, 300);
    const clip = target.clone().project(camera),
      caster = new THREE.Raycaster();
    caster.setFromCamera(new THREE.Vector2(clip.x, clip.y), camera);
    return {
      camera,
      ray: caster.ray,
      pointer: [(clip.x + 1) * 640, (1 - clip.y) * 360],
      width: 1280,
      height: 720,
      start: [target.x - 300, target.y + 700, 300],
    };
  });
  return {
    root,
    models,
    queries,
    dispose() {
      geometry.dispose();
      edgeGeometry.dispose();
    },
  };
}
