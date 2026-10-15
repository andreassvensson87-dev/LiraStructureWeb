import * as THREE from 'three';
export const CONVERSION_TOLERANCE = 0.02;
export const edgeKey = (a, b) => [a, b].sort().join('|');
const tolerance = CONVERSION_TOLERANCE;
const pointKey = (p) => p.map((v) => Math.round(v / tolerance)).join(',');

/** Read the displayed world transform; all predicates use a nearby local origin in millimetres. */
export function conversionMesh(mesh) {
  mesh.updateWorldMatrix(true, false);
  const attribute = mesh.geometry.getAttribute('position'),
    points = [];
  if (!attribute || attribute.count > 20000)
    throw Error('Geometrin är för komplex för säker konvertering.');
  for (let i = 0; i < attribute.count; i++)
    points.push(
      new THREE.Vector3().fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld),
    );
  const origin = points[0]?.clone();
  if (!origin || points.some((p) => !p.toArray().every(Number.isFinite)))
    throw Error('Ogiltig IFC-geometri.');
  points.forEach((p) => p.sub(origin));
  const ids = mesh.geometry.index ? Array.from(mesh.geometry.index.array) : points.map((_, i) => i);
  const triangles = [],
    axes = [],
    topology = new Map();
  let volume = 0;
  for (let i = 0; i < ids.length; i += 3) {
    const vertices = ids.slice(i, i + 3).map((id) => points[id]);
    if (vertices.length !== 3 || vertices.some((p) => !p)) throw Error('Ogiltigt triangelnät.');
    const [a, b, c] = vertices,
      normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.length() < 1e-8) continue;
    volume += a.dot(b.clone().cross(c)) / 6;
    const area = normal.length() / 2;
    normal.normalize();
    triangles.push({ vertices, normal, area });
    const keys = vertices.map((p) => pointKey(p.toArray()));
    for (let j = 0; j < 3; j++) {
      const key = edgeKey(keys[j], keys[(j + 1) % 3]);
      topology.set(key, (topology.get(key) || 0) + 1);
    }
  }
  if (!triangles.length || [...topology.values()].some((count) => count !== 2))
    throw Error('IFC-objektet är inte en sluten solid.');
  for (const { normal } of [...triangles].sort((a, b) => b.area - a.area))
    if (axes.length < 512 && !axes.some((axis) => Math.abs(axis.dot(normal)) > 1 - 1e-12))
      axes.push(normal.clone());
  return { points, triangles, axes, origin, volume };
}
