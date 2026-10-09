import { validateBeamSplice, resolveBeamSplice, beamSpliceMembers } from './beam-splice.js';
import {
  validateBoltedEndplate,
  resolveBoltedEndplate,
  boltedEndplateMembers,
} from './bolted-endplate.js';
import { validateEndplate, resolveEndplate, endplateMembers } from './endplate.js';
import { validateStiffener, resolveStiffener, stiffenerMembers } from './stiffener.js';
import * as THREE from 'three';
import { validateBaseplate, resolveBaseplate, baseplateMembers } from './baseplate.js';
import { nextNumber } from '../identity-number.js';
import { plateType } from '../model/object-types/plate-type.js';
import { fastenerType } from '../fasteners/object-type.js';
import { sweepFrame, sweepCorners, profileAnchor } from '../sweep.js';
import { roundProfile } from '../round-profile.js';
import { lineCutGeometry, lineCutTool, lineCutFrame } from '../line-cut.js';

export const isComponent = (s) => s?.type === 'component';
const isSweep = (s) => s && (s.type ?? 'sweep') === 'sweep';
const vec = (p) => new THREE.Vector3(...p);
export function validateFit(s) {
  if (s.kind !== 'fit' || !['miter', 'abut'].includes(s.mode)) return 'Välj en giltig Fit.';
  if (
    !Array.isArray(s.references) ||
    s.references.length !== 2 ||
    s.references.some((id) => typeof id !== 'string' || !id || id === s.id) ||
    s.references[0] === s.references[1]
  )
    return 'Fit behöver två olika sweeps.';
  if (!['start', 'end'].includes(s.endA) || !['start', 'end'].includes(s.endB))
    return 'Välj ändar för Fit.';
  if (!Number.isFinite(s.gap) || s.gap < 0 || s.gap > 1000) return 'Spalten måste vara 0–1 000 mm.';
  return '';
}
function plane(origin, normal, keep, targetId) {
  const n = normal.clone().normalize();
  if (keep.clone().sub(origin).dot(n) > 0) n.negate();
  const u = new THREE.Vector3(Math.abs(n.z) < 0.9 ? 0 : 1, 0, Math.abs(n.z) < 0.9 ? 1 : 0)
    .cross(n)
    .normalize();
  const v = n.clone().negate();
  return {
    type: 'linecut',
    targets: [targetId],
    frame: { origin: origin.toArray(), u: u.toArray(), v: v.toArray() },
    polygon: [
      [-150, 0],
      [150, 0],
    ],
    side: 'positive',
  };
}
/** A Fit stores references; planes are regenerated from the current uncut sweep definitions. */
export function resolveFit(s, model) {
  const error = validateFit(s);
  if (error) throw new Error(error);
  const [a, b] = s.references.map((id) => model.find((o) => o.id === id));
  if (!isSweep(a) || !isSweep(b)) throw new Error('Fit saknar en refererad sweep.');
  const fa = sweepFrame(a),
    fb = sweepFrame(b),
    delta = fb.start.clone().sub(fa.start);
  const cosine = fa.axis.dot(fb.axis),
    denominator = 1 - cosine ** 2;
  if (denominator < 1e-8) throw new Error('Fit behöver sweeps med olika riktningar.');
  const ta = (delta.dot(fa.axis) - cosine * delta.dot(fb.axis)) / denominator;
  const tb = (cosine * delta.dot(fa.axis) - delta.dot(fb.axis)) / denominator;
  const pa = fa.start.clone().addScaledVector(fa.axis, ta),
    pb = fb.start.clone().addScaledVector(fb.axis, tb);
  // Report separation perpendicular to both axes without blocking a theoretical fit.
  const transverse = fa.axis.clone().cross(fb.axis).normalize();
  const intervals = [a, b].map((source, index) => {
    const round = roundProfile(source);
    if (round) {
      const frame = index === 0 ? fa : fb;
      const [ax, ay] = profileAnchor(source);
      const center = frame.start
        .clone()
        .addScaledVector(frame.x, -ax)
        .addScaledVector(frame.y, -ay)
        .sub(pa)
        .dot(transverse);
      return [center - round.outer, center + round.outer];
    }
    const projections = sweepCorners(source).map((p) => vec(p).sub(pa).dot(transverse));
    return [Math.min(...projections), Math.max(...projections)];
  });
  const profileOverlap =
    Math.min(intervals[0][1], intervals[1][1]) - Math.max(intervals[0][0], intervals[1][0]) > 1e-6;
  const junction = pa.clone().add(pb).multiplyScalar(0.5);
  const keepA = vec(a[s.endA === 'start' ? 'end' : 'start']);
  const keepB = vec(b[s.endB === 'start' ? 'end' : 'start']);
  const da = fa.axis.clone().multiplyScalar(s.endA === 'end' ? 1 : -1);
  const db = fb.axis.clone().multiplyScalar(s.endB === 'end' ? 1 : -1);
  let cuts;
  if (s.mode === 'miter') {
    const n = da.clone().sub(db).normalize();
    cuts = [plane(junction, n, keepA, a.id), plane(junction, n, keepB, b.id)];
    for (const cut of cuts) {
      const p = vec(cut.frame.origin),
        normal = lineCutFrame(cut).n;
      cut.frame.origin = p.addScaledVector(normal, -s.gap / 2).toArray();
    }
  } else {
    if (ta < 0 || ta > fa.start.distanceTo(fa.end))
      throw new Error('Anslutningen måste ligga längs den genomgående sweepen.');
    // Choose the outer side of the through member reached by the incoming member.
    const candidates = [fa.x, fa.y]
      .map((axis) => {
        const projections = sweepCorners(a).map((p) => vec(p).sub(fa.start).dot(axis));
        const direction = db.dot(axis);
        if (Math.abs(direction) < 1e-8) return null;
        const sign = direction > 0 ? -1 : 1;
        const surface = sign < 0 ? Math.min(...projections) : Math.max(...projections);
        const normal = axis.clone().multiplyScalar(sign);
        // A side belongs to the first axis, not the midpoint between skew axes.
        const origin = pa.clone().addScaledVector(axis, surface).addScaledVector(normal, s.gap);
        const distance = origin.clone().sub(keepB).dot(axis) / direction;
        return { origin, normal, distance };
      })
      .filter(Boolean)
      .sort((x, y) => x.distance - y.distance);
    const face = candidates.at(-1);
    cuts = [plane(face.origin, face.normal, keepB, b.id)];
  }
  for (const cut of cuts) {
    const target = cut.targets[0] === a.id ? a : b;
    const n = lineCutFrame(cut).n,
      origin = vec(cut.frame.origin);
    const retained = vec(
      target[
        cut.targets[0] === a.id
          ? s.endA === 'start'
            ? 'end'
            : 'start'
          : s.endB === 'start'
            ? 'end'
            : 'start'
      ],
    );
    if (retained.sub(origin).dot(n) >= -1)
      throw new Error(
        'Kapplanet ligger förbi hela sweepen. Välj den andra änden eller ändra läget.',
      );
  }
  return {
    ...s,
    targets: cuts.flatMap((c) => c.targets),
    cuts,
    position: junction.toArray(),
    profileOverlap,
  };
}
/** Extend only the connected end far enough for a complete planar cut across the profile. */
export function fitEnvelope(source, cuts) {
  if ((source.type ?? 'sweep') !== 'sweep') return source;
  let result = source;
  for (const component of cuts.filter(isComponent)) {
    const index = component.references.indexOf(source.id);
    const end = index === 0 ? component.endA : component.endB;
    const cut = component.cuts.find((c) => c.targets.includes(source.id));
    if (!cut) continue;
    const { n, origin } = lineCutFrame(cut);
    const frame = sweepFrame(result);
    const direction = frame.axis.clone().multiplyScalar(end === 'end' ? 1 : -1);
    const dot = direction.dot(n);
    if (dot <= 1e-8) continue;
    const endpoint = vec(result[end]);
    const corners = sweepCorners(result);
    const distances = corners.map((p) =>
      vec(p).sub(endpoint).addScaledVector(frame.axis, -vec(p).sub(endpoint).dot(frame.axis)),
    );
    const reach = Math.max(
      ...distances.map((offset) => origin.clone().sub(endpoint).sub(offset).dot(n) / dot),
    );
    result = { ...result, [end]: endpoint.addScaledVector(direction, reach + 1).toArray() };
  }
  return result;
}
export function resolveComponent(s, model) {
  if (s.kind === 'beamSplice') return resolveBeamSplice(s, model);
  if (s.kind === 'fit') return resolveFit(s, model);
  if (s.kind === 'baseplate') return resolveBaseplate(s, model);
  if (s.kind === 'stiffener') return resolveStiffener(s, model);
  if (s.kind === 'endplate') return resolveEndplate(s, model);
  if (s.kind === 'boltedEndplate') return resolveBoltedEndplate(s, model);
  throw new Error('Okänd koppling.');
}
export function updateComponents(before, after) {
  const previous = new Map(before.map((s) => [s.id, s]));
  const current = new Map(after.map((s) => [s.id, s]));
  const result = after
    .filter(
      (s) => !s.generatedBy && (!isComponent(s) || s.references.every((id) => current.has(id))),
    )
    .map((s) => {
      if (!isComponent(s)) return s;
      if (
        !['endplate', 'boltedEndplate', 'beamSplice'].includes(s.kind) &&
        previous.get(s.id) === s &&
        s.cuts &&
        s.references.every((id) => previous.get(id) === current.get(id))
      )
        return s;
      return resolveComponent(s, after);
    });
  for (const component of result.filter(
    (s) =>
      isComponent(s) &&
      ['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(s.kind),
  )) {
    const members =
      component.kind === 'beamSplice'
        ? beamSpliceMembers(component, after)
        : component.kind === 'boltedEndplate'
          ? boltedEndplateMembers(component, after)
          : component.kind === 'endplate'
            ? endplateMembers(component, after)
            : component.kind === 'stiffener'
              ? stiffenerMembers(component, after)
              : baseplateMembers(component, after);
    for (const member of members) {
      const old = current.get(member.id);
      for (const key of ['partSeries', 'assemblySeries'])
        if (old?.[key]) member[key] = structuredClone(old[key]);
      result.push(
        member.prefix && member.number
          ? member
          : {
              ...member,
              ...nextNumber(
                member.prefix || (member.type === 'plate' ? plateType.prefix : fastenerType.prefix),
                result,
              ),
            },
      );
    }
  }
  return result;
}
export const componentType = {
  id: 'component',
  label: 'Koppling',
  prefix: 'K',
  family: 'component',
  inspector: 'component',
  cut: true,
  physical: false,
  validate: (s) =>
    s.kind === 'beamSplice'
      ? validateBeamSplice(s)
      : s.kind === 'boltedEndplate'
        ? validateBoltedEndplate(s)
        : s.kind === 'endplate'
          ? validateEndplate(s)
          : s.kind === 'stiffener'
            ? validateStiffener(s)
            : s.kind === 'baseplate'
              ? validateBaseplate(s)
              : validateFit(s),
  geometry: (s) => (s.cuts.length ? lineCutGeometry(s.cuts[0]) : new THREE.BufferGeometry()),
  cutGeometry: (s, geometry, target) => {
    const cut = s.cuts.find((c) => c.targets.includes(target.id));
    return cut ? lineCutTool(cut, geometry) : null;
  },
  anchors: (s) => [s.position],
  corners: (s) => [s.position],
  snapSegments: () => ({ segments: [], includeEdges: false }),
  translate: (s) => s,
  rotate: (s) => s,
};
