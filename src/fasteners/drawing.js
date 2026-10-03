import * as THREE from 'three';
import { holesForPart } from './relations.js';

const fmt = (v) =>
  (Math.abs(v) < 0.005 ? 0 : v).toLocaleString('sv-SE', { maximumFractionDigits: 2 });
export function partHoleSchedule(source, model, localMatrix) {
  return holesForPart(source, model).map((h, i) => ({
    id: h.id,
    ownerId: h.ownerId,
    diameter: h.diameter,
    kind: h.kind,
    label: `H${i + 1} · Ø${fmt(h.diameter)} · ${h.kind === 'pilot' ? 'borrdjup' : 'håldjup'} ${fmt(h.depth)} mm${h.countersink ? ` · försänkning Ø${fmt(h.countersink.diameter)} / ${fmt(h.countersink.depth)} mm` : ''}`,
    center: new THREE.Vector3(...h.frame.origin).applyMatrix4(localMatrix).toArray(),
    direction: new THREE.Vector3(...h.frame.u)
      .cross(new THREE.Vector3(...h.frame.v))
      .transformDirection(localMatrix)
      .toArray(),
  }));
}
/** Stable centre references do not depend on the triangulation around a bore. */
export function partHoleCandidates(schedule, frame, reflection = null) {
  const origin = new THREE.Vector3(...frame.origin),
    x = new THREE.Vector3(...frame.x),
    y = new THREE.Vector3(...frame.y),
    normal = new THREE.Vector3(...frame.normal);
  return schedule.flatMap((h) => {
    const center = new THREE.Vector3(...h.center),
      direction = new THREE.Vector3(...h.direction);
    if (reflection) {
      center.applyMatrix4(reflection);
      direction.transformDirection(reflection);
    }
    const facing = direction.dot(normal);
    if (Math.abs(facing) < 0.999 || (h.kind === 'pilot' && facing > 0)) return [];
    center.sub(origin);
    const point = Object.assign([center.dot(x), center.dot(y)], {
      reference: { kind: 'bore', source: 'part', featureId: h.id },
    });
    return [{ point, diameter: h.diameter }];
  });
}
/** Read-only machining data accompanies the actual projected hole geometry. */
export function updatePartHolePanel(root, source, model, localMatrix) {
  let panel = root.querySelector('[data-part-holes]');
  if (!panel) {
    panel = document.createElement('details');
    panel.dataset.partHoles = '';
    panel.open = true;
    root.append(panel);
  }
  panel.replaceChildren();
  const schedule = partHoleSchedule(source, model, localMatrix);
  panel.hidden = !schedule.length;
  const summary = document.createElement('summary');
  summary.textContent = `Hål · ${schedule.length}`;
  panel.append(summary);
  for (const h of schedule) {
    const p = document.createElement('p');
    p.className = 'inspector-note';
    p.textContent = `${h.label}. Centrum XYZ: ${h.center.map(fmt).join(' / ')} mm i detaljens koordinater.`;
    panel.append(p);
  }
}
