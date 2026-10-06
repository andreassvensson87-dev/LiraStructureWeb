import * as THREE from 'three';
import { displayGeometry, isPhysical } from '../model-object.js';

export const FEEDBACK_COLORS = {
  first: 0x297fc4,
  second: 0xde9034,
  hover: 0xe1b84d,
  selected: 0x258e79,
};
/** Reference roles remain recognizable even when the cursor moves across them. */
export function objectFeedbackStyle({
  referenceIndex = -1,
  candidateIndex = null,
  hovered = false,
  selected = false,
}) {
  const role = referenceIndex >= 0 ? referenceIndex : candidateIndex;
  if (role == null && !hovered) return null;
  const color =
    role === 0
      ? FEEDBACK_COLORS.first
      : role === 1
        ? FEEDBACK_COLORS.second
        : selected
          ? FEEDBACK_COLORS.selected
          : FEEDBACK_COLORS.hover;
  return { color, fillOpacity: hovered ? 0.28 : 0.14, edgeOpacity: hovered ? 1 : 0.9 };
}
export class ObjectFeedback {
  constructor(scene, { visible = () => true, invalidate = () => {} } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'Object feedback';
    scene.add(this.group);
    this.visible = visible;
    this.invalidate = invalidate;
    this.model = [];
    this.sources = new Map();
    this.references = [];
    this.selected = new Set();
    this.hovers = new Map();
    this.entries = new Map();
    this.version = 0;
  }
  get referenceCount() {
    return this.references.length;
  }
  setModel(model, force = false) {
    if (this.model === model && !force) return;
    this.model = model;
    this.sources = new Map(model.map((s) => [s.id, s]));
    this.version++;
    this.invalidate();
  }
  setReferences(ids) {
    if (ids.length === this.references.length && ids.every((id, i) => id === this.references[i]))
      return;
    this.references = [...ids];
    this.invalidate();
  }
  setSelection(ids) {
    this.selected = new Set(ids);
    this.invalidate();
  }
  setHover(ids, owner = 'canvas', candidateIndex = null) {
    const old = this.hovers.get(owner);
    if (
      old?.candidateIndex === candidateIndex &&
      ids.length === old.ids.length &&
      ids.every((id, i) => id === old.ids[i])
    )
      return;
    this.hovers.set(owner, { ids: [...ids], candidateIndex });
    this.invalidate();
  }
  clearHover() {
    if (this.hovers.size) {
      this.hovers.clear();
      this.invalidate();
    }
  }
  remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.group.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    entry.mesh.material.dispose();
    entry.edges.geometry.dispose();
    entry.edges.material.dispose();
    this.entries.delete(id);
  }
  refresh() {
    const inspector = this.hovers.get('inspector');
    const hover = inspector?.ids.length
      ? inspector
      : [...this.hovers.values()].filter((s) => s.ids.length).at(-1);
    const hovered = new Set(hover?.ids || []);
    const wanted = new Set([...this.references, ...hovered]);
    for (const id of this.entries.keys()) if (!wanted.has(id)) this.remove(id);
    for (const id of wanted) {
      const source = this.sources.get(id);
      if (!source || !isPhysical(source) || !this.visible(id)) {
        this.remove(id);
        continue;
      }
      let entry = this.entries.get(id);
      if (entry && (entry.source !== source || entry.version !== this.version)) {
        this.remove(id);
        entry = null;
      }
      if (!entry) {
        const geometry = displayGeometry(source, this.model);
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          }),
        );
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, depthTest: false }),
        );
        mesh.raycast = edges.raycast = () => {};
        mesh.renderOrder = 25;
        edges.renderOrder = 26;
        mesh.add(edges);
        this.group.add(mesh);
        entry = { source, version: this.version, mesh, edges };
        this.entries.set(id, entry);
      }
      const style = objectFeedbackStyle({
        referenceIndex: this.references.indexOf(id),
        candidateIndex: hovered.has(id) ? hover?.candidateIndex : null,
        hovered: hovered.has(id),
        selected: this.selected.has(id),
      });
      entry.mesh.material.color.set(style.color);
      entry.mesh.material.opacity = style.fillOpacity;
      entry.edges.material.color.set(style.color);
      entry.edges.material.opacity = style.edgeOpacity;
    }
  }
  dispose() {
    for (const id of this.entries.keys()) this.remove(id);
    this.group.removeFromParent();
  }
}
