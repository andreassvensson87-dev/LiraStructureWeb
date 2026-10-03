import * as THREE from 'three';
import { geometryForModel } from '../model-object.js';
import { boreFeature } from './holes.js';
import { axisPlacement, fastenerFrame } from './geometry.js';
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
      else groups.push({ offset, signs: new Set([sign]), normal: hit.face.normal.clone() });
    }
    const intervals = [];
    let entry = null;
    for (const { offset, signs, normal } of groups) {
      if (signs.size !== 1) continue;
      if (signs.has(-1)) entry ??= { offset, normal };
      else if (entry != null) {
        if (offset - entry.offset > 1e-5)
          intervals.push({
            offset: entry.offset,
            depth: offset - entry.offset,
            entryNormal: entry.normal.toArray(),
            exitNormal: normal.toArray(),
          });
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

/** Contact points describe the grip; shaft length remains a library dimension. */
export function spanPlacement(s, entry, exit) {
  const axis = new THREE.Vector3(...exit).sub(new THREE.Vector3(...entry));
  const grip = axis.length();
  if (grip < 0.001) throw new Error('Välj två olika anliggningsytor.');
  axis.normalize();
  const headWasher = s.washers?.head ? s.spec.washer?.thickness || 0 : 0;
  const nutWasher = s.washers?.nut ? s.spec.washer?.thickness || 0 : 0;
  const start = new THREE.Vector3(...entry).addScaledVector(axis, -headWasher).toArray();
  const nutOffset = headWasher + grip + nutWasher;
  if (s.spec.kind === 'bolt' && nutOffset + s.spec.nut.thickness > s.spec.length + 0.001)
    throw new Error(
      `Skruven är för kort. Förband, brickor och mutter kräver minst ${(nutOffset + s.spec.nut.thickness).toFixed(2)} mm.`,
    );
  return {
    ...s,
    ...axisPlacement(s.spec, start, exit),
    span: { start: [...entry], end: [...exit] },
    ...(s.spec.kind === 'bolt' ? { nutOffset: millimeters(nutOffset) } : {}),
  };
}

/** Evaluate automatic holes only when committing, against material without screw bores. */
export function resolveFastenerHoles(s, model) {
  const materialModel = model.filter((o) => !isFastener(o));
  if (s.span) {
    const f = fastenerFrame(s);
    const from = new THREE.Vector3(...s.span.start).sub(f.origin).dot(f.z);
    const to = new THREE.Vector3(...s.span.end).sub(f.origin).dot(f.z);
    const boundaries = s.holes.flatMap((h) => {
      const part = materialModel.find((o) => o.id === h.targetId);
      if (!part) return [];
      try {
        return partAxisIntervals(s, part, materialModel).flatMap((v) => [
          { offset: v.offset, normal: v.entryNormal },
          { offset: v.offset + v.depth, normal: v.exitNormal },
        ]);
      } catch {
        return [];
      }
    });
    if (![from, to].every((v) => boundaries.some((b) => Math.abs(v - b.offset) < 0.05)))
      throw new Error(
        'Anliggningspunkterna måste ligga på valda delars ytor. Justera punkterna i inspectorn.',
      );
    if (
      ![from, to].every((v) =>
        boundaries.some(
          (b) =>
            Math.abs(v - b.offset) < 0.05 &&
            Math.abs(new THREE.Vector3(...b.normal).dot(f.z)) > 0.9999,
        ),
      )
    )
      throw new Error(
        'Anliggningsytorna måste vara vinkelräta mot skruven. Sneda ytor kräver annan bricka eller manuellt läge.',
      );
  }
  return {
    ...s,
    holes: s.holes.map((h) => {
      h = boreFeature({ ...h, id: h.id || `bore-${h.targetId}` });
      const extent = holeExtent(h);
      if (h.kind === 'none' || extent === 'manual') return { ...h };
      const part = materialModel.find((o) => o.id === h.targetId);
      if (!part) throw new Error('Hålets måldel saknas.');
      const intervals = partAxisIntervals(s, part, materialModel).filter(
        (v) => v.offset + v.depth > 1e-5,
      );
      if (!intervals.length)
        throw new Error(`${part.name || part.id} ligger bakom skruvens ingångspunkt.`);
      let selected = intervals;
      if (s.span && extent !== 'manual') {
        const f = fastenerFrame(s);
        const from = new THREE.Vector3(...s.span.start).sub(f.origin).dot(f.z);
        const to = new THREE.Vector3(...s.span.end).sub(f.origin).dot(f.z);
        selected = intervals
          .map((v) => {
            const a = Math.max(from, v.offset),
              b = Math.min(to, v.offset + v.depth);
            return { offset: a, depth: b - a };
          })
          .filter((v) => v.depth > 0.001);
        if (!selected.length)
          throw new Error(`Punktsträckan träffar inte material i ${part.name || part.id}.`);
      }
      const first = selected[0],
        last = selected.at(-1);
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
