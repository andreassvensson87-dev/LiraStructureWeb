import * as THREE from 'three';
import { transformSpan } from './holes.js';
import { fastenerGroupBatch } from './groups.js';
import {
  applyFastenerLayout,
  fastenerLayoutFromPoints,
  fastenerLayoutFromThreePoints,
  fastenerLayoutAnchors,
  layoutForFastener,
} from './placement-frame.js';

/** Pattern edits use the ordinary grip transaction; shafts retain their manual length. */
export function moveFastenerGroupGrips(sources, refs, target, base, model) {
  const updates = new Map(),
    groups = new Map();
  for (const source of sources)
    if (source.group && !source.generatedBy) {
      if (!groups.has(source.group.id)) groups.set(source.group.id, []);
      groups.get(source.group.id).push(source);
    }
  for (const members of groups.values()) {
    const ids = new Set(members.map((s) => s.id));
    const chosen = refs.filter((r) => ids.has(r.id));
    if (!chosen.length) continue;
    const source = members.find((s) => s.group.row === 0 && s.group.column === 0) || members[0];
    if (chosen.some((r) => r.kind === 'start')) {
      const origin = fastenerLayoutAnchors(source)[0];
      const delta = target.map((v, i) => v - (base || origin)[i]);
      const turn = (p) => p.map((v, i) => v + delta[i]);
      for (const member of members)
        updates.set(member.id, {
          ...member,
          ...transformSpan(member, turn),
          start: turn(member.start),
          end: turn(member.end),
        });
    } else {
      const layout = layoutForFastener(source);
      const yGrip = chosen.some((r) => r.kind === 'y');
      const anchors = fastenerLayoutAnchors(source);
      const tip = anchors[yGrip ? 2 : 1];
      const destination = base ? tip.map((v, i) => v + target[i] - base[i]) : target;
      const xPoint =
        yGrip && chosen.some((r) => r.kind === 'end')
          ? anchors[1].map((v, i) => v + target[i] - (base || tip)[i])
          : anchors[1];
      const picked = yGrip
        ? fastenerLayoutFromThreePoints(layout.frame.origin, xPoint, destination)
        : fastenerLayoutFromPoints(layout.frame.origin, destination, layout.frame);
      const draft = applyFastenerLayout({
        ...source,
        layout: {
          ...layout,
          frame: picked.frame,
          xLength: picked.xLength,
          yLength: yGrip ? picked.yLength : layout.yLength || 100,
        },
      });
      for (const member of fastenerGroupBatch(draft, model)) updates.set(member.id, member);
    }
  }
  return updates;
}

/** An X grip stays in the saved pattern plane, including inclined work planes. */
export function fastenerGripPlane(sources, refs, base) {
  if (!refs.length || refs.some((r) => r.kind !== 'end')) return null;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const chosen = refs.map((r) => byId.get(r.id));
  if (chosen.some((s) => !s?.group)) return null;
  const frame = layoutForFastener(chosen[0]).frame;
  const normal = new THREE.Vector3(...frame.u).cross(new THREE.Vector3(...frame.v));
  if (
    chosen.some((s) => {
      const f = layoutForFastener(s).frame;
      return (
        Math.abs(normal.dot(new THREE.Vector3(...f.u).cross(new THREE.Vector3(...f.v)))) < 1 - 1e-8
      );
    })
  )
    return null;
  return { ...structuredClone(frame), origin: [...base] };
}
