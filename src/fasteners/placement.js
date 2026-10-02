import * as THREE from 'three';
import { geometryForModel } from '../model-object.js';
import { fastenerFrame } from './geometry.js';
import { isFastener } from './object-type.js';

/** Separate solid intervals, preserving cavities between walls and flanges. */
export function partAxisIntervals(s, part, model) {
  const f = fastenerFrame(s),
    geometry = geometryForModel(part, model);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  try {
    geometry.computeBoundingBox();
    if (geometry.boundingBox.isEmpty()) throw new Error('Delen saknar material.');
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    const radius = geometry.boundingBox.getSize(new THREE.Vector3()).length();
    const distance = Math.max(1, f.origin.distanceTo(center) + radius + 1);
    const ray = new THREE.Raycaster(f.origin.clone().addScaledVector(f.z, -distance), f.z);
    const groups = [];
    for (const hit of ray.intersectObject(new THREE.Mesh(geometry, material))) {
      const offset = hit.distance - distance;
      const sign = Math.sign(hit.face.normal.dot(f.z));
      if (!sign) continue;
      const last = groups.at(-1);
      if (last && Math.abs(last.offset - offset) < 1e-5) last.signs.add(sign);
      else groups.push({ offset, signs: new Set([sign]) });
    }
    const intervals = [];
    let entry = null;
    for (const { offset, signs } of groups) {
      if (signs.size !== 1) continue;
      if (signs.has(-1)) entry ??= offset;
      else if (entry != null) {
        if (offset - entry > 1e-5) intervals.push({ offset: entry, depth: offset - entry });
        entry = null;
      }
    }
    if (!intervals.length) throw new Error(`Skruvaxeln träffar inte ${part.name || part.id}.`);
    return intervals;
  } finally {
    geometry.dispose();
    material.dispose();
  }
}

/** Full span along the infinite axis, retained for explicit whole-profile calculation. */
export function partAxisInterval(s, part, model) {
  const intervals = partAxisIntervals(s, part, model);
  const first = intervals[0],
    last = intervals.at(-1);
  return { offset: first.offset, depth: last.offset + last.depth - first.offset };
}
const millimeters = (v) => Math.round(v * 1e6) / 1e6;
export const holeExtent = (h) => h.extent || (h.kind === 'pilot' ? 'blind' : 'profile');

/** Evaluate automatic holes only when committing, against material without screw bores. */
export function resolveFastenerHoles(s, model) {
  const materialModel = model.filter((o) => !isFastener(o));
  return {
    ...s,
    holes: s.holes.map((h) => {
      const extent = holeExtent(h);
      if (h.kind === 'none' || extent === 'manual') return { ...h };
      const part = materialModel.find((o) => o.id === h.targetId);
      if (!part) throw new Error('Hålets måldel saknas.');
      const intervals = partAxisIntervals(s, part, materialModel).filter(
        (v) => v.offset + v.depth > 1e-5,
      );
      if (!intervals.length)
        throw new Error(`${part.name || part.id} ligger bakom skruvens ingångspunkt.`);
      const first = intervals[0],
        last = intervals.at(-1);
      if (extent === 'blind' && h.depth > first.depth + 0.001)
        throw new Error(
          `Blindhålet i ${part.name || part.id} är djupare än väggen/flänsen (${first.depth.toFixed(2)} mm).`,
        );
      return {
        ...h,
        extent,
        offset: millimeters(first.offset),
        depth: millimeters(
          extent === 'blind'
            ? h.depth
            : extent === 'wall'
              ? first.depth
              : last.offset + last.depth - first.offset,
        ),
      };
    }),
  };
}
