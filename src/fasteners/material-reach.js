import { assemblyAllowance } from './assembly.js';
import { fastenerAccessories } from './accessories.js';

const EPS = 0.001;
export const REACH_WARNINGS = ['incomplete-layer', 'hardware'];

/** Length under the head starts before material; rod projection already includes near hardware. */
export function entryAllowance(s) {
  const assembly = assemblyAllowance(s);
  if (assembly != null) return assembly;
  if (s.spec.kind === 'rod') return s.startAllowance || 0;
  if (s.accessories != null)
    return s.accessories.some((item) => item.kind === 'washer' && Math.abs(item.offset) < EPS)
      ? s.spec.washer?.thickness || 0
      : 0;
  return s.washers?.head ? s.spec.washer.thickness : 0;
}

/** Available grip uses the same selected hardware as fittedAssembly, never a nominal clearance. */
export function materialReach(s) {
  const before = entryAllowance(s);
  let end = s.spec.length;
  if (s.assembly) {
    const a = s.assembly;
    end -=
      (a.farWasher ? s.spec.washer.thickness : 0) +
      (a.nut ? s.spec.nut.thickness : 0) +
      (a.extraNut ? s.spec.nut.thickness : 0);
  } else if (s.accessories != null) {
    // Explicit accessory positions remain fixed. Material must end before the first far accessory.
    const far = fastenerAccessories(s).filter((item) => item.offset >= before - EPS);
    if (far.length) end = Math.min(end, ...far.map((item) => item.offset));
  } else if (s.spec.kind === 'bolt') {
    end -= s.spec.nut.thickness + (s.washers?.nut ? s.spec.washer.thickness : 0);
  }
  return { grip: Math.max(0, end - before), shaft: Math.max(0, s.spec.length - before) };
}

/** Complete through-layers only. Blind drilling remains an explicit hole choice. */
export function reachableMaterialLayers(s, candidates, first, limit = null) {
  const reach = materialReach(s);
  const end = first + reach.grip;
  const shaftEnd = first + reach.shaft;
  const layers = [];
  let warning = null;
  for (const layer of [...candidates].sort((a, b) => a.offset - b.offset)) {
    if (layer.offset >= first + (limit ?? Infinity) - EPS) continue;
    const hole = s.holes.find((h) => h.targetId === layer.targetId);
    if (hole.kind === 'pilot') {
      const depth = Math.min(layer.depth, hole.depth, end - layer.offset);
      if (depth > EPS) layers.push({ ...layer, depth });
      continue;
    }
    const exit = layer.offset + layer.depth;
    if (exit <= end + EPS) layers.push({ ...layer });
    else if (shaftEnd > layer.offset + EPS && !warning)
      warning = shaftEnd < exit - EPS ? 'incomplete-layer' : 'hardware';
  }
  return { layers, warning };
}
