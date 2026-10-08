import * as THREE from 'three';
import { edgeIndex } from './edge-index.js';
import { applyReferencePlacement } from './reference-placement.js';
export function cadReferenceParts(entities) {
  const parts = [],
    groups = new Map();
  try {
    for (const e of entities.filter((e) => e.type === 'line')) {
      const key = JSON.stringify([e.layer || '0', e.color]);
      if (!groups.has(key)) groups.set(key, []);
      const points = groups.get(key);
      for (let i = 1; i < e.points.length; i++)
        points.push(...e.points[i - 1], 0, ...e.points[i], 0);
    }
    for (const [key, points] of groups) {
      const [layer, color] = JSON.parse(key);
      const box = new THREE.Box3();
      for (let i = 0; i < points.length; i += 3)
        box.expandByPoint(new THREE.Vector3(...points.slice(i, i + 3)));
      const origin = box.getCenter(new THREE.Vector3());
      const edges = new Float64Array(points.map((n, i) => n - origin.getComponent(i % 3)));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edges), 3));
      const mesh = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color, depthWrite: false }),
      );
      mesh.position.copy(origin);
      parts.push({ mesh, edges, index: edgeIndex(edges), opacity: 1, format: 'CAD', layer });
    }
    for (const e of entities.filter((e) => e.type === 'text')) {
      if (!e.text.trim()) continue;
      const canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');
      ctx.font = '72px Arial';
      canvas.width = Math.min(8192, Math.ceil(ctx.measureText(e.text).width + 8));
      canvas.height = 96;
      ctx.font = '72px Arial';
      ctx.fillStyle = e.color;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(e.text, 4, 76);
      const map = new THREE.CanvasTexture(canvas);
      const width = (canvas.width / 72) * e.size,
        height = (canvas.height / 72) * e.size;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
          map,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      const x = e.align === 'end' ? -width / 2 : e.align === 'middle' ? 0 : width / 2;
      const offset = new THREE.Vector3(x, e.size * 0.4, 0).applyAxisAngle(
        new THREE.Vector3(0, 0, 1),
        (e.angle * Math.PI) / 180,
      );
      mesh.position.set(e.point[0] + offset.x, e.point[1] + offset.y, 0.05);
      mesh.rotation.z = (e.angle * Math.PI) / 180;
      parts.push({
        mesh,
        edges: new Float64Array(),
        index: edgeIndex([]),
        opacity: 1,
        format: 'CAD',
        layer: e.layer || '0',
      });
    }
    return parts;
  } catch (error) {
    for (const p of parts) {
      p.mesh.geometry.dispose();
      p.mesh.material.map?.dispose();
      p.mesh.material.dispose();
    }
    throw error;
  }
}
export function applyCADPlacement(model) {
  applyReferencePlacement(model);
}
