import * as THREE from 'three';
import { geometryForModel } from '../model-object.js';

export function solidMeasures(geometry, matrix = new THREE.Matrix4()) {
  const positions = geometry.attributes.position,
    ids = geometry.index?.array;
  const points = Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix),
  );
  const box = new THREE.Box3().setFromPoints(points),
    origin = box.getCenter(new THREE.Vector3());
  const count = ids?.length ?? positions.count;
  let volume = 0,
    surfaceArea = 0;
  for (let i = 0; i < count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => points[ids?.[i + k] ?? i + k].clone().sub(origin));
    surfaceArea += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    volume += a.dot(b.cross(c)) / 6;
  }
  return {
    volume: Math.abs(volume),
    surfaceArea,
    bounds: [...box.min.toArray(), ...box.max.toArray()],
  };
}

/** Bound the unavoidable Float32 coordinate rounding by surface area, never by profile name.
 * The mesh proof still uses 0.02 mm and 1e-4 relative volume before model tessellation. */
export function compareSolids(source, converted) {
  const largest = Math.max(1, ...source.bounds.map(Math.abs), ...converted.bounds.map(Math.abs));
  const rounding = Math.sqrt(3) * 2 ** (Math.floor(Math.log2(largest)) - 24);
  const volumeError = Math.abs(converted.volume - source.volume);
  const volumeErrorLimit = source.volume * 1e-4 + source.surfaceArea * rounding;
  const maxBoundsErrorMM = Math.max(
    ...source.bounds.map((v, i) => Math.abs(v - converted.bounds[i])),
  );
  return {
    relativeVolumeError: volumeError / source.volume,
    relativeVolumeErrorLimit: volumeErrorLimit / source.volume,
    maxBoundsErrorMM,
    comparisonPassed:
      source.volume > 0 &&
      Number.isFinite(volumeError) &&
      volumeError <= volumeErrorLimit &&
      maxBoundsErrorMM <= 0.05,
  };
}

/** Validate the existing CSG path before offering a capped conversion, without library substitution. */
export function verifyCutConversion(mesh, object, cuts) {
  if (!cuts.length) return;
  const target = { ...object, id: 'conversion-target' };
  const model = [
    target,
    ...cuts.map((cut, i) => ({ ...cut, id: 'conversion-cut-' + i, targets: [target.id] })),
  ];
  const geometry = geometryForModel(target, model);
  try {
    const source = solidMeasures(mesh.geometry, mesh.matrixWorld),
      converted = solidMeasures(geometry);
    if (!compareSolids(source, converted).comparisonPassed)
      throw Error(
        'Kapningens slutgeometri avviker från IFC-objektet och kan inte konverteras säkert.',
      );
  } finally {
    geometry.dispose();
  }
}
