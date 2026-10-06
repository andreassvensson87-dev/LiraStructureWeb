import * as THREE from 'three';
import { selectionGrips } from './model/grips.js';
import { plateVertices } from './plate.js';

// Screen-sized overlays keep axis endpoints visible through the profile itself.
export class InsertionPoints {
  constructor(host, onActivate, { onRemove, canRemove } = {}) {
    this.layer = document.createElement('div');
    this.layer.className = 'insertion-points';
    this.onActivate = onActivate;
    this.menu = document.createElement('div');
    this.menu.className = 'vertex-menu';
    this.menu.hidden = true;
    this.removeButton = document.createElement('button');
    this.removeButton.type = 'button';
    this.removeButton.textContent = 'Ta bort hörn';
    this.menu.append(this.removeButton);
    host.append(this.menu);
    this.removeButton.onclick = (e) => {
      e.stopPropagation();
      this.menu.hidden = true;
      onRemove?.(this.menuIndex);
    };
    this.menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.menu.hidden = true;
      }
    });
    host.addEventListener('pointerdown', (e) => {
      if (!this.menu.contains(e.target)) this.menu.hidden = true;
    });
    this.canRemove = canRemove;
    host.append(this.layer);
    this.markers = new Map();
    this.projected = new THREE.Vector3();
  }
  update(camera, width, height, sweeps, selected, drawing, start, end, placed = []) {
    if (drawing || this.selection !== selected) this.menu.hidden = true;
    this.selection = selected;
    const selectedIds = selected instanceof Set ? selected : new Set(selected ? [selected] : []);
    const visible = new Set();
    const show = (key, point, kind, emphasis = false, grip = null) => {
      if (!point) return;
      visible.add(key);
      let marker = this.markers.get(key);
      const interactive = emphasis && !drawing;
      if (marker && (marker.tagName === 'BUTTON') !== interactive) {
        marker.remove();
        this.markers.delete(key);
        marker = null;
      }
      if (!marker) {
        marker = document.createElement(interactive ? 'button' : 'span');
        if (interactive) {
          marker.type = 'button';
          marker.setAttribute(
            'aria-label',
            String(kind).startsWith('edge:')
              ? 'Lägg till hörn'
              : typeof kind === 'number'
                ? `Flytta hörn ${kind + 1}`
                : kind === 'start'
                  ? 'Flytta startpunkt'
                  : 'Flytta slutpunkt',
          );
          marker.title = String(kind).startsWith('edge:')
            ? 'Lägg till hörn'
            : typeof kind === 'number'
              ? `Flytta hörn ${kind + 1}`
              : kind === 'start'
                ? 'Flytta startpunkt'
                : 'Flytta slutpunkt';
          marker.onclick = (e) => {
            e.stopPropagation();
            this.onActivate(marker.grip ?? kind);
          };
          marker.oncontextmenu = (e) => {
            if (
              (this.selection instanceof Set ? this.selection.size : 1) !== 1 ||
              typeof kind !== 'number' ||
              !this.canRemove
            )
              return;
            e.preventDefault();
            e.stopPropagation();
            const allowed = this.canRemove(kind);
            if (allowed === null) return;
            this.menuIndex = kind;
            this.menu.hidden = false;
            this.removeButton.disabled = !allowed;
            this.removeButton.title = allowed ? '' : 'Minst tre hörn krävs';
            this.menu.style.left = `${Math.min(width - 150, Math.max(0, parseFloat(marker.style.left)))}px`;
            this.menu.style.top = `${Math.min(height - 42, Math.max(0, parseFloat(marker.style.top)))}px`;
            this.removeButton.focus({ preventScroll: true });
          };
        } else marker.setAttribute('aria-hidden', 'true');
        this.layer.append(marker);
        this.markers.set(key, marker);
      }
      marker.grip = grip;
      if (grip?.refs.length > 1) {
        marker.title = 'Flytta gemensamma insättningspunkter';
        marker.setAttribute('aria-label', marker.title);
      }
      const edge = String(kind).startsWith('edge:');
      marker.className = `insertion-point ${edge ? 'edge-add' : kind}${emphasis ? ' emphasized' : ''}`;
      if (marker.textContent !== (edge ? '+' : '')) marker.textContent = edge ? '+' : '';
      const p = this.projected.fromArray(point).project(camera);
      marker.hidden = Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1;
      marker.style.left = `${((p.x + 1) * width) / 2}px`;
      marker.style.top = `${((1 - p.y) * height) / 2}px`;
    };
    for (const grip of selectionGrips(sweeps, selectedIds, drawing)) {
      const ref = grip.refs[0];
      show(
        grip.refs.map((r) => `${r.id}:${r.kind}`).join('|'),
        grip.point,
        ref.kind,
        true,
        selectedIds.size > 1 ? grip : null,
      );
    }
    if (!drawing && selectedIds.size === 1) {
      const sweep = sweeps.find((s) => selectedIds.has(s.id));
      if (sweep?.type === 'plate' && !sweep.generatedBy) {
        const vertices = plateVertices(sweep);
        vertices.forEach((p, i) =>
          show(
            `${sweep.id}:edge:${i}`,
            p.map((v, j) => (v + vertices[(i + 1) % vertices.length][j]) / 2),
            `edge:${i}`,
            true,
          ),
        );
      }
    }
    if (drawing) {
      placed.forEach((p, i) => show(`draft:${i}`, p, 'start', true));
      show('preview:start', start, 'start', true);
      if (start) show('preview:end', end, 'end', true);
    }
    for (const [key, marker] of this.markers) {
      if (!visible.has(key)) {
        marker.remove();
        this.markers.delete(key);
      }
    }
  }
}
