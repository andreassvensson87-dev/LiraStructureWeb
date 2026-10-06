import { inputWheelGesture } from './input-device.js';
import { revisionExampleBlock } from './frame-revision-example.js';
import { customAttributes } from './drawing-attributes.js';
import { copyLibraryItem, libraryUsage } from './frame-library.js';
import { rectangleSelection, frameSelectionShapes } from './frame-selection.js';
import { frameGrips, coincidentFrameVertices, moveFrameVertices } from './frame-grips.js';
import { improveFrameTools, paletteControl, FrameFileDialog } from './frame-editor-controls.js';
import {
  propertyFields,
  propertyNames,
  propertyDefaults,
  commonFields,
  propertyValue,
  patchFrameProperties,
} from './frame-properties.js';
import {
  LAYOUT_KEY,
  blankLayout,
  expandLayout,
  instancePoint,
  offsetForPoint,
  transformInstance,
} from './frame-layout.js';
import {
  FRAME_LIBRARY_KEY,
  ATTRIBUTE_KEY,
  builtInAttributes,
  attributeValue,
  blankFrame,
  snapFrame,
  transformFrameEntity,
  lengthPoint,
  distance,
} from './frame-model.js';
import { standardPapers, paperSize } from './paper-formats.js';
import './frame-editor.css';
const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}
export class FrameEditor {
  constructor({ getContext, beforeOpen }) {
    this.getContext = getContext;
    this.beforeOpen = beforeOpen;
    this.mode = 'block';
    this.drafts = {};
    this.frame = blankFrame();
    this.library = read(FRAME_LIBRARY_KEY);
    this.blocks = this.library;
    this.layouts = read(LAYOUT_KEY);
    this.custom = read(ATTRIBUTE_KEY);
    this.undo = [];
    this.redo = [];
    this.selected = new Set();
    this.tool = 'select';
    this.pending = [];
    this.dirty = false;
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'frame-editor';
    this.dialog.innerHTML = `<header><strong>Ritningsramseditor <small>1:1 · mm</small></strong><div><button data-action="new">Nytt blad</button><button data-action="revisionExample">Exempelblock · revision</button><button data-action="importDXF">Importera DXF…</button><button data-action="open">Öppna / hantera…</button><button data-action="save">Spara</button><button data-action="saveAs">Spara som…</button><button data-action="settings" aria-label="Inställningar för rameditorn">⚙</button><button data-action="close" aria-label="Stäng ritningsramseditorn">×</button></div></header>
  <div class="fe-modes"><button data-mode="block" aria-pressed="true">Ramblock</button><button data-mode="layout" aria-pressed="false">Layouter</button><span data-ui="modeHint">Rita ett återanvändbart block i mm · välj egen insättningspunkt</span></div><div class="fe-bar"><select hidden data-ui="library" aria-label="Sparade ritningsramar"><option value="">Sparade ritningsramar</option></select><input data-ui="name" aria-label="Ramnamn" readonly><button data-action="undo" title="Ångra · Ctrl Z">↶</button><button data-action="redo" title="Gör om · Ctrl Shift Z">↷</button><button data-action="fit">Visa blad</button><label>Förhandsvisa attribut<select data-ui="preview"><option value="">Attributnamn</option></select></label></div>
  <div class="fe-body"><nav aria-label="Ramverktyg">${[
    ['select', '↖', 'Markera'],
    ['insert', '⊞', 'Placera block'],
    ['origin', '⊙', 'Insättningspunkt'],
    ['line', '╱', 'Linje'],
    ['polyline', '⌁', 'Polylinje'],
    ['text', 'T', 'Text'],
    ['attribute', '〈A〉', 'Attribut'],
    ['image', '▧', 'Bild'],
    ['move', '↔', 'Flytta'],
    ['copy', '⧉', 'Kopiera'],
    ['rotate', '↻', 'Rotera'],
  ]
    .map(
      ([key, icon, name]) =>
        `<button data-tool="${key}" title="${name}"><b>${icon}</b>${name}</button>`,
    )
    .join('')}<button data-action="delete">Radera</button></nav>
  <div class="fe-canvas"><svg tabindex="0" aria-label="Rityta för ritningsram"></svg></div>
  <aside><section class="fe-block-placement" hidden><h3>Ramblock</h3><label>Block<select data-ui="blockChoice"></select></label><label>Förankring<select data-ui="anchor"><option value="bottom-left">Nedre vänster</option><option value="bottom-right">Nedre höger</option><option value="top-left">Övre vänster</option><option value="top-right">Övre höger</option></select></label><div class="fe-pair"><label>X-avstånd · mm<input data-ui="offsetX" type="number" value="0"></label><label>Y-avstånd · mm<input data-ui="offsetY" type="number" value="0"></label></div><label>Blockrotation · °<input data-ui="blockAngle" type="number" value="0"></label><button data-action="instanceApply">Tillämpa placering</button><p>Avstånd mäts från valt hörn i +X åt höger och +Y uppåt.</p><div data-ui="instances"></div></section><section class="fe-paper"><h3 data-ui="paperTitle">Arbetsyta</h3><label>Pappersformat<select data-ui="paper"></select></label><label class="fe-check"><input data-ui="landscape" type="checkbox" checked>Liggande</label><div class="fe-pair"><label>Bredd · mm<input data-ui="width" type="number" min="50" max="5000"></label><label>Höjd · mm<input data-ui="height" type="number" min="50" max="5000"></label></div>
  <div class="fe-origin-fields"><h3>Insättningspunkt · mm</h3><label>X<input data-ui="originX" type="number" value="0"></label><label>Y<input data-ui="originY" type="number" value="0"></label></div><button data-action="originApply">Ändra insättningspunkt</button></section><section class="fe-entity-properties"><h3 data-ui="selection">Egenskaper</h3><label>Text / innehåll<input data-ui="text" value="Text"></label><label>Typsnitt<select data-ui="font"><option value="Arial, sans-serif">Arial</option><option value="Verdana, sans-serif">Verdana</option><option value="Georgia, serif">Georgia</option><option value="Times New Roman, serif">Times New Roman</option><option value="Courier New, monospace">Courier New</option></select></label><label>Färg<input data-ui="color" type="text" value="#233940" placeholder="#233940"></label><label>Attribut<select data-ui="attribute"></select></label><div class="fe-pair"><label>Texthöjd · mm<input data-ui="size" type="number" min="0.5" max="100" value="3.5" step="0.5"></label><label>Vinkel · °<input data-ui="angle" type="number" value="0"></label></div><label>Textjustering<select data-ui="align"><option value="start">Vänster</option><option value="middle">Centrerad</option><option value="end">Höger</option></select></label><label>Linjetjocklek · mm<input data-ui="stroke" type="number" min="0.05" max="5" value="0.25" step="0.05"></label><label>Bildbredd · mm<input data-ui="imageWidth" type="number" min="1" max="5000" value="40"></label><label>Bildhöjd · mm<input data-ui="imageHeight" type="number" min="1" max="5000" value="20"></label><label class="fe-check"><input data-ui="ratio" type="checkbox" checked>Lås bildproportioner</label><button data-action="properties">Tillämpa på markerade</button>
  <details><summary>Attributbibliotek</summary><p>Inbyggda attribut hämtas från projekt och ritning. Egna attribut kan ges ett värde i förhandsvisningen.</p><label>Namn<input data-ui="attributeName" placeholder="Exempel: Ritad av"></label><label>Gäller för<select data-ui="attributeScope"><option value="all">Alla ritningar</option><option value="GA">GA</option><option value="SP">Single Part</option></select></label><label>Datatyp<select data-ui="attributeType"><option value="text">Text</option><option value="date">Datum</option><option value="number">Tal</option></select></label><button data-action="attributeAdd">Lägg till attribut</button><label>Förhandsvisningsvärde för valt eget attribut<input data-ui="attributeValue"></label><button data-action="attributeValue">Sätt förhandsvisningsvärde</button></details>
  </section><details open><summary>Snappning</summary><label class="fe-check"><input type="checkbox" data-ui="boundary" checked>Arbetsytans kontur</label>${[
    ['endpoints', 'Ändpunkt'],
    ['midpoints', 'Mittpunkt'],
    ['intersections', 'Korsning'],
    ['perpendicular', 'Vinkelrät'],
  ]
    .map(
      ([key, label]) =>
        `<label class="fe-check"><input type="checkbox" data-ui="${key}" checked>${label}</label>`,
    )
    .join(
      '',
    )}<label class="fe-check"><input type="checkbox" data-ui="ortho">Ortho · F8</label><label>Polar<select data-ui="polar"><option value="0">Av</option><option value="15">15°</option><option value="30">30°</option><option value="45" selected>45°</option><option value="90">90°</option></select></label><label class="fe-check"><input type="checkbox" data-ui="grid">Rutnätsnap</label><label>Rutsteg · mm<input data-ui="step" type="number" value="5" min="0.1" step="0.1"></label></details></aside></div>
  <form class="fe-command"><span data-ui="status" role="status">Redo</span><label>Längd / rotationsvinkel<input data-ui="command" autocomplete="off" placeholder="mm / °"></label><button>Bekräfta ↵</button><button type="button" data-action="finish">Avsluta</button><span data-ui="coordinates"></span></form><input data-ui="file" type="file" accept="image/png,image/jpeg,image/webp" hidden>`;
    document.body.append(this.dialog);
    this.canvas = this.dialog.querySelector('.fe-canvas');
    this.svg = this.canvas.querySelector('svg');
    improveFrameTools(this.dialog);
    this.fileDialog = new FrameFileDialog(this.dialog);
    this.updatePalette = paletteControl(this.$('color'), () => this.changedProperties.add('color'));
    const button = document.createElement('button');
    button.id = 'frame-editor-open';
    button.textContent = 'Ram-editor';
    document.querySelector('header .history').append(button);
    button.onclick = () => this.open();
    this.settings = document.createElement('dialog');
    this.settings.className = 'fe-settings';
    this.settings.innerHTML =
      '<header><strong>Inställningar · rameditor</strong><button type="button" aria-label="Stäng editorinställningar">×</button></header><div></div>';
    this.dialog.append(this.settings);
    for (const detail of [...this.dialog.querySelectorAll('aside details')])
      this.settings.querySelector('div').append(detail);
    const previewSection = document.createElement('details');
    previewSection.innerHTML =
      '<summary>Förhandsvisning av attribut</summary><p>Visa exempelvärden från en ritning i editorn. På själva ritningen hämtas rätt värden automatiskt.</p>';
    const previewLabel = this.$('preview').closest('label');
    previewLabel.firstChild.textContent = 'Visa värden från ritning';
    previewSection.append(previewLabel);
    this.settings.querySelector('div').append(previewSection);
    this.settings.querySelector('button').onclick = () => this.settings.close();
    this.settings.addEventListener('keydown', (e) => e.stopPropagation());
    this.settings.addEventListener('cancel', (e) => e.stopPropagation());
    this.changedProperties = new Set();
    for (const key of new Set(Object.values(propertyFields).flat()))
      this.$(key).addEventListener('input', () => this.changedProperties.add(key));
    for (const key of ['imageWidth', 'imageHeight'])
      this.$(key).addEventListener('input', () => {
        if (!this.$('ratio').checked) return;
        const selected = this.frame.entities.filter((e) => this.selected.has(e.id));
        if (selected.length > 1) return;
        const ratio =
          selected[0]?.type === 'image'
            ? selected[0].width / selected[0].height
            : this.image?.ratio;
        if (!ratio) return;
        const value = +this.$(key).value;
        if (value > 0)
          this.$(key === 'imageWidth' ? 'imageHeight' : 'imageWidth').value =
            key === 'imageWidth' ? value / ratio : value * ratio;
      });
    for (const b of this.dialog.querySelectorAll('[data-mode]'))
      b.onclick = () => this.switchMode(b.dataset.mode);
    for (const b of this.dialog.querySelectorAll('[data-tool]'))
      b.onclick = () => this.setTool(b.dataset.tool);
    for (const b of this.dialog.querySelectorAll('[data-action]'))
      b.onclick = () => this.action(b.dataset.action);
    this.dialog.addEventListener('keydown', (e) => this.key(e));
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.action('close');
    });
    this.$('name').onchange = () => {
      const name = this.$('name').value;
      this.checkpoint();
      this.frame.name = name;
      this.sync();
    };
    this.$('library').onchange = () => {
      const next = this.library.find((f) => f.id === this.$('library').value);
      if (next && this.canDiscard()) {
        this.frame = structuredClone(next);
        this.loaded();
      } else this.$('library').value = '';
    };
    for (const p of standardPapers) this.$('paper').add(new Option(p.name, p.id));
    this.$('paper').add(new Option('Eget format', 'custom'));
    this.$('paper').value = 'A3';
    this.$('paper').onchange = this.$('landscape').onchange = () => {
      const p = standardPapers.find((p) => p.id === this.$('paper').value);
      if (p) {
        this.checkpoint();
        [this.frame.width, this.frame.height] = paperSize(p, this.$('landscape').checked);
        this.sync();
        this.fit();
      }
    };
    for (const key of ['width', 'height'])
      this.$(key).onchange = () => {
        const v = +this.$(key).value;
        if (v < 50 || v > 5000 || !Number.isFinite(v)) {
          this.status('Bladstorlek: 50–5 000 mm.');
          this.sync();
          return;
        }
        this.checkpoint();
        this.frame[key] = v;
        this.$('paper').value = 'custom';
        this.fit();
      };
    this.$('anchor').onchange = () => {
      const e = this.frame.entities.find((e) => this.selected.has(e.id));
      if (e?.type === 'block') {
        const p = instancePoint(e, this.frame),
          offset = offsetForPoint(p, this.frame, this.$('anchor').value);
        this.$('offsetX').value = offset[0];
        this.$('offsetY').value = offset[1];
      }
    };
    this.$('preview').onchange = () => this.render();
    this.$('file').onchange = () => this.loadImage();
    this.dialog.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      this.exact();
    };
    this.svg.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('[data-grip]');
      this.gripPress =
        e.button === 0 && grip
          ? { id: grip.dataset.grip, index: +grip.dataset.index, x: e.clientX, y: e.clientY }
          : null;
      if (e.button === 0 && this.tool === 'select' && !grip) {
        e.preventDefault();
        this.selectionPress = {
          id: e.pointerId,
          start: [e.clientX, e.clientY],
          end: [e.clientX, e.clientY],
          entity: e.target.closest('[data-entity]')?.dataset.entity,
          add: e.shiftKey,
          shapes: frameSelectionShapes(this.svg),
        };
        this.svg.setPointerCapture(e.pointerId);
      }
      if (e.button === 1) {
        e.preventDefault();
        this.pan = { id: e.pointerId, x: e.clientX, y: e.clientY, view: [...this.view] };
        this.svg.setPointerCapture(e.pointerId);
      }
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (this.pan) {
        const r = this.svg.getBoundingClientRect();
        this.view[0] = this.pan.view[0] - ((e.clientX - this.pan.x) * this.view[2]) / r.width;
        this.view[1] = this.pan.view[1] - ((e.clientY - this.pan.y) * this.view[3]) / r.height;
        this.render();
        return;
      }
      if (this.selectionPress) {
        const p = this.selectionPress;
        p.end = [e.clientX, e.clientY];
        p.dragging ||= Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1]) >= 5;
        this.render();
        return;
      }
      this.pointer(e);
    });
    this.svg.addEventListener('pointerup', (e) => {
      if (this.pan) {
        this.pan = null;
        if (this.svg.hasPointerCapture(e.pointerId)) this.svg.releasePointerCapture(e.pointerId);
        return;
      }
      if (e.button === 0 && this.selectionPress) {
        const p = this.selectionPress;
        this.selectionPress = null;
        if (this.svg.hasPointerCapture(e.pointerId)) this.svg.releasePointerCapture(e.pointerId);
        if (!p.add) this.selected.clear();
        if (p.dragging) {
          for (const id of rectangleSelection(p.shapes, p.start, [e.clientX, e.clientY]))
            this.selected.add(id);
        } else if (p.entity) {
          if (p.add && this.selected.has(p.entity)) this.selected.delete(p.entity);
          else this.selected.add(p.entity);
        }
        this.properties();
        this.render();
        this.status(`${this.selected.size} objekt markerade · Shift för att lägga till fler`);
        return;
      }
      if (e.button === 0) {
        const press = this.gripPress;
        this.gripPress = null;
        if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) {
          this.startGrip(press.id, press.index);
          return;
        }
        this.pick(e);
      }
    });
    this.svg.addEventListener('pointercancel', () => {
      this.pan = null;
      this.gripPress = null;
      this.cancelSelection();
      this.render();
    });
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.selectionPress) return;
        const gesture = inputWheelGesture(e, undefined, this.canvas.clientHeight);
        if (gesture.action === 'pan') {
          const bounds = this.svg.getBoundingClientRect();
          this.view[0] += (gesture.x * this.view[2]) / Math.max(bounds.width, 1);
          this.view[1] += (gesture.y * this.view[3]) / Math.max(bounds.height, 1);
          this.render();
          return;
        }
        const r = this.svg.getBoundingClientRect(),
          x = (e.clientX - r.left) / r.width,
          y = (e.clientY - r.top) / r.height,
          f = Math.exp(Math.max(-1, Math.min(1, gesture.y * 0.0015)));
        if (this.view[2] * f < 5 || this.view[2] * f > 20000) return;
        this.view = [
          this.view[0] + x * this.view[2] * (1 - f),
          this.view[1] + y * this.view[3] * (1 - f),
          this.view[2] * f,
          this.view[3] * f,
        ];
        this.render();
      },
      { passive: false },
    );
    new ResizeObserver(() => {
      if (this.dialog.open) this.fit();
    }).observe(this.canvas);
  }
  $(key) {
    return this.dialog.querySelector(`[data-ui="${key}"]`);
  }
  status(text) {
    this.$('status').textContent = text;
  }
  attrs() {
    return [...builtInAttributes, ...customAttributes()];
  }
  open() {
    this.beforeOpen?.();
    this.dialog.showModal();
    const selected = this.$('attribute').value;
    this.$('attribute').replaceChildren(
      ...this.attrs().map(
        (a) =>
          new Option(
            `${a.name} · ${a.scope === 'SP' ? 'Single Part' : a.scope === 'GA' ? 'GA' : 'Gemensamt'}`,
            a.key,
          ),
      ),
    );
    if (selected) this.$('attribute').value = selected;
    this.$('preview').replaceChildren(
      new Option('Attributnamn', ''),
      ...this.getContext().drawings.map((d) => new Option(`${d.number} · ${d.name}`, d.id)),
    );
    this.modeUI();
    this.sync();
    this.fit();
    for (const b of this.dialog.querySelectorAll('[data-tool]'))
      b.setAttribute('aria-pressed', String(b.dataset.tool === this.tool));
  }
  switchMode(mode) {
    if (mode === this.mode) return;
    this.drafts[this.mode] = {
      frame: this.frame,
      undo: this.undo,
      redo: this.redo,
      dirty: this.dirty,
    };
    this.mode = mode;
    this.library = mode === 'layout' ? this.layouts : this.blocks;
    const draft = this.drafts[mode];
    this.frame = draft?.frame || (mode === 'layout' ? blankLayout() : blankFrame());
    this.undo = draft?.undo || [];
    this.redo = draft?.redo || [];
    this.dirty = draft?.dirty || false;
    this.selected.clear();
    this.modeUI();
    this.setTool('select');
    this.sync();
    this.fit();
  }
  modeUI() {
    const layout = this.mode === 'layout';
    this.dialog.querySelector('[data-action="revisionExample"]').hidden = layout;
    this.dialog.querySelector('[data-action="importDXF"]').hidden = layout;
    for (const b of this.dialog.querySelectorAll('[data-mode]'))
      b.setAttribute('aria-pressed', String(b.dataset.mode === this.mode));
    this.$('modeHint').textContent = layout
      ? 'Välj papper och placera referenser till sparade ramblock'
      : 'Rita ett återanvändbart block i mm · välj egen insättningspunkt';
    for (const b of this.dialog.querySelectorAll('[data-tool]'))
      b.hidden = layout
        ? ['line', 'polyline', 'text', 'attribute', 'image', 'origin'].includes(b.dataset.tool)
        : b.dataset.tool === 'insert';
    this.dialog.querySelector('.fe-entity-properties').hidden = layout;
    this.dialog.querySelector('.fe-block-placement').hidden = !layout;
    this.$('boundary').parentElement.hidden = false;
    this.$('boundary').nextSibling.textContent = layout ? 'Papprets kontur' : 'Arbetsytans kontur';
    this.$('paperTitle').textContent = layout ? 'Papper' : 'Arbetsyta · endast editor';
    this.$('paper').parentElement.hidden = !layout;
    this.$('landscape').parentElement.hidden = !layout;
    this.$('library').setAttribute('aria-label', layout ? 'Sparade layouter' : 'Sparade ramblock');
    this.$('blockChoice').replaceChildren(...this.blocks.map((b) => new Option(b.name, b.id)));
    this.dialog.querySelector('[data-action="new"]').textContent = layout
      ? 'Ny layout'
      : 'Nytt ramblock';
  }
  displayEntities() {
    return this.mode === 'layout' ? expandLayout(this.frame, this.blocks) : this.frame.entities;
  }
  canDiscard() {
    return (
      !this.dirty ||
      window.confirm('Ramen har osparade ändringar. Vill du lämna dem utan att spara?')
    );
  }
  loaded() {
    this.dirty = false;
    this.undo = [];
    this.redo = [];
    this.selected.clear();
    this.setTool('select');
    this.modeUI();
    this.sync();
    this.fit();
  }
  checkpoint() {
    this.undo.push(structuredClone(this.frame));
    if (this.undo.length > 100) this.undo.shift();
    this.redo = [];
    this.dirty = true;
  }
  sync() {
    this.$('name').value = this.frame.name;
    this.$('width').value = this.frame.width;
    this.$('height').value = this.frame.height;
    const paper = standardPapers.find(
      (p) =>
        Math.min(p.width, p.height) === Math.min(this.frame.width, this.frame.height) &&
        Math.max(p.width, p.height) === Math.max(this.frame.width, this.frame.height),
    );
    this.$('paper').value = paper?.id || 'custom';
    this.$('landscape').checked = this.frame.width >= this.frame.height;
    this.$('library').replaceChildren(
      new Option(this.mode === 'layout' ? 'Sparade layouter' : 'Sparade ramblock', ''),
      ...this.library.map((f) => new Option(f.name, f.id)),
    );
    this.$('library').value = this.library.some((f) => f.id === this.frame.id) ? this.frame.id : '';
    this.dialog.querySelector('[data-action="save"]').textContent = this.dirty
      ? 'Spara •'
      : 'Spara';
    this.instanceList();
    this.properties();
    this.render();
  }
  fit() {
    const r = this.canvas.getBoundingClientRect(),
      aspect = Math.max(r.width, 1) / Math.max(r.height, 1),
      h = Math.max(this.frame.height + 30, (this.frame.width + 30) / aspect),
      w = h * aspect;
    this.view = [(this.frame.width - w) / 2, (this.frame.height - h) / 2, w, h];
    this.render();
  }
  cancelSelection() {
    const p = this.selectionPress;
    this.selectionPress = null;
    if (p && this.svg.hasPointerCapture(p.id)) this.svg.releasePointerCapture(p.id);
  }
  setTool(tool) {
    this.cancelSelection();
    if (['move', 'copy', 'rotate'].includes(tool) && !this.selected.size) {
      this.status('Markera ett eller flera objekt först.');
      return;
    }
    if (['line', 'polyline', 'text', 'attribute', 'image', 'insert', 'origin'].includes(tool))
      this.selected.clear();
    this.tool = tool;
    this.vertexGrip = null;
    this.pending = [];
    this.base = null;
    this.cursor = null;
    this.$('command').value = '';
    if (tool === 'image') {
      this.$('file').value = '';
      this.$('file').click();
    }
    for (const b of this.dialog.querySelectorAll('[data-tool]'))
      b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
    this.status(
      {
        origin: 'Välj blockets insättningspunkt',
        insert: 'Välj block i listan och klicka placering',
        select: 'Dra åt höger: helt innanför · åt vänster: allt som träffas · Shift lägger till',
        line: 'Linje · välj startpunkt',
        polyline: 'Polylinje · välj startpunkt · Enter avslutar',
        text: 'Text · klicka insättningspunkt',
        attribute: 'Attribut · välj attribut och klicka insättningspunkt',
        image: 'Välj PNG, JPEG eller WebP',
        move: 'Flytta · välj baspunkt',
        copy: 'Kopiera · välj baspunkt',
        rotate: 'Rotera · välj rotationspunkt, ange vinkel',
      }[tool],
    );
    this.svg.focus({ preventScroll: true });
    this.properties();
    this.render();
  }
  raw(e) {
    const r = this.svg.getBoundingClientRect();
    return [
      this.view[0] + ((e.clientX - r.left) / r.width) * this.view[2],
      this.frame.height - (this.view[1] + ((e.clientY - r.top) / r.height) * this.view[3]),
    ];
  }
  pointer(e) {
    const options = Object.fromEntries(
      ['endpoints', 'midpoints', 'intersections', 'perpendicular', 'ortho', 'grid'].map((k) => [
        k,
        this.$(k).checked,
      ]),
    );
    const step = +this.$('step').value;
    this.snap = snapFrame(this.raw(e), {
      entities: this.displayEntities().filter(
        (e) => !(['move', 'copy', 'rotate'].includes(this.tool) && this.selected.has(e.id)),
      ),
      base: this.pending.at(-1) || this.base,
      tolerance: (this.view[2] / this.svg.clientWidth) * 9,
      polar: +this.$('polar').value,
      step: step > 0 ? step : 5,
      bounds: this.$('boundary').checked ? [this.frame.width, this.frame.height] : null,
      ...options,
    });
    this.cursor = this.snap.point;
    this.$('coordinates').textContent =
      `X ${this.cursor[0].toFixed(1)} · Y ${this.cursor[1].toFixed(1)} mm`;
    this.render();
  }
  startGrip(id, index) {
    const entity = this.frame.entities.find((e) => e.id === id);
    if (!entity) return;
    const point = frameGrips(entity, this.frame)[index];
    if (!point) return;
    if (entity.type !== 'line') this.selected = new Set([id]);
    else this.selected.add(id);
    const matches =
      entity.type === 'line'
        ? coincidentFrameVertices(this.frame.entities, this.selected, point)
        : null;
    this.setTool('move');
    this.vertexGrip = matches;
    this.base = [...point];
    this.cursor = [...point];
    this.status(
      matches
        ? 'Flytta gemensam linjepunkt · klicka ny placering eller ange avstånd · Esc avbryter'
        : 'Flytta objekt · klicka ny placering eller ange avstånd · Esc avbryter',
    );
    this.render();
  }

  pick(e) {
    if (this.tool === 'select') {
      const id = e.target.closest('[data-entity]')?.dataset.entity;
      if (!e.shiftKey) this.selected.clear();
      if (id) {
        if (this.selected.has(id) && e.shiftKey) this.selected.delete(id);
        else this.selected.add(id);
      }
      this.properties();
      this.render();
      return;
    }
    this.pointer(e);
    this.place(this.cursor);
  }
  place(p) {
    if (this.tool === 'origin') {
      this.checkpoint();
      this.frame.origin = [...p];
      this.setTool('select');
      this.sync();
      return;
    }
    if (this.tool === 'insert') {
      const blockId = this.$('blockChoice').value;
      if (!blockId) {
        this.status('Skapa och spara ett ramblock först.');
        return;
      }
      const anchor = this.$('anchor').value;
      this.checkpoint();
      this.frame.entities.push({
        id: crypto.randomUUID(),
        type: 'block',
        blockId,
        anchor,
        point: offsetForPoint(p, this.frame, anchor),
        angle: +this.$('blockAngle').value || 0,
      });
      this.sync();
      return;
    }

    if (['line', 'polyline'].includes(this.tool)) {
      if (this.pending.length && distance(p, this.pending.at(-1)) < 0.001) return;
      this.pending.push([...p]);
      if (this.tool === 'line' && this.pending.length === 2) this.finish();
      else {
        this.status('Välj nästa punkt eller ange längd · Enter avslutar');
        this.render();
      }
      return;
    }
    if (['move', 'copy', 'rotate'].includes(this.tool)) {
      if (!this.base) {
        this.base = [...p];
        this.status(
          this.tool === 'rotate'
            ? 'Ange rotationsvinkel och tryck Enter'
            : 'Välj målpunkt eller ange avstånd',
        );
        this.render();
        return;
      }
      if (this.tool !== 'rotate') this.transform(p);
      return;
    }
    const entity = {
      id: crypto.randomUUID(),
      type: this.tool,
      point: [...p],
      angle: +this.$('angle').value || 0,
      color: this.$('color').value || '#233940',
      font: this.$('font').value || 'Arial, sans-serif',
    };
    if (this.tool === 'image') {
      if (!this.image) {
        this.status('Välj en bild först.');
        return;
      }
      Object.assign(entity, this.image, { width: +this.$('imageWidth').value || 40 });
      entity.height = this.$('ratio').checked
        ? entity.width / this.image.ratio
        : Math.max(1, +this.$('imageHeight').value || 20);
    } else if (['text', 'attribute'].includes(this.tool)) {
      Object.assign(entity, {
        text: this.$('text').value,
        key: this.$('attribute').value,
        size: Math.max(0.5, +this.$('size').value || 3.5),
        align: this.$('align').value,
      });
    } else return;
    this.checkpoint();
    this.frame.entities.push(entity);
    this.sync();
    this.status('Placerat · klicka för fler eller Esc');
  }
  finish() {
    if (this.pending.length >= 2) {
      this.checkpoint();
      this.frame.entities.push({
        id: crypto.randomUUID(),
        type: 'line',
        points: structuredClone(this.pending),
        color: this.$('color').value || '#233940',
        stroke: Math.max(0.05, +this.$('stroke').value || 0.25),
      });
      this.sync();
    }
    this.pending = [];
    this.status('Välj startpunkt · Esc till markering');
    this.render();
  }
  exact() {
    try {
      if (!this.$('command').value.trim()) {
        this.finish();
        return;
      }
      if (this.tool === 'rotate' && this.base) {
        const n = Number(this.$('command').value.replace(',', '.'));
        if (!Number.isFinite(n)) throw Error('Ange en giltig vinkel.');
        this.transform(this.base, n);
      } else {
        const base = this.pending.at(-1) || this.base;
        if (!base || !this.cursor) throw Error('Välj baspunkt och peka ut riktningen först.');
        this.place(lengthPoint(base, this.cursor, this.$('command').value));
      }
      this.$('command').value = '';
      this.svg.focus({ preventScroll: true });
    } catch (e) {
      this.status(e.message);
    }
  }
  transform(target, degrees = 0) {
    this.checkpoint();
    const ids = new Set();
    const mapped = this.frame.entities
      .filter((e) => this.selected.has(e.id))
      .map((e) => {
        const n = this.vertexGrip
          ? moveFrameVertices(e, this.vertexGrip, target)
          : this.mode === 'layout'
            ? transformInstance(e, this.frame, this.base, target, degrees)
            : transformFrameEntity(e, this.base, target, degrees);
        if (this.tool === 'copy') n.id = crypto.randomUUID();
        ids.add(n.id);
        return n;
      });
    if (this.tool === 'copy') this.frame.entities.push(...mapped);
    else
      this.frame.entities = this.frame.entities.map((e) => mapped.find((n) => n.id === e.id) || e);
    this.selected = ids;
    this.setTool('select');
    this.sync();
  }
  properties() {
    const selected = this.frame.entities.filter((e) => this.selected.has(e.id));
    const creating = ['line', 'polyline', 'text', 'attribute', 'image', 'insert'].includes(
      this.tool,
    );
    const type = this.tool === 'polyline' ? 'line' : this.tool === 'insert' ? 'block' : this.tool;
    const fields = creating ? propertyFields[type] || [] : commonFields(selected),
      active = creating || selected.length > 0;
    this.visibleProperties = fields;
    this.changedProperties.clear();
    this.dialog.querySelector('.fe-paper').hidden = !!active;
    this.dialog.querySelector('.fe-entity-properties').hidden = !active || this.mode === 'layout';
    this.dialog.querySelector('.fe-block-placement').hidden = !active || this.mode !== 'layout';
    this.$('selection').textContent = creating
      ? { line: 'Ny linje', text: 'Ny text', attribute: 'Ny attributtext', image: 'Ny bild' }[
          type
        ] || 'Nytt objekt'
      : selected.length === 1
        ? { line: 'Linje / polylinje', text: 'Text', attribute: 'Attributtext', image: 'Bild' }[
            selected[0].type
          ] || 'Ramblock'
        : `${selected.length} markerade · gemensamma egenskaper`;
    for (const key of new Set(Object.values(propertyFields).flat())) {
      const input = this.$(key);
      input.closest('label').hidden = !fields.includes(key);
      if (input.tagName === 'SELECT') input.querySelector('option[data-mixed]')?.remove();
      if (!creating && fields.includes(key)) {
        const values = selected.map((e) => propertyValue(e, key)),
          mixed = values.some((v) => v !== values[0]);
        if (mixed && input.tagName === 'SELECT') {
          const option = new Option('Blandat', '');
          option.dataset.mixed = 'true';
          input.prepend(option);
        }
        input.value = mixed ? '' : values[0];
        input.placeholder = mixed ? 'Blandat' : '';
      }
    }
    for (const row of this.dialog.querySelectorAll('.fe-entity-properties .fe-pair'))
      row.hidden = [...row.children].every((e) => e.hidden);
    this.$('ratio').parentElement.hidden = !fields.includes('imageWidth');
    this.dialog.querySelector('[data-action="properties"]').hidden = creating || !fields.length;
    this.dialog.querySelector('[data-action="instanceApply"]').hidden = creating;
    this.$('instances').hidden = active;
    this.updatePalette();
    this.dialog.querySelector('.fe-origin-fields').hidden = this.mode !== 'block';
    this.$('originX').value = this.frame.origin?.[0] || 0;
    this.$('originY').value = this.frame.origin?.[1] || 0;
    for (const key of ['originX', 'originY'])
      this.$(key).parentElement.hidden = this.mode !== 'block';
    this.dialog.querySelector('[data-action="originApply"]').hidden = this.mode !== 'block';
  }

  async loadImage() {
    const file = this.$('file').files[0];
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      this.status('Välj PNG, JPEG eller WebP, högst 4 MB.');
      return;
    }
    try {
      const url = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        }),
        image = new Image();
      image.src = url;
      await image.decode();
      this.image = { src: url, ratio: image.naturalWidth / image.naturalHeight };
      this.$('imageHeight').value = (+this.$('imageWidth').value || 40) / this.image.ratio;
      this.status('Bild klar · klicka insättningspunkt');
    } catch {
      this.status('Bilden kunde inte läsas.');
    }
  }
  instanceList() {
    if (this.mode !== 'layout') return;
    this.$('instances').replaceChildren();
    for (const e of this.frame.entities) {
      const b = document.createElement('button');
      b.textContent = this.blocks.find((b) => b.id === e.blockId)?.name || 'Block saknas';
      b.onclick = () => {
        this.selected = new Set([e.id]);
        this.properties();
        this.render();
      };
      this.$('instances').append(b);
    }
  }
  action(name) {
    if (name === 'settings') {
      this.settings.showModal();
      return;
    }
    if (name === 'originApply') {
      const p = [+this.$('originX').value, +this.$('originY').value];
      if (!p.every(Number.isFinite)) return;
      this.checkpoint();
      this.frame.origin = p;
      this.sync();
      return;
    }

    if (name === 'instanceApply') {
      if (this.mode !== 'layout' || !this.selected.size) return;
      const changed = [...this.changedProperties].filter((k) => this.visibleProperties.includes(k));
      if (!changed.length) return;
      try {
        const next = this.frame.entities.map((e) => {
          if (!this.selected.has(e.id)) return e;
          const n = { ...e, point: [...e.point] };
          if (changed.includes('anchor')) {
            n.anchor = this.$('anchor').value;
            n.point = offsetForPoint(instancePoint(e, this.frame), this.frame, n.anchor);
          }
          if (changed.includes('blockChoice')) n.blockId = this.$('blockChoice').value;
          for (const [key, index] of [
            ['offsetX', 0],
            ['offsetY', 1],
          ])
            if (changed.includes(key)) {
              const v = Number(this.$(key).value);
              if (!this.$(key).value.trim() || !Number.isFinite(v))
                throw Error('Ange ett giltigt avstånd.');
              n.point[index] = v;
            }
          if (changed.includes('blockAngle')) {
            const v = Number(this.$('blockAngle').value);
            if (!this.$('blockAngle').value.trim() || !Number.isFinite(v))
              throw Error('Ange en giltig vinkel.');
            n.angle = v;
          }
          return n;
        });
        this.checkpoint();
        this.frame.entities = next;
        this.sync();
      } catch (error) {
        this.status(error.message);
      }
      return;
    }

    if (name === 'close') {
      this.dialog.close();
      return;
    }
    if (name === 'importDXF') {
      import('./frame-dxf-dialog.js')
        .then(({ showFrameDXFImport }) => showFrameDXFImport(this))
        .catch((error) => this.status(error.message));
      return;
    }
    if (name === 'revisionExample') {
      if (this.canDiscard()) {
        this.frame = revisionExampleBlock();
        this.loaded();
        this.dirty = true;
        this.sync();
      }
      return;
    }
    if (name === 'new') {
      if (this.canDiscard()) {
        this.frame = this.mode === 'layout' ? blankLayout() : blankFrame();
        this.loaded();
      }
      return;
    }
    if (name === 'fit') {
      this.fit();
      return;
    }
    if (name === 'finish') {
      this.finish();
      this.setTool('select');
      return;
    }
    if (name === 'open') {
      const kind = this.mode === 'layout' ? 'layout' : 'ramblock';
      const usage = (item) =>
        libraryUsage(
          item.id,
          kind,
          [
            ...this.layouts,
            ...(this.mode === 'layout'
              ? [this.frame]
              : this.drafts.layout
                ? [this.drafts.layout.frame]
                : []),
          ],
          this.getContext().drawings,
        );
      this.fileDialog.manage({
        kind,
        items: () => this.library,
        usage: (item) => [...new Set(usage(item))],
        onOpen: (item) => {
          if (!this.canDiscard()) return false;
          this.frame = structuredClone(item);
          this.loaded();
        },
        onChange: (operation, item, title) => {
          if (operation === 'delete' && usage(item).length)
            throw Error('Objektet används och kan inte tas bort.');
          if (operation === 'delete' && this.frame.id === item.id && this.dirty)
            throw Error('Spara eller öppna ett annat objekt innan du tar bort det här.');
          if (operation === 'rename' && !title) throw Error('Ange ett namn.');
          const next =
            operation === 'copy'
              ? [...this.library, copyLibraryItem(item, this.library)]
              : operation === 'delete'
                ? this.library.filter((i) => i.id !== item.id)
                : this.library.map((i) => (i.id === item.id ? { ...i, name: title } : i));
          try {
            localStorage.setItem(
              kind === 'layout' ? LAYOUT_KEY : FRAME_LIBRARY_KEY,
              JSON.stringify(next),
            );
          } catch {
            throw Error('Kunde inte spara ändringen. Lagringen kan vara full.');
          }
          this.library = next;
          if (kind === 'layout') this.layouts = next;
          else this.blocks = next;
          if (this.frame.id === item.id) {
            if (operation === 'rename') this.frame.name = title;
            if (operation === 'delete') {
              this.frame = kind === 'layout' ? blankLayout() : blankFrame();
              this.loaded();
            }
          }
          this.modeUI();
          this.sync();
        },
      });
      return;
    }
    if (name === 'save' || name === 'saveAs') {
      const copy = name === 'saveAs',
        persist = (title) => {
          if (!title) throw Error('Ange ett namn.');
          const saved = {
            ...structuredClone(this.frame),
            name: title,
            ...(copy ? { id: crypto.randomUUID() } : {}),
          };
          const library = [...this.library.filter((f) => f.id !== saved.id), saved];
          try {
            localStorage.setItem(
              this.mode === 'layout' ? LAYOUT_KEY : FRAME_LIBRARY_KEY,
              JSON.stringify(library),
            );
          } catch {
            throw Error('Kunde inte spara. Lagringen kan vara full; prova mindre bilder.');
          }
          this.frame = structuredClone(saved);
          this.library = library;
          if (this.mode === 'layout') this.layouts = library;
          else this.blocks = library;
          this.dirty = false;
          this.sync();
          this.status('Sparat i programmets lokala bibliotek.');
        };
      if (copy || !this.library.some((f) => f.id === this.frame.id)) {
        this.fileDialog.save(
          this.frame.name + (copy ? ' – kopia' : ''),
          this.mode === 'layout' ? 'layout' : 'ramblock',
          persist,
        );
      } else {
        try {
          persist(this.frame.name);
        } catch (error) {
          this.status(error.message);
        }
      }
      return;
    }

    if (name === 'undo' || name === 'redo') {
      const from = name === 'undo' ? this.undo : this.redo,
        to = name === 'undo' ? this.redo : this.undo;
      if (from.length) {
        to.push(structuredClone(this.frame));
        this.frame = from.pop();
        this.dirty = true;
        this.selected.clear();
        this.pending = [];
        this.base = null;
        this.sync();
      }
      return;
    }
    if (name === 'delete') {
      if (this.selected.size) {
        this.checkpoint();
        this.frame.entities = this.frame.entities.filter((e) => !this.selected.has(e.id));
        this.selected.clear();
        this.sync();
      }
      return;
    }
    if (name === 'attributeAdd') {
      const label = this.$('attributeName').value.trim();
      if (!label) return;
      const a = {
        key: 'custom.' + crypto.randomUUID(),
        name: label,
        scope: this.$('attributeScope').value,
        dataType: this.$('attributeType').value,
      };
      this.custom = customAttributes();
      try {
        localStorage.setItem(ATTRIBUTE_KEY, JSON.stringify([...this.custom, a]));
        this.custom.push(a);
        this.$('attribute').add(
          new Option(
            `${a.name} · ${a.scope === 'SP' ? 'Single Part' : a.scope === 'GA' ? 'GA' : 'Gemensamt'}`,
            a.key,
          ),
        );
        this.$('attribute').value = a.key;
        this.$('attributeName').value = '';
        this.status('Eget attribut tillagt.');
      } catch {
        this.status('Attributet kunde inte sparas.');
      }
      return;
    }
    if (name === 'attributeValue') {
      const key = this.$('attribute').value;
      if (!key.startsWith('custom.')) {
        this.status('Inbyggda attribut hämtar värden från vald ritning.');
        return;
      }
      this.checkpoint();
      this.frame.previewValues = {
        ...this.frame.previewValues,
        [key.slice(7)]: this.$('attributeValue').value,
      };
      this.sync();
      return;
    }
    if (name === 'properties' && this.selected.size) {
      try {
        const changes = Object.fromEntries(
          [...this.changedProperties]
            .filter((k) => this.visibleProperties.includes(k))
            .map((k) => [k, this.$(k).value]),
        );
        if (!Object.keys(changes).length) return;
        if (changes.color && !/^#[0-9a-f]{6}$/i.test(changes.color))
          throw Error('Ange färg som #RRGGBB.');
        const next = this.frame.entities.map((e) =>
          this.selected.has(e.id) ? patchFrameProperties(e, changes, this.$('ratio').checked) : e,
        );
        this.checkpoint();
        this.frame.entities = next;
        this.sync();
        this.status('Markerade objekt uppdaterade.');
      } catch (error) {
        this.status(error.message);
      }
    }
  }
  key(e) {
    e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && ['s', 'o'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      this.action(e.key.toLowerCase() === 'o' ? 'open' : e.shiftKey ? 'saveAs' : 'save');
      return;
    }
    const editing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
    if (e.key === 'Escape') {
      e.preventDefault();
      this.setTool('select');
      return;
    }
    if (editing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.action(e.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.action('delete');
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.exact();
    }
    if (e.key === 'F8') {
      e.preventDefault();
      this.$('ortho').checked = !this.$('ortho').checked;
    }
    if (/^[0-9+.,-]$/.test(e.key) && this.tool !== 'select') {
      e.preventDefault();
      this.$('command').value = e.key;
      this.$('command').focus();
    }
  }
  render() {
    if (!this.view) return;
    this.svg.setAttribute('viewBox', this.view.join(' '));
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.svg.replaceChildren(
      svg('rect', {
        x: 0,
        y: 0,
        width: this.frame.width,
        height: this.frame.height,
        fill: 'white',
        stroke: '#a4b5bc',
        'stroke-width': 0.3,
      }),
    );
    const g = svg('g', { transform: `translate(0 ${this.frame.height}) scale(1 -1)` });
    this.svg.append(g);
    const context = this.getContext(),
      drawing = context.drawings.find((d) => d.id === this.$('preview').value),
      ctx = {
        project: context.project,
        drawing: drawing || {},
        custom: drawing?.attributes || this.frame.previewValues || {},
      };
    const paint = (e, ghost = false) => {
      const group = svg('g', { 'data-entity': e.id, opacity: ghost ? 0.45 : 1 });
      g.append(group);
      const color = this.selected.has(e.id) ? '#178268' : e.color || '#233940';
      if (e.type === 'line') {
        const points = e.points.map((p) => p.join(',')).join(' ');
        group.append(
          svg('polyline', {
            points,
            fill: 'none',
            stroke: 'transparent',
            'stroke-width': Math.max(e.stroke, (this.view[2] / this.svg.clientWidth) * 10),
            'pointer-events': 'stroke',
          }),
          svg('polyline', {
            points,
            fill: 'none',
            stroke: color,
            'stroke-width': e.stroke,
            'pointer-events': 'none',
          }),
        );
      } else {
        group.setAttribute(
          'transform',
          `translate(${e.point.join(' ')}) rotate(${e.angle || 0}) scale(1 -1)`,
        );
        if (e.type === 'image') {
          group.append(
            svg('image', { href: e.src, x: 0, y: -e.height, width: e.width, height: e.height }),
          );
          if (this.selected.has(e.id))
            group.append(
              svg('rect', {
                x: 0,
                y: -e.height,
                width: e.width,
                height: e.height,
                fill: 'none',
                stroke: color,
                'stroke-width': 0.4,
              }),
            );
        } else {
          const name = this.attrs().find((a) => a.key === e.key)?.name || e.key,
            value =
              e.type === 'attribute'
                ? drawing
                  ? attributeValue(e.key, ctx)
                  : `〈${name}〉`
                : e.text;
          group.append(
            svg(
              'text',
              {
                'font-size': e.size,
                'font-family': e.font || 'Arial, sans-serif',
                'text-anchor': e.align,
                fill: e.type === 'attribute' && !drawing ? '#397dc5' : color,
              },
              value || ' ',
            ),
          );
        }
      }
      if (ghost) group.setAttribute('pointer-events', 'none');
    };
    this.displayEntities().forEach((e) => paint(e));
    if (this.mode === 'block') {
      const p = this.frame.origin || [0, 0];
      g.append(
        svg('path', {
          d: `M${p[0] - 4},${p[1]}h8 M${p[0]},${p[1] - 4}v8`,
          stroke: '#d25650',
          'stroke-width': 0.4,
          'pointer-events': 'none',
        }),
      );
    }
    if (this.pending.length)
      paint(
        {
          id: '',
          type: 'line',
          points: [...this.pending, ...(this.cursor ? [this.cursor] : [])],
          stroke: +this.$('stroke').value || 0.25,
        },
        true,
      );
    if (this.base && this.cursor && ['move', 'copy'].includes(this.tool))
      this.displayEntities()
        .filter((e) => this.selected.has(e.id))
        .forEach((e) =>
          paint(
            this.vertexGrip
              ? moveFrameVertices(e, this.vertexGrip, this.cursor)
              : transformFrameEntity(e, this.base, this.cursor),
            true,
          ),
        );
    if (this.tool === 'select') {
      const r = (this.view[2] / Math.max(this.svg.clientWidth, 1)) * 4;
      for (const entity of this.frame.entities.filter((e) => this.selected.has(e.id)))
        frameGrips(entity, this.frame).forEach((p, index) => {
          const grip = svg('g', {
            'data-grip': entity.id,
            'data-index': index,
            role: 'button',
            tabindex: 0,
            'aria-label': `Flytta ${entity.type === 'line' ? 'linje' : entity.type === 'text' ? 'text' : entity.type === 'attribute' ? 'attributtext' : entity.type === 'block' ? 'ramblock' : 'bild'} från punkt ${index + 1}`,
            class: 'fe-object-grip',
          });
          grip.append(
            svg('circle', { cx: p[0], cy: p[1], r: r * 2.2, fill: 'transparent' }),
            svg('rect', {
              x: p[0] - r,
              y: p[1] - r,
              width: r * 2,
              height: r * 2,
              fill: 'white',
              stroke: '#178268',
              'stroke-width': r * 0.35,
            }),
            svg(
              'title',
              {},
              entity.type === 'line'
                ? 'Klicka för att flytta sammanfallande punkter i markerade linjer.'
                : 'Klicka punkten, klicka sedan ny placering. Hela objektet flyttas.',
            ),
          );
          grip.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              this.startGrip(entity.id, index);
            }
          });
          g.append(grip);
        });
    }
    if (this.selectionPress?.dragging) {
      const p = this.selectionPress,
        r = this.svg.getBoundingClientRect(),
        a = p.start,
        b = p.end,
        crossing = b[0] < a[0];
      this.svg.append(
        svg('rect', {
          'data-selection-window': crossing ? 'crossing' : 'window',
          x: this.view[0] + ((Math.min(a[0], b[0]) - r.left) / r.width) * this.view[2],
          y: this.view[1] + ((Math.min(a[1], b[1]) - r.top) / r.height) * this.view[3],
          width: (Math.abs(a[0] - b[0]) / r.width) * this.view[2],
          height: (Math.abs(a[1] - b[1]) / r.height) * this.view[3],
          fill: crossing ? '#20a56e' : '#397dc5',
          'fill-opacity': 0.12,
          stroke: crossing ? '#16845a' : '#397dc5',
          'stroke-width': 1,
          'stroke-dasharray': crossing ? '5 3' : 'none',
          'vector-effect': 'non-scaling-stroke',
          'pointer-events': 'none',
        }),
      );
    }
    if (this.cursor && this.tool !== 'select') {
      const s = (this.view[2] / Math.max(this.svg.clientWidth, 1)) * 5;
      g.append(
        svg(
          this.snap?.kind === 'Mittpunkt' ? 'circle' : 'rect',
          this.snap?.kind === 'Mittpunkt'
            ? {
                cx: this.cursor[0],
                cy: this.cursor[1],
                r: s,
                fill: 'none',
                stroke: '#15946d',
                'stroke-width': s * 0.25,
                'pointer-events': 'none',
              }
            : {
                x: this.cursor[0] - s,
                y: this.cursor[1] - s,
                width: s * 2,
                height: s * 2,
                fill: 'none',
                stroke: '#15946d',
                'stroke-width': s * 0.25,
                'pointer-events': 'none',
              },
        ),
      );
    }
  }
}
