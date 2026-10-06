import * as THREE from 'three';
import { edgeIndex, referenceCandidates } from './edge-index.js';
export class ReferenceModels {
  constructor({ scene, inspector, fit, status }) {
    Object.assign(this, { scene, fit, status });
    this.models = [];
    this.folders = ['Standard'];
    this.collapsed = new Set();
    this.selectedId = null;
    this.parts = [];
    this.group = new THREE.Group();
    scene.add(this.group);
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
    this.panel.innerHTML = `
      <h2>Referensmodeller</h2>
      <div data-overview>
        <div class="reference-toolbar"><button type="button" data-import>+ Lägg till IFC…</button><button type="button" data-new-group>+ Grupp</button></div>
        <form data-group-form hidden><label>Gruppnamn<input data-group-name required maxlength="80"></label><button type="submit">Skapa</button><button type="button" data-group-cancel>Avbryt</button></form>
        <input type="search" data-search placeholder="Sök referensmodeller…" aria-label="Sök referensmodeller">
        <div data-list></div>
      </div>
      <input type="file" accept=".ifc" hidden>
      <button type="button" data-cancel hidden>Avbryt import</button><progress max="100" hidden aria-label="IFC-import"></progress><p role="status"></p>
      <div data-model hidden>
        <button type="button" data-back>← Alla referensmodeller</button>
        <h3 data-name></h3>
        <div class="reference-fields">
          <label>Namn<input data-title maxlength="200"></label>
          <label>Fil<span data-file></span></label>
          <label>Grupp<select data-folder></select></label>
          <label>Visa referens<input type="checkbox" data-visible checked></label>
          <label>Transparent<input type="checkbox" data-transparent></label>
        </div>
        <details open><summary>Snapping</summary><div class="reference-fields">
          <label>Hörn<input type="checkbox" data-corners checked></label>
          <label>Kanter<input type="checkbox" data-edges checked></label>
        </div></details>
        <button type="button" data-fit>Visa referensens utbredning</button>
        <div class="reference-toolbar"><button type="button" data-replace>Byt IFC-fil…</button><button type="button" data-remove>Ta bort</button></div>
      </div>
      `;
    const $ = (s) => this.panel.querySelector(s);
    this.$ = $;
    const pickFile = (replaceId = null) => {
      this.replaceId = replaceId;
      $('input[type=file]').click();
    };
    $('[data-import]').onclick = () => pickFile();
    $('[data-replace]').onclick = () => pickFile(this.selectedId);
    $('input[type=file]').onchange = () => {
      const file = $('input[type=file]').files[0];
      if (file) this.load(file, { replaceId: this.replaceId });
      $('input[type=file]').value = '';
    };
    $('[data-cancel]').onclick = () => {
      this.cancel();
      this.message('Import avbruten.');
    };
    $('[data-remove]').onclick = () => this.remove();
    $('[data-back]').onclick = () => this.showList();
    $('[data-search]').oninput = () => this.renderList();
    $('[data-new-group]').onclick = () => {
      $('[data-group-form]').hidden = false;
      $('[data-group-name]').focus();
    };
    $('[data-group-cancel]').onclick = () => {
      $('[data-group-form]').hidden = true;
    };
    $('[data-group-form]').onsubmit = (event) => {
      event.preventDefault();
      const name = $('[data-group-name]').value.trim();
      if (!name) return;
      if (!this.folders.includes(name)) this.folders.push(name);
      $('[data-group-form]').hidden = true;
      $('[data-group-name]').value = '';
      this.renderList();
    };
    $('[data-title]').oninput = () => {
      const model = this.selected();
      if (!model) return;
      model.title = $('[data-title]').value.trim() || model.fileName;
      $('[data-name]').textContent = model.title;
    };
    $('[data-folder]').onchange = () => {
      const model = this.selected();
      if (model) model.folder = $('[data-folder]').value;
    };
    $('[data-visible]').onchange = () => {
      const model = this.selected();
      if (model) this.setVisible([model], $('[data-visible]').checked);
    };
    $('[data-transparent]').onchange = () => {
      const model = this.selected();
      if (!model) return;
      model.transparent = $('[data-transparent]').checked;
      for (const p of model.parts) {
        p.mesh.material.transparent = model.transparent || p.opacity < 1;
        p.mesh.material.opacity = model.transparent ? 0.3 : p.opacity;
        p.mesh.material.depthWrite = !p.mesh.material.transparent;
        p.mesh.material.needsUpdate = true;
      }
    };
    for (const key of ['corners', 'edges'])
      $('[data-' + key + ']').onchange = () => {
        const model = this.selected();
        if (model) model[key] = $('[data-' + key + ']').checked;
      };
    $('[data-fit]').onclick = () => {
      const model = this.selected();
      const bounds = model && new THREE.Box3().setFromObject(model.group);
      if (bounds && !bounds.isEmpty()) fit(bounds);
    };
    this.renderList();
  }
  selected() {
    return this.models.find((model) => model.id === this.selectedId);
  }
  showList() {
    this.$('[data-model]').hidden = true;
    this.$('[data-overview]').hidden = false;
    this.renderList();
  }
  showModel(id) {
    this.selectedId = id;
    const model = this.selected();
    if (!model) return this.showList();
    this.$('[data-overview]').hidden = true;
    this.$('[data-model]').hidden = false;
    this.$('[data-name]').textContent = model.title;
    this.$('[data-title]').value = model.title;
    this.$('[data-file]').textContent = model.fileName;
    const select = this.$('[data-folder]');
    select.replaceChildren();
    for (const folder of this.folders) {
      const option = document.createElement('option');
      option.textContent = option.value = folder;
      select.append(option);
    }
    select.value = model.folder;
    for (const key of ['visible', 'transparent', 'corners', 'edges'])
      this.$('[data-' + key + ']').checked = key === 'visible' ? model.group.visible : model[key];
  }
  setVisible(models, visible) {
    for (const model of models) model.group.visible = visible;
    this.renderList();
  }
  renderList() {
    const list = this.$('[data-list]');
    list.replaceChildren();
    const query = this.$('[data-search]').value.trim().toLocaleLowerCase('sv');
    const button = (label, text, action, className) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.className = className;
      b.setAttribute('aria-label', label);
      b.onclick = action;
      return b;
    };
    const visibility = (models, label) => {
      const visible = models.some((m) => m.group.visible);
      const b = button(
        `${visible ? 'Dölj' : 'Visa'} ${label}`,
        '',
        () => this.setVisible(models, !visible),
        'reference-eye',
      );
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible ? '' : '<path d="M3 21 21 3"/>'}</svg>`;
      b.setAttribute('aria-pressed', String(visible));
      b.disabled = !models.length;
      return b;
    };
    const all = document.createElement('div');
    all.className = 'reference-list-row reference-all';
    all.append(
      visibility(this.models, 'alla referenser'),
      document.createTextNode(`Alla (${this.models.length})`),
    );
    list.append(all);
    for (const folder of this.folders) {
      const members = this.models.filter((m) => m.folder === folder);
      const filtered = members.filter((m) =>
        `${m.title} ${m.fileName} ${folder}`.toLocaleLowerCase('sv').includes(query),
      );
      if (query && !filtered.length) continue;
      const section = document.createElement('div');
      const row = document.createElement('div');
      row.className = 'reference-list-row reference-group-row';
      const open = !!query || !this.collapsed.has(folder);
      const toggle = button(
        `${open ? 'Fäll ihop' : 'Visa grupp'} ${folder}`,
        open ? '▾' : '▸',
        () => {
          if (this.collapsed.has(folder)) this.collapsed.delete(folder);
          else this.collapsed.add(folder);
          this.renderList();
        },
        'reference-fold',
      );
      toggle.setAttribute('aria-expanded', String(open));
      const name = document.createElement('span');
      name.textContent = `${folder} (${members.length})`;
      row.append(toggle, visibility(members, `gruppen ${folder}`), name);
      section.append(row);
      if (open)
        for (const model of filtered) {
          const r = document.createElement('div');
          r.className = 'reference-list-row reference-model-row';
          r.append(
            visibility([model], model.title),
            button(
              `Öppna ${model.title}`,
              model.title,
              () => this.showModel(model.id),
              'reference-model-name',
            ),
          );
          section.append(r);
        }
      list.append(section);
    }
    if (query && !list.querySelector('.reference-model-row')) {
      const note = document.createElement('p');
      note.className = 'inspector-note';
      note.textContent = 'Inga träffar';
      list.append(note);
    }
  }
  message(text, error = false) {
    this.$('[role=status]').textContent = error ? text : '';
    this.status(text);
  }
  bounds() {
    const bounds = new THREE.Box3();
    for (const model of this.models)
      if (model.group.visible) bounds.union(new THREE.Box3().setFromObject(model.group));
    return bounds;
  }
  dispose(parts) {
    for (const p of parts) {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
  }
  syncParts() {
    this.parts = this.models.flatMap((model) => model.parts);
  }
  clear() {
    this.dispose(this.parts);
    this.models = [];
    this.parts = [];
    this.group.clear();
    this.selectedId = null;
  }
  remove(id = this.selectedId) {
    this.cancel();
    const model = this.models.find((m) => m.id === id);
    if (model) {
      this.dispose(model.parts);
      this.group.remove(model.group);
      this.models = this.models.filter((m) => m !== model);
      this.syncParts();
    }
    this.selectedId = null;
    this.showList();
    this.message('Referensen borttagen.');
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
    this.$('[data-replace]').disabled = value;
    this.$('[data-cancel]').hidden = !value;
    this.$('progress').hidden = !value;
  }
  async load(file, { replaceId = null } = {}) {
    this.cancel();
    this.busy(true);
    this.$('progress').value = 0;
    this.message('Läser IFC…');
    const worker = new Worker(new URL('./ifc.worker.js', import.meta.url), { type: 'module' });
    this.worker = worker;
    this.pending = [];
    const fail = (message) => {
      if (this.worker !== worker) return;
      this.cancel();
      this.message(message, true);
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
        const previous = this.models.find((m) => m.id === replaceId);
        const model = {
          id: previous?.id || crypto.randomUUID(),
          title: previous?.title || file.name,
          fileName: file.name,
          folder: previous?.folder || 'Standard',
          schema: data.schema,
          group: new THREE.Group(),
          parts: this.pending,
          transparent: previous?.transparent || false,
          corners: previous?.corners ?? true,
          edges: previous?.edges ?? true,
        };
        this.pending = [];
        model.group.visible = previous?.group.visible ?? true;
        for (const part of model.parts) {
          if (model.transparent) {
            part.mesh.material.transparent = true;
            part.mesh.material.opacity = 0.3;
            part.mesh.material.depthWrite = false;
          }
          model.group.add(part.mesh);
        }
        if (previous) {
          this.dispose(previous.parts);
          this.group.remove(previous.group);
          this.models.splice(this.models.indexOf(previous), 1, model);
        } else this.models.push(model);
        this.group.add(model.group);
        this.group.visible = true;
        this.syncParts();
        this.showModel(model.id);
        this.busy(false);
        worker.terminate();
        this.worker = null;
        this.message('IFC importerad.');
        if (model.group.visible) this.fit(this.bounds());
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
    return this.models.flatMap((model) =>
      model.group.visible && (model.corners || model.edges)
        ? referenceCandidates(model.parts, {
            ...options,
            corners: model.corners,
            edges: model.edges,
          })
        : [],
    );
  }
}
