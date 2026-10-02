import * as THREE from 'three';
import { holesForPart } from './relations.js';

const fmt = (v) =>
  (Math.abs(v) < 0.005 ? 0 : v).toLocaleString('sv-SE', { maximumFractionDigits: 2 });
export function partHoleSchedule(source, model, localMatrix) {
  return holesForPart(source, model).map((h, i) => ({
    label: `H${i + 1} · Ø${fmt(h.diameter)} · ${h.kind === 'pilot' ? 'borrdjup' : 'håldjup'} ${fmt(h.depth)} mm${h.countersink ? ` · försänkning Ø${fmt(h.countersink.diameter)} / ${fmt(h.countersink.depth)} mm` : ''}`,
    center: new THREE.Vector3(...h.frame.origin).applyMatrix4(localMatrix).toArray(),
    direction: new THREE.Vector3(...h.frame.u)
      .cross(new THREE.Vector3(...h.frame.v))
      .transformDirection(localMatrix)
      .toArray(),
  }));
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
