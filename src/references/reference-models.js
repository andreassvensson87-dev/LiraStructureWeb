import * as THREE from 'three';
import { edgeIndex, referenceCandidates } from './edge-index.js';
export class ReferenceModels {
  constructor({ scene, inspector, fit, status }) {
    Object.assign(this, { scene, fit, status });
    this.parts = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.corners = true;
    this.edges = true;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = 'references-tab';
    tab.dataset.inspectorTab = 'references';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'inspector-references');
    tab.setAttribute('aria-selected', 'false');
    tab.textContent = 'Referenser';
    document.querySelector('[role=tablist]').append(tab);
    this.panel = document.createElement('section');
    this.panel.id = 'inspector-references';
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'tabpanel');
    this.panel.setAttribute('aria-labelledby', tab.id);
    document.getElementById('inspector-model').after(this.panel);
    tab.onclick = () => {
      inspector.finish();
      inspector.show('references');
    };
    this.panel.innerHTML =
      '<h2>Referensmodell</h2><p class="inspector-note">Lokal IFC · skrivskyddad. Välj filen igen efter omstart.</p><button type="button" data-import>Öppna IFC…</button><input type="file" accept=".ifc" hidden><button type="button" data-cancel hidden>Avbryt import</button><progress max="100" hidden aria-label="IFC-import"></progress><p role="status"></p><div data-model hidden><strong data-name></strong><p data-info class="inspector-note"></p><label><input type="checkbox" data-visible checked>Visa referens</label><label><input type="checkbox" data-transparent>Transparent</label><label><input type="checkbox" data-corners checked>Snappa till hörn</label><label><input type="checkbox" data-edges checked>Snappa till kanter</label><button type="button" data-fit>Visa referensens utbredning</button><button type="button" data-remove>Ta bort referens</button></div>';
    const $ = (s) => this.panel.querySelector(s);
    this.$ = $;
    $('[data-import]').onclick = () => $('input[type=file]').click();
    $('input[type=file]').onchange = () => {
      const file = $('input[type=file]').files[0];
      if (file) this.load(file);
      $('input[type=file]').value = '';
    };
    $('[data-cancel]').onclick = () => {
      this.cancel();
      this.message('Import avbruten.');
    };
    $('[data-remove]').onclick = () => {
      this.clear();
      $('[data-model]').hidden = true;
      this.message('Referensen borttagen.');
    };
    $('[data-visible]').onchange = () => {
      this.group.visible = $('[data-visible]').checked;
    };
    $('[data-transparent]').onchange = () => {
      for (const p of this.parts) {
        p.mesh.material.transparent = $('[data-transparent]').checked || p.opacity < 1;
        p.mesh.material.opacity = $('[data-transparent]').checked ? 0.3 : p.opacity;
        p.mesh.material.depthWrite = !p.mesh.material.transparent;
        p.mesh.material.needsUpdate = true;
      }
    };
    $('[data-corners]').onchange = () => {
      this.corners = $('[data-corners]').checked;
    };
    $('[data-edges]').onchange = () => {
      this.edges = $('[data-edges]').checked;
    };
    $('[data-fit]').onclick = () => {
      const bounds = new THREE.Box3().setFromObject(this.group);
      if (!bounds.isEmpty()) fit(bounds);
    };
  }
  message(text) {
    this.$('[role=status]').textContent = text;
    this.status(text);
  }
  bounds() {
    return this.group.visible ? new THREE.Box3().setFromObject(this.group) : new THREE.Box3();
  }
  dispose(parts) {
    for (const p of parts) {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
  }
  clear() {
    this.dispose(this.parts);
    this.parts = [];
    this.group.clear();
  }
  cancel() {
    this.worker?.terminate();
    this.worker = null;
    this.dispose(this.pending || []);
    this.pending = [];
    this.busy(false);
  }
  busy(value) {
    this.$('[data-import]').disabled = value;
    this.$('[data-cancel]').hidden = !value;
    this.$('progress').hidden = !value;
  }
  async load(file) {
    this.cancel();
    this.busy(true);
    this.$('progress').value = 0;
    this.message('Läser IFC lokalt…');
    const worker = new Worker(new URL('./ifc.worker.js', import.meta.url), { type: 'module' });
    this.worker = worker;
    this.pending = [];
    const fail = (message) => {
      this.cancel();
      this.message(message);
    };
    worker.onerror = () => fail('IFC-läsaren kunde inte starta eller slutföra importen.');
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return;
      if (data.type === 'error') {
        fail(data.message);
        return;
      }
      if (data.type === 'progress') {
        this.$('progress').value = data.value;
        return;
      }
      if (data.type === 'mesh') {
        try {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
          geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(...data.color),
            roughness: 0.85,
            metalness: 0,
            side: THREE.DoubleSide,
            transparent: data.opacity < 1,
            opacity: data.opacity,
            depthWrite: data.opacity >= 1,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.fromArray(data.origin);
          mesh.userData = {
            ifcId: data.id,
            ifcType: data.ifcType,
            name: data.name,
            globalId: data.globalId,
          };
          this.pending.push({
            mesh,
            edges: data.edges,
            index: edgeIndex(data.edges),
            opacity: data.opacity,
          });
        } catch {
          fail('Geometrin kunde inte visas. Prova en mindre IFC-fil.');
        }
        return;
      }
      if (data.type === 'done') {
        this.clear();
        this.parts = this.pending;
        this.pending = [];
        for (const part of this.parts) this.group.add(part.mesh);
        this.group.visible = true;
        this.$('[data-visible]').checked = true;
        this.$('[data-transparent]').checked = false;
        this.$('[data-name]').textContent = file.name;
        this.$('[data-info]').textContent =
          `${data.schema} · ${data.count} geometridelar · IFC-placering, mm`;
        this.$('[data-model]').hidden = false;
        this.busy(false);
        worker.terminate();
        this.worker = null;
        this.message('IFC importerad. Referensen är synlig och snapbar.');
        this.fit(this.bounds());
      }
    };
    try {
      const bytes = await file.arrayBuffer();
      if (this.worker === worker) worker.postMessage(bytes, [bytes]);
    } catch {
      if (this.worker === worker) fail('Filen kunde inte läsas.');
    }
  }
  candidates(options) {
    return this.group.visible && (this.corners || this.edges)
      ? referenceCandidates(this.parts, { ...options, corners: this.corners, edges: this.edges })
      : [];
  }
}
