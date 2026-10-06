import * as THREE from 'three';
import { isComponent } from './fit.js';
export const connectionIcon =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m10 14 4-4m-6 5-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/></svg>';
export function componentMarkerProjection(position, camera, width, height) {
  const p = new THREE.Vector3(...position).project(camera);
  if (
    ![p.x, p.y, p.z].every(Number.isFinite) ||
    Math.abs(p.z) > 1 ||
    Math.abs(p.x) > 1 ||
    Math.abs(p.y) > 1
  )
    return null;
  return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
}
// A 200 mm marker follows the model scale, with a restrained maximum in close views.
export function componentMarkerAppearance(position, camera, height) {
  const center = new THREE.Vector3(...position);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const edge = center.clone().addScaledVector(up, 200).project(camera);
  center.project(camera);
  const projectedSize = (Math.abs(edge.y - center.y) * height) / 2;
  const size = Math.min(28, projectedSize);
  const fade = THREE.MathUtils.clamp((projectedSize - 8) / 8, 0, 1);
  return {
    size,
    opacity: fade * fade * (3 - 2 * fade),
    visible: size > 8 && Number.isFinite(size),
  };
}
export function createConnectionMarkers(host, select) {
  const overlay = document.createElement('div');
  overlay.className = 'connection-markers';
  host.append(overlay);
  const entries = new Map();
  let picking = false;
  return {
    sync(objects, selectedIds, visible, activePicking) {
      picking = activePicking;
      const components = objects.filter((s) => isComponent(s) && visible(s.id));
      const ids = new Set(components.map((s) => s.id));
      for (const [id, entry] of entries)
        if (!ids.has(id)) {
          entry.button.remove();
          entries.delete(id);
        }
      for (const s of components) {
        let entry = entries.get(s.id);
        if (!entry) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'connection-marker';
          button.innerHTML = connectionIcon;
          button.dataset.componentId = s.id;
          button.onclick = (e) => {
            e.stopPropagation();
            select(s.id);
          };
          button.addEventListener('pointerdown', (e) => e.stopPropagation());
          overlay.append(button);
          entry = { button };
          entries.set(s.id, entry);
        }
        entry.source = s;
        entry.button.setAttribute('aria-label', `Koppling ${s.name || 'Fit'} · visa egenskaper`);
        entry.button.title = `${s.name || 'Fit'} · klicka för att modifiera`;
        entry.button.setAttribute(
          'aria-pressed',
          String(
            selectedIds.has(s.id) ||
              objects.some((member) => member.generatedBy === s.id && selectedIds.has(member.id)),
          ),
        );
      }
    },
    update(camera) {
      for (const entry of entries.values()) {
        const p = componentMarkerProjection(
          entry.source.position,
          camera,
          host.clientWidth,
          host.clientHeight,
        );
        const appearance = componentMarkerAppearance(
          entry.source.position,
          camera,
          host.clientHeight,
        );
        entry.button.hidden = !p || picking || !appearance.visible;
        if (p && appearance.visible) {
          entry.button.style.left = `${p.x}px`;
          entry.button.style.top = `${p.y - appearance.size * 0.75}px`;
          entry.button.style.width = `${appearance.size}px`;
          entry.button.style.height = `${appearance.size}px`;
          entry.button.style.opacity = String(appearance.opacity);
        }
      }
    },
  };
}
