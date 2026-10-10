import { installProfileWorkspace } from './ui/profile-workspace.js';
import { inputWheelGesture } from './input-device.js';
import { sectionTemplate, TEMPLATE_KEYS, dimensionLabel } from './section-templates.js';
import { PROFILE_TYPES, profileType, renderProfileTree } from './profile-tree.js';
import { withBuiltinCatalog, personalProfiles, isBuiltinProfile } from './profile-catalog.js';
import {
  LIBRARY_KEY,
  evaluateSection,
  profileSnapshot,
  validateLibrary,
  mergeLibrary,
  expression,
  parameterValues,
} from './section-profile.js';
const clone = (x) => structuredClone(x),
  uid = () => crypto.randomUUID(),
  point = (x, y) => ({ id: uid(), x, y });
const blank = () => ({
  id: null,
  revision: 0,
  name: 'Egen profil',
  profileType: 'custom',
  family: '',
  standard: '',
  source: '',
  density: 7850,
  parameters: [],
  loops: [],
  anchor: [0, 0],
  catalog: {},
});
export class SectionEditor {
  constructor(onUse) {
    this.onUse = onUse;
    this.profiles = withBuiltinCatalog([]);
    this.def = blank();
    this.draft = [];
    this.undo = [];
    this.redo = [];
    this.selected = [];
    this.mode = 'poly';
    this.scale = 1;
    this.center = [0, 0];
    this.pointer = null;
    this.error = '';
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      if (raw) this.profiles = withBuiltinCatalog(validateLibrary(JSON.parse(raw)));
    } catch (e) {
      this.error = 'Biblioteket kunde inte läsas: ' + e.message;
    }
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'section-editor';
    this.dialog.innerHTML = `
  <header class="section-header"><div><strong>Tvärsnittsbibliotek</strong><span>mm · 2D</span></div><button type="button" data-action="close" aria-label="Stäng tvärsnittsbibliotek">×</button></header>
  <div class="section-layout"><nav class="section-library" aria-label="Sparade tvärsnitt"><div class="section-library-actions"><button data-action="new">Ny</button><button data-action="variant">Ny variant</button></div><input id="section-search" placeholder="Sök typ, familj eller storlek" aria-label="Sök tvärsnitt"><div class="section-tree-actions"><button data-action="collapse-tree">Fäll ihop</button><button data-action="expand-tree">Visa alla</button></div><div id="section-list"></div><div class="section-library-actions"><button data-action="export">Exportera</button><button data-action="import">Importera</button></div><input type="file" id="section-import" accept=".json,application/json" hidden><small>Tibnor 2023 och svenska träprofiler ingår offline. Egna profiler lagras i webbläsaren; exportera för säkerhetskopia.</small></nav>
  <section class="section-drawing"><div class="section-tools"><button data-mode="select">Markera</button><button data-mode="poly">Polylinje</button><button data-mode="rect">Rektangel</button><button data-mode="hole">Hål</button><button data-mode="anchor">Insättningspunkt</button><button data-action="finish">Slut kontur</button><button data-action="undo">↶</button><button data-action="redo">↷</button><button data-action="fit">Visa allt</button></div><div class="section-tracking"><label><input id="section-ortho" type="checkbox"> Ortho</label><label>Polar <select id="section-polar"><option value="0">Av</option><option value="15">15°</option><option value="45" selected>45°</option><option value="90">90°</option></select></label><label><input id="section-snap" type="checkbox" checked> Snap</label><span>Panorera: mitten/höger musknapp</span></div><canvas id="section-canvas" tabindex="0" aria-label="Rita tvärsnitt i millimeter"></canvas><form id="section-command"><label>X<input id="section-x" autocomplete="off" value="0"></label><label>Y<input id="section-y" autocomplete="off" value="0"></label><button type="submit">Punkt ↵</button><label>Längd<input id="section-length" inputmode="decimal" autocomplete="off" placeholder="mm"></label><button type="button" data-action="length">Lägg till</button><span id="section-coordinates"></span></form><p id="section-feedback" role="status"></p></section>
  <section class="section-properties"><label class="field">Profiltyp<select id="section-profileType"></select></label><label class="field">Storlek / profilnamn<input id="section-name" maxlength="120"></label><label class="field">Familj<input id="section-family" maxlength="120" placeholder="Exempelvis HEA"></label><details><summary>Identitet och källa</summary><label class="field">Standard<input id="section-standard" maxlength="120"></label><label class="field">Källa<input id="section-source" maxlength="300"></label><label class="field">Densitet · kg/m³<input id="section-density" type="number" min="0" max="30000"></label></details><div id="section-template-fields"></div><small id="section-template-note"></small><details open><summary>Parametrar</summary><textarea id="section-parameters" rows="3" placeholder="B = 200\nH = 300\nt = 10" aria-label="Parametrar"></textarea><small>En per rad. Koppla en parameter via punktens X- eller Y-uttryck nedan.</small><div id="section-parameter-links"></div><div class="section-library-actions"><button data-action="rectangle-template">B × H</button><button data-action="i-template">I-profil</button></div></details><details id="section-point-panel" open><summary>Punktkopplingar</summary><small id="section-point-hint">Välj en punkt i listan eller på profilen för att ändra dess uttryck.</small><div id="section-bindings"></div><div id="section-point-fields"><label class="field">X-uttryck<input id="section-point-x"></label><label class="field">Y-uttryck<input id="section-point-y"></label><button data-action="point">Ändra punkt</button></div><button data-action="delete">Ta bort markering</button><div id="section-contours"></div></details><details><summary>Insättningspunkt</summary><label class="field">X<input id="section-anchor-x"></label><label class="field">Y<input id="section-anchor-y"></label><button data-action="anchor">Ändra insättningspunkt</button></details><details open><summary>Beräknat från konturen</summary><dl id="section-metrics"></dl><small>X horisontell, Y vertikal. Ix kring X genom tyngdpunkten, Iy kring Y. Masseberäkning använder angiven densitet.</small></details><details><summary>Katalogvärden (separata)</summary><div id="section-catalog"></div><small>Katalogvärden ändrar inte geometrin och skrivs inte över av beräkningen.</small></details><p id="section-version"></p><div class="section-save"><button class="primary" data-action="save">Spara version</button><button data-action="use">Använd på sweep</button></div></section></div>`;
    document.body.append(this.dialog);
    this.$ = (id) =>
      this.dialog.querySelector('#section-' + id) ||
      this.libraryDialog?.querySelector('#section-' + id);
    for (const [value, label] of PROFILE_TYPES)
      this.$('profileType').append(new Option(label, value));
    this.canvas = this.$('canvas');
    this.ctx = this.canvas.getContext('2d');
    for (const [key, label] of [
      ['A', 'Area · mm²'],
      ['Ix', 'Ix · mm⁴'],
      ['Iy', 'Iy · mm⁴'],
      ['Wx', 'Wx · mm³'],
      ['Wy', 'Wy · mm³'],
      ['WyPlus', 'Wy + · mm³'],
      ['WyMinus', 'Wy − · mm³'],
      ['cx', 'Tyngdpunkt X · mm'],
      ['cy', 'Tyngdpunkt Y · mm'],
      ['J', 'Vridkonstant J · mm⁴'],
      ['massPerMeter', 'Massa · kg/m'],
    ]) {
      const l = document.createElement('label');
      l.className = 'field';
      l.textContent = label;
      const input = document.createElement('input');
      input.type = 'number';
      if (!['cx', 'cy'].includes(key)) input.min = '0';
      input.step = 'any';
      input.dataset.catalog = key;
      l.append(input);
      this.$('catalog').append(l);
      input.oninput = () => this.metadata();
    }
    this.dialog
      .querySelectorAll('[data-action]')
      .forEach((b) => (b.onclick = () => this.action(b.dataset.action)));
    this.dialog.querySelectorAll('[data-mode]').forEach(
      (b) =>
        (b.onclick = () => {
          this.mode = b.dataset.mode;
          this.draft = [];
          this.selected = [];
          this.sync();
        }),
    );
    for (const key of [
      'name',
      'family',
      'profileType',
      'standard',
      'source',
      'density',
      'parameters',
    ])
      this.$(key).oninput = () => this.metadata();
    this.$('profileType').oninput = () => this.changeType();
    this.$('search').oninput = () => this.list();
    this.$('import').onchange = () => this.importFile();
    this.$('command').onsubmit = (e) => {
      e.preventDefault();
      this.run(() =>
        this.add([
          expression(this.$('x').value, this.resolve.bind(this)),
          expression(this.$('y').value, this.resolve.bind(this)),
        ]),
      );
    };
    this.$('length').onfocus = () => {
      const a = this.draft.at(-1),
        b = this.pointer;
      if (a && b) {
        const d = [b[0] - a[0], b[1] - a[1]],
          n = Math.hypot(...d);
        this.direction = n ? d.map((v) => v / n) : null;
      }
    };
    this.$('length').onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.action('length');
      }
    };
    this.canvas.oncontextmenu = (e) => e.preventDefault();
    this.canvas.onpointerdown = (e) => this.down(e);
    this.canvas.onpointermove = (e) => this.move(e);
    this.canvas.onpointerup = (e) => this.up(e);
    this.canvas.onpointercancel = () => {
      this.drag = null;
      this.draw();
    };
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const gesture = inputWheelGesture(e, undefined, this.canvas.clientHeight);
        if (gesture.action === 'pan') {
          this.center[0] += gesture.x / this.scale;
          this.center[1] -= gesture.y / this.scale;
          this.draw();
          return;
        }
        const p = this.local(e),
          before = this.world(p);
        this.scale = Math.min(200, Math.max(0.005, this.scale * Math.exp(-gesture.y * 0.001)));
        const after = this.world(p);
        this.center = this.center.map((v, i) => v + before[i] - after[i]);
        this.draw();
      },
      { passive: false },
    );
    this.dialog.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const input = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (input) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.draft = [];
        this.drag = null;
        this.mode = 'select';
        this.sync();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.action('finish');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.action(e.shiftKey ? 'redo' : 'undo');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.action('delete');
      } else if (/^\d$/.test(e.key) && this.draft.length) {
        e.preventDefault();
        this.$('length').focus();
        this.$('length').value = e.key;
      }
    });
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.draft = [];
      this.mode = 'select';
      this.sync();
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas);
    this.libraryUI = installProfileWorkspace(this);
    this.sync();
  }
  run(fn) {
    try {
      fn();
      this.error = '';
    } catch (e) {
      this.error = e.message;
    }
    this.sync(false);
  }
  checkpoint() {
    this.undo.push(clone({ def: this.def, draft: this.draft, mode: this.mode }));
    if (this.undo.length > 100) this.undo.shift();
    this.redo = [];
  }
  resolve(name) {
    const value = this.values?.[name];
    if (value === undefined) throw new Error('Okänd parameter: ' + name);
    return value;
  }
  clearCatalog() {
    this.def.catalog = {};
    this.$('catalog')
      .querySelectorAll('input')
      .forEach((input) => {
        input.value = '';
      });
  }
  metadata() {
    this.checkpoint();
    const dimensionsBefore = JSON.stringify(
      this.def.parameters.map((p) => [p.name, String(p.value)]),
    );
    const densityBefore = this.def.density;
    for (const key of ['name', 'family', 'profileType', 'standard', 'source'])
      this.def[key] = this.$(key).value;
    this.def.density = +this.$('density').value;
    this.def.parameters = this.$('parameters')
      .value.split('\n')
      .filter((s) => s.trim())
      .map((line) => {
        const [name, ...value] = line.split('=');
        return { name: name.trim(), value: value.join('=').trim() };
      });
    if (
      densityBefore !== this.def.density ||
      dimensionsBefore !== JSON.stringify(this.def.parameters.map((p) => [p.name, String(p.value)]))
    )
      this.clearCatalog();
    this.def.catalog = {};
    this.$('catalog')
      .querySelectorAll('input')
      .forEach((i) => {
        if (i.value.trim()) this.def.catalog[i.dataset.catalog] = Number(i.value);
      });
    this.sync(false);
  }
  sync(fill = true) {
    if (fill) {
      for (const key of ['name', 'family', 'profileType', 'standard', 'source', 'density'])
        this.$(key).value = this.def[key] ?? '';
      this.$('profileType').value = profileType(this.def);
      this.$('parameters').value = this.def.parameters
        .map((p) => `${p.name} = ${p.value}`)
        .join('\n');
      this.$('anchor-x').value = this.def.anchor[0];
      this.$('anchor-y').value = this.def.anchor[1];
      this.$('catalog')
        .querySelectorAll('input')
        .forEach((i) => (i.value = this.def.catalog[i.dataset.catalog] ?? ''));
    }
    this.templateFields();
    this.evaluated = null;
    let validation = '';
    try {
      this.values = parameterValues(this.def.parameters);
    } catch (e) {
      this.values = {};
      validation = e.message;
    }
    try {
      this.evaluated = evaluateSection(this.def);
    } catch (e) {
      validation = e.message;
    }
    this.$('feedback').textContent =
      this.error ||
      validation ||
      (this.draft.length ? `${this.draft.length} punkter · Enter sluter konturen` : 'Redo');
    this.dialog
      .querySelectorAll('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === this.mode)));
    this.dialog.querySelector('[data-action=save]').disabled =
      !this.evaluated || !!this.draft.length;
    this.dialog.querySelector('[data-action=use]').disabled =
      !this.evaluated || !!this.draft.length;
    this.dialog.querySelector('[data-action=undo]').disabled = !this.undo.length;
    this.dialog.querySelector('[data-action=redo]').disabled = !this.redo.length;
    this.$('version').textContent = this.def.id
      ? isBuiltinProfile(this.def)
        ? 'Standardprofil · Ändringar sparas som en egen profil'
        : `Version ${this.def.revision} · Spara skapar en ny version`
      : 'Ny biblioteksprofil';
    const vertex = this.vertices().find(
      (v) => this.selected.length === 1 && this.selected.includes(v.id),
    );
    this.$('point-fields').hidden = !vertex;
    if (vertex) {
      this.$('point-x').value = vertex.x;
      this.$('point-y').value = vertex.y;
    }
    const metrics = this.$('metrics');
    metrics.replaceChildren();
    if (this.evaluated) {
      const p = this.evaluated.properties;
      for (const [label, value, unit] of [
        ['A', p.A, 'mm²'],
        ['Tyngdpunkt X', p.cx, 'mm'],
        ['Tyngdpunkt Y', p.cy, 'mm'],
        ['Ix', p.Ix, 'mm⁴'],
        ['Iy', p.Iy, 'mm⁴'],
        ['Ixy', p.Ixy, 'mm⁴'],
        ['Wx + / −', `${this.fmt(p.WxPlus)} / ${this.fmt(p.WxMinus)}`, 'mm³'],
        ['Wy + / −', `${this.fmt(p.WyPlus)} / ${this.fmt(p.WyMinus)}`, 'mm³'],
        ['Massa', p.massPerMeter, 'kg/m'],
      ]) {
        const dt = document.createElement('dt'),
          dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = (typeof value === 'number' ? this.fmt(value) : value) + ' ' + unit;
        metrics.append(dt, dd);
      }
    }
    this.$('contours').replaceChildren();
    this.def.loops.forEach((loop, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${i ? 'Hål ' + i : 'Ytterkontur'} · ${loop.vertices.length} punkter`;
      b.onclick = () => {
        this.mode = 'select';
        this.selected = loop.vertices.map((v) => v.id);
        this.sync(false);
      };
      this.$('contours').append(b);
    });
    this.bindings();
    this.list();
    this.libraryUI?.refreshProperties();
    this.libraryUI?.preview();
    this.draw();
  }
  changeType() {
    const type = this.$('profileType').value;
    this.checkpoint();
    const template = sectionTemplate(type);
    delete this.def.roundedRoots;
    delete this.def.radiusParameters;
    delete this.def.radiusSegmentAngle;
    delete this.def.flangeSlope;
    delete this.def.flangeThicknessReference;
    if (template) {
      Object.assign(this.def, template);
      this.def.catalog = {};
      this.draft = [];
      this.selected = [];
      this.mode = 'select';
    } else {
      this.def.profileType = type;
      delete this.def.template;
      delete this.def.roundedRoots;
      delete this.def.radiusParameters;
      delete this.def.radiusSegmentAngle;
      delete this.def.flangeSlope;
      delete this.def.flangeThicknessReference;
    }
    this.error = '';
    this.sync();
    this.fit();
  }
  templateFields() {
    const root = this.$('template-fields'),
      keys = [
        ...new Set([
          ...(TEMPLATE_KEYS[this.def.template] || []),
          ...(this.def.radiusParameters || (this.def.roundedRoots ? ['R'] : [])),
        ]),
      ],
      signature = keys.join(',');
    if (root.dataset.signature !== signature) {
      root.replaceChildren();
      root.dataset.signature = signature;
      for (const key of keys) {
        const label = document.createElement('label');
        label.className = 'field';
        label.textContent = dimensionLabel(key) + ' · mm';
        const input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.dataset.dimension = key;
        input.id = 'section-dimension-' + key;
        input.oninput = () => {
          this.checkpoint();
          this.def.parameters.find((p) => p.name === key).value = input.value;
          this.clearCatalog();
          this.$('parameters').value = this.def.parameters
            .map((p) => `${p.name} = ${p.value}`)
            .join('\n');
          this.sync(false);
        };
        label.append(input);
        root.append(label);
      }
    }
    for (const input of root.querySelectorAll('input'))
      if (document.activeElement !== input) {
        const p = this.def.parameters.find((p) => p.name === input.dataset.dimension);
        try {
          input.value = parameterValues(this.def.parameters)[p.name];
        } catch {
          input.value = '';
        }
      }
    this.$('template-note').textContent = keys.length
      ? this.def.radiusParameters?.length || this.def.roundedRoots
        ? 'Radier följer profilens parametrar, med segmenterade bågar. Ändrade mått rensar katalogvärdena.'
        : 'Ändra måtten här eller klicka på måtten i ritningen. Typbyte ersätter grundformen; Ångra återställer. Mallarna har skarpa hörn.'
      : 'Fri kontur och valfritt familjenamn. Parametrar kopplas via punktuttryck.';
    if (this.def.flangeSlope !== undefined)
      this.$('template-note').textContent += ' Flänslutning ' + this.def.flangeSlope + ' %.';
  }
  bindings() {
    const vertices = this.vertices(),
      names = this.def.parameters.map((p) => p.name),
      refs = (value) => String(value).match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    if (!names.includes(this.activeParameter)) this.activeParameter = null;
    const uses = (v, name) => [...refs(v.x), ...refs(v.y)].includes(name);
    const links = this.$('parameter-links');
    links.replaceChildren();
    for (const name of names) {
      const count = vertices.filter((v) => uses(v, name)).length,
        b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${name} · ${count ? count + ' punkter' : 'ingen punktkoppling'}`;
      b.setAttribute('aria-pressed', String(this.activeParameter === name));
      b.onclick = () => {
        this.activeParameter = this.activeParameter === name ? null : name;
        this.bindings();
        this.draw();
      };
      links.append(b);
    }
    const root = this.$('bindings');
    root.replaceChildren();
    this.linkedPoints = new Set();
    vertices.forEach((v, i) => {
      if (this.activeParameter && !uses(v, this.activeParameter)) return;
      if (this.activeParameter) this.linkedPoints.add(v.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = this.selected.includes(v.id) ? 'selected' : '';
      const title = document.createElement('strong');
      title.textContent = `P${i + 1}`;
      const expressions = document.createElement('span');
      expressions.textContent = `X: ${v.x}  ·  Y: ${v.y}`;
      const value = document.createElement('small');
      try {
        value.textContent = `→ ${this.fmt(expression(v.x, this.resolve.bind(this)))}, ${this.fmt(expression(v.y, this.resolve.bind(this)))} mm`;
      } catch {
        value.textContent = 'Ogiltigt uttryck';
      }
      b.append(title, expressions, value);
      b.onclick = () => {
        this.mode = 'select';
        this.selected = [v.id];
        this.sync(false);
        this.$('point-panel').open = true;
      };
      root.append(b);
    });
    this.$('point-hint').textContent =
      this.selected.length === 1
        ? `P${vertices.findIndex((v) => v.id === this.selected[0]) + 1} · Ändra uttrycken nedan. Exempel: X = B/2.`
        : vertices.length
          ? 'Välj en punkt här eller på profilen för att ändra dess uttryck.'
          : 'Rita en kontur eller välj en mall för att skapa punktkopplingar.';
  }
  fmt(n) {
    return n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });
  }
  vertices() {
    return this.def.loops.flatMap((l) => l.vertices);
  }
  evaluatedPoints() {
    try {
      return this.def.loops.map((l) =>
        l.vertices.map((v) => [
          expression(v.x, this.resolve.bind(this)),
          expression(v.y, this.resolve.bind(this)),
        ]),
      );
    } catch {
      return this.evaluated?.loops || [];
    }
  }
  list() {
    renderProfileTree(this.$('list'), this.profiles, this.def, this.$('search').value, (d) => {
      this.checkpoint();
      this.def = clone(d);
      this.draft = [];
      this.selected = [];
      this.error = '';
      this.sync();
      this.fit();
    });
  }
  open() {
    this.list();
    this.libraryUI.preview();
    this.libraryWindow.open();
  }
  openEditor() {
    if (!this.dialog.open) this.dialog.showModal();
    this.resize();
    this.fit();
    this.canvas.focus();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.width = r.width;
    this.height = r.height;
    const d = Math.min(devicePixelRatio, 2);
    this.canvas.width = r.width * d;
    this.canvas.height = r.height * d;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.draw();
  }
  world(p) {
    return [
      (p[0] - this.width / 2) / this.scale + this.center[0],
      (this.height / 2 - p[1]) / this.scale + this.center[1],
    ];
  }
  screen(p) {
    return [
      (p[0] - this.center[0]) * this.scale + this.width / 2,
      this.height / 2 - (p[1] - this.center[1]) * this.scale,
    ];
  }
  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  fit() {
    const points = [...this.evaluatedPoints().flat(), ...this.draft];
    if (!points.length) {
      this.center = [0, 0];
      this.scale = Math.min(this.width, this.height) / 600;
    } else {
      const x = points.map((p) => p[0]),
        y = points.map((p) => p[1]),
        min = [Math.min(...x), Math.min(...y)],
        max = [Math.max(...x), Math.max(...y)];
      this.center = min.map((v, i) => (v + max[i]) / 2);
      this.scale =
        Math.min(
          this.width / Math.max(max[0] - min[0], 50),
          this.height / Math.max(max[1] - min[1], 50),
        ) * 0.65;
    }
    this.draw();
  }
  snap(p) {
    let best = null,
      dist = 10 / this.scale;
    const loops = this.evaluatedPoints(),
      candidates = [...loops.flat(), ...this.draft, [0, 0]];
    const segments = [];
    loops.forEach((l) => l.forEach((a, i) => segments.push([a, l[(i + 1) % l.length]])));
    segments.forEach(([a, b]) => candidates.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
    if (segments.length <= 200)
      for (let i = 0; i < segments.length; i++)
        for (let j = i + 1; j < segments.length; j++) {
          const [a, b] = segments[i],
            [c, d] = segments[j],
            u = [b[0] - a[0], b[1] - a[1]],
            v = [d[0] - c[0], d[1] - c[1]],
            den = u[0] * v[1] - u[1] * v[0];
          if (Math.abs(den) < 1e-8) continue;
          const t = ((c[0] - a[0]) * v[1] - (c[1] - a[1]) * v[0]) / den,
            q = ((c[0] - a[0]) * u[1] - (c[1] - a[1]) * u[0]) / den;
          if (t >= 0 && t <= 1 && q >= 0 && q <= 1)
            candidates.push([a[0] + t * u[0], a[1] + t * u[1]]);
        }
    if (this.$('snap').checked)
      for (const a of candidates) {
        const d = Math.hypot(a[0] - p[0], a[1] - p[1]);
        if (d < dist) {
          dist = d;
          best = a;
        }
      }
    this.snapPoint = best;
    if (best) return [...best];
    const a = this.draft.at(-1);
    if (a && this.mode !== 'rect') {
      const delta = [p[0] - a[0], p[1] - a[1]],
        angle = Math.atan2(delta[1], delta[0]),
        step = ((this.$('ortho').checked ? 90 : +this.$('polar').value) * Math.PI) / 180;
      if (step) {
        const snapped = Math.round(angle / step) * step,
          d = Math.hypot(...delta);
        if (this.$('ortho').checked || Math.abs(Math.sin(angle - snapped)) * d * this.scale < 10)
          return [a[0] + Math.cos(snapped) * d, a[1] + Math.sin(snapped) * d];
      }
    }
    return p.map((v) => Math.round(v * 1000) / 1000);
  }
  down(e) {
    if (e.button === 1 || e.button === 2) {
      this.drag = { pan: true, p: this.local(e), center: [...this.center] };
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const loc = this.local(e),
      hit = this.dimensionHits?.find(
        (h) => loc[0] >= h.x && loc[0] <= h.x + h.w && loc[1] >= h.y && loc[1] <= h.y + 22,
      );
    if (hit) {
      e.preventDefault();
      const input = this.$('dimension-' + hit.key);
      input.scrollIntoView({ block: 'nearest' });
      input.focus();
      input.select();
      return;
    }
    this.canvas.focus();
    const p = this.snap(this.world(this.local(e)));
    if (this.mode === 'select') {
      const vertices = this.vertices(),
        points = this.evaluatedPoints().flat();
      let found = -1,
        d = 10 / this.scale;
      points.forEach((v, i) => {
        const dist = Math.hypot(v[0] - p[0], v[1] - p[1]);
        if (dist < d) {
          d = dist;
          found = i;
        }
      });
      if (found >= 0) {
        const id = vertices[found].id;
        if (e.shiftKey) {
          this.selected = this.selected.includes(id)
            ? this.selected.filter((x) => x !== id)
            : [...this.selected, id];
        } else if (!this.selected.includes(id)) this.selected = [id];
        this.drag = { move: true, p, offset: [0, 0] };
      } else {
        this.drag = { box: true, p: this.local(e), end: this.local(e), add: e.shiftKey };
      }
      this.canvas.setPointerCapture(e.pointerId);
      this.sync(false);
      return;
    }
    this.run(() => this.add(p));
  }
  move(e) {
    const local = this.local(e);
    if (this.drag?.pan) {
      this.center = [
        this.drag.center[0] - (local[0] - this.drag.p[0]) / this.scale,
        this.drag.center[1] + (local[1] - this.drag.p[1]) / this.scale,
      ];
      this.draw();
      return;
    }
    this.pointer = this.snap(this.world(local));
    if (this.drag?.box) this.drag.end = local;
    if (this.drag?.move) this.drag.offset = this.pointer.map((v, i) => v - this.drag.p[i]);
    this.$('coordinates').textContent =
      `${this.fmt(this.pointer[0])}, ${this.fmt(this.pointer[1])} mm`;
    this.draw();
  }
  up(e) {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (drag.move && Math.hypot(...drag.offset) * this.scale > 3) {
      this.checkpoint();
      this.clearCatalog();
      delete this.def.template;
      delete this.def.roundedRoots;
      delete this.def.radiusParameters;
      delete this.def.radiusSegmentAngle;
      delete this.def.flangeSlope;
      delete this.def.flangeThicknessReference;
      this.run(() =>
        this.vertices()
          .filter((v) => this.selected.includes(v.id))
          .forEach((v) => {
            v.x = expression(v.x, this.resolve.bind(this)) + drag.offset[0];
            v.y = expression(v.y, this.resolve.bind(this)) + drag.offset[1];
          }),
      );
    }
    if (drag.box) {
      const ids = [];
      this.evaluatedPoints()
        .flat()
        .forEach((v, i) => {
          const p = this.screen(v);
          if (
            p[0] >= Math.min(drag.p[0], drag.end[0]) &&
            p[0] <= Math.max(drag.p[0], drag.end[0]) &&
            p[1] >= Math.min(drag.p[1], drag.end[1]) &&
            p[1] <= Math.max(drag.p[1], drag.end[1])
          )
            ids.push(this.vertices()[i].id);
        });
      this.selected = drag.add ? [...new Set([...this.selected, ...ids])] : ids;
    }
    this.sync(false);
  }
  add(p) {
    if (p.some((v) => !Number.isFinite(v) || Math.abs(v) > 10000))
      throw new Error('Koordinater måste ligga inom ±10 000 mm.');
    if (this.mode === 'anchor') {
      this.checkpoint();
      this.def.anchor = p;
      return;
    }
    if (this.mode === 'select') throw new Error('Välj ett ritverktyg först.');
    if (this.def.loops.length && this.mode !== 'hole')
      throw new Error('Ytterkonturen finns redan. Välj Hål eller Ny.');
    if (
      this.draft.length >= 3 &&
      Math.hypot(p[0] - this.draft[0][0], p[1] - this.draft[0][1]) * this.scale < 10
    ) {
      this.finish();
      return;
    }
    this.checkpoint();
    if (this.mode === 'rect' && this.draft.length) {
      const a = this.draft[0];
      this.draft = [a, [p[0], a[1]], p, [a[0], p[1]]];
      this.finish(false);
    } else this.draft.push(p);
  }
  finish(record = true) {
    if (this.draft.length < 3) throw new Error('Minst tre punkter behövs.');
    const candidate = clone(this.def);
    candidate.loops.push({ id: uid(), vertices: this.draft.map((p) => point(...p)) });
    evaluateSection(candidate);
    if (record) this.checkpoint();
    this.def = candidate;
    this.clearCatalog();
    this.draft = [];
    this.mode = 'select';
  }
  action(action) {
    this.run(() => {
      if (action === 'collapse-tree' || action === 'expand-tree') {
        this.$('search').value = '';
        this.list();
        this.$('list')
          .querySelectorAll('details')
          .forEach((d) => {
            d.open = action === 'expand-tree';
          });
        return;
      }
      if (action === 'close') {
        this.dialog.close();
        return;
      }
      if (action === 'new' || action === 'variant') {
        this.checkpoint();
        if (action === 'new') this.def = blank();
        else {
          this.def = clone(this.def);
          this.def.id = null;
          this.def.revision = 0;
          this.def.name += ' – variant';
        }
        this.draft = [];
        this.selected = [];
        this.mode = 'poly';
        this.sync();
        return;
      }
      if (action === 'undo' || action === 'redo') {
        const from = action === 'undo' ? this.undo : this.redo,
          to = action === 'undo' ? this.redo : this.undo;
        if (from.length) {
          to.push(clone({ def: this.def, draft: this.draft, mode: this.mode }));
          Object.assign(this, from.pop());
          this.selected = [];
          this.sync();
        }
        return;
      }
      if (action === 'fit') {
        this.fit();
        return;
      }
      if (action === 'finish') {
        this.finish();
        return;
      }
      if (action === 'length') {
        if (!this.draft.length || !this.direction)
          throw new Error('Peka ut en riktning från senaste punkten innan du anger längd.');
        const n = expression(this.$('length').value, this.resolve.bind(this));
        if (n < 1) throw new Error('Längden måste vara minst 1 mm.');
        this.add(this.draft.at(-1).map((v, i) => v + this.direction[i] * n));
        this.$('length').value = '';
        this.canvas.focus();
        return;
      }
      if (action === 'point') {
        const v = this.vertices().find(
          (v) => this.selected.length === 1 && this.selected.includes(v.id),
        );
        if (v) {
          this.checkpoint();
          this.clearCatalog();
          delete this.def.template;
          delete this.def.roundedRoots;
          delete this.def.radiusParameters;
          delete this.def.radiusSegmentAngle;
          delete this.def.flangeSlope;
          delete this.def.flangeThicknessReference;
          v.x = this.$('point-x').value;
          v.y = this.$('point-y').value;
        }
        return;
      }
      if (action === 'anchor') {
        this.checkpoint();
        this.def.anchor = [this.$('anchor-x').value, this.$('anchor-y').value];
        return;
      }
      if (action === 'delete') {
        this.checkpoint();
        this.clearCatalog();
        delete this.def.template;
        delete this.def.roundedRoots;
        delete this.def.radiusParameters;
        delete this.def.radiusSegmentAngle;
        delete this.def.flangeSlope;
        delete this.def.flangeThicknessReference;
        if (this.draft.length) this.draft.pop();
        else {
          if (this.def.loops[0]?.vertices.every((v) => this.selected.includes(v.id)))
            this.def.loops = [];
          this.def.loops = this.def.loops
            .map((l) => ({
              ...l,
              vertices: l.vertices.filter((v) => !this.selected.includes(v.id)),
            }))
            .filter((l) => l.vertices.length);
          this.selected = [];
        }
        return;
      }
      if (action === 'i-template') {
        this.$('profileType').value = 'i';
        this.changeType();
        return;
      }
      if (action.endsWith('-template')) {
        this.checkpoint();
        this.def = blank();
        this.def.profileType = 'rect';
        this.def.parameters = [
          { name: 'B', value: 200 },
          { name: 'H', value: 300 },
        ];
        let vertices = [
          ['-B/2', '-H/2'],
          ['B/2', '-H/2'],
          ['B/2', 'H/2'],
          ['-B/2', 'H/2'],
        ];
        if (action === 'i-template') {
          this.def.name = 'Egen I-profil';
          this.def.profileType = 'h';
          this.def.parameters.push({ name: 'tw', value: 8 }, { name: 'tf', value: 12 });
          vertices = [
            ['-B/2', '-H/2'],
            ['B/2', '-H/2'],
            ['B/2', '-H/2+tf'],
            ['tw/2', '-H/2+tf'],
            ['tw/2', 'H/2-tf'],
            ['B/2', 'H/2-tf'],
            ['B/2', 'H/2'],
            ['-B/2', 'H/2'],
            ['-B/2', 'H/2-tf'],
            ['-tw/2', 'H/2-tf'],
            ['-tw/2', '-H/2+tf'],
            ['-B/2', '-H/2+tf'],
          ];
        }
        this.def.loops = [{ id: uid(), vertices: vertices.map((p) => point(...p)) }];
        this.draft = [];
        this.selected = [];
        this.mode = 'select';
        this.sync();
        this.fit();
        return;
      }
      if (action === 'save' || action === 'use') {
        if (this.draft.length) throw new Error('Slut konturen först.');
        evaluateSection(this.def);
        let saved = this.profiles.find(
          (p) =>
            p.id === this.def.id &&
            p.revision === this.def.revision &&
            JSON.stringify(p) === JSON.stringify(this.def),
        );
        if (!saved) {
          saved = clone(this.def);
          if (isBuiltinProfile(saved)) saved.id = uid();
          saved.id ||= uid();
          saved.revision =
            Math.max(0, ...this.profiles.filter((p) => p.id === saved.id).map((p) => p.revision)) +
            1;
          const next = mergeLibrary(this.profiles, [saved]);
          localStorage.setItem(
            LIBRARY_KEY,
            JSON.stringify({ schema: 1, profiles: personalProfiles(next) }),
          );
          this.profiles = next;
          this.def = clone(saved);
        }
        if (action === 'use') {
          this.onUse(profileSnapshot(saved));
          this.dialog.close();
        }
        this.sync();
        return;
      }
      if (action === 'export') {
        const blob = new Blob([JSON.stringify({ schema: 1, profiles: this.profiles }, null, 2)], {
            type: 'application/json',
          }),
          url = URL.createObjectURL(blob),
          a = document.createElement('a');
        a.href = url;
        a.download = 'tvarsnittsbibliotek.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      if (action === 'import') this.$('import').click();
    });
  }
  async importFile() {
    const file = this.$('import').files[0];
    if (!file) return;
    try {
      if (file.size > 5e6) throw new Error('Filen får vara högst 5 MB.');
      const incoming = validateLibrary(JSON.parse(await file.text())),
        next = mergeLibrary(this.profiles, incoming);
      localStorage.setItem(
        LIBRARY_KEY,
        JSON.stringify({ schema: 1, profiles: personalProfiles(next) }),
      );
      this.profiles = next;
      this.error = '';
    } catch (e) {
      this.error = e.message;
    }
    this.$('import').value = '';
    this.sync(false);
  }
  draw() {
    if (!this.ctx || !this.width) return;
    const c = this.ctx,
      w = this.width,
      h = this.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#f1f5f6';
    c.fillRect(0, 0, w, h);
    const target = 45 / this.scale,
      base = 10 ** Math.floor(Math.log10(target)),
      step = [1, 2, 5, 10].map((v) => v * base).find((v) => v >= target) || base * 10;
    const low = this.world([0, h]),
      high = this.world([w, 0]);
    c.lineWidth = 1;
    c.strokeStyle = '#dfe7e9';
    c.beginPath();
    for (let x = Math.ceil(low[0] / step) * step; x <= high[0]; x += step) {
      const p = this.screen([x, 0]);
      c.moveTo(p[0], 0);
      c.lineTo(p[0], h);
    }
    for (let y = Math.ceil(low[1] / step) * step; y <= high[1]; y += step) {
      const p = this.screen([0, y]);
      c.moveTo(0, p[1]);
      c.lineTo(w, p[1]);
    }
    c.stroke();
    const zero = this.screen([0, 0]);
    c.strokeStyle = '#a7babd';
    c.beginPath();
    c.moveTo(zero[0], 0);
    c.lineTo(zero[0], h);
    c.moveTo(0, zero[1]);
    c.lineTo(w, zero[1]);
    c.stroke();
    const loops = this.evaluatedPoints(),
      vertices = this.vertices();
    let offset = 0;
    c.beginPath();
    loops.forEach((loop) => {
      loop.forEach((p, i) => {
        const v = vertices[offset + i],
          q =
            this.drag?.move && this.selected.includes(v?.id)
              ? p.map((x, j) => x + this.drag.offset[j])
              : p,
          [x, y] = this.screen(q);
        if (!i) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.closePath();
      offset += loop.length;
    });
    c.fillStyle = '#509b8338';
    c.fill('evenodd');
    c.strokeStyle = '#28765f';
    c.lineWidth = 1.7;
    c.stroke();
    offset = 0;
    loops.forEach((loop) =>
      loop.forEach((p) => {
        const v = vertices[offset++],
          selected = this.selected.includes(v.id),
          linked = this.linkedPoints?.has(v.id),
          q = this.drag?.move && selected ? p.map((x, j) => x + this.drag.offset[j]) : p,
          [x, y] = this.screen(q);
        c.fillStyle = selected ? '#ef9144' : linked ? '#a3d9c5' : '#fff';
        c.strokeStyle = '#28765f';
        c.fillRect(x - 3, y - 3, 6, 6);
        c.strokeRect(x - 3, y - 3, 6, 6);
        if (selected || linked) {
          const label = 'P' + offset;
          c.font = 'bold 11px system-ui';
          c.lineWidth = 4;
          c.strokeStyle = '#f1f5f6';
          const labelX = x >= w / 2 ? x + 9 : x - 9 - c.measureText(label).width;
          c.strokeText(label, labelX, y - 8);
          c.fillStyle = selected ? '#a55214' : '#22664f';
          c.fillText(label, labelX, y - 8);
          c.lineWidth = 1.7;
          c.strokeStyle = '#28765f';
        }
      }),
    );
    if (this.draft.length) {
      c.beginPath();
      let pts = [...this.draft];
      if (this.pointer) {
        if (this.mode === 'rect') {
          const a = pts[0],
            b = this.pointer;
          pts = [a, [b[0], a[1]], b, [a[0], b[1]], a];
        } else pts.push(this.pointer);
      }
      pts.forEach((p, i) => {
        const [x, y] = this.screen(p);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      });
      c.strokeStyle = '#18775d';
      c.stroke();
    }
    this.dimensionHits = [];
    if (this.def.template && this.evaluated) {
      const b = this.evaluated.properties.bounds,
        lo = this.screen([b.minX, b.minY]),
        hi = this.screen([b.maxX, b.maxY]);
      c.strokeStyle = '#728b92';
      c.fillStyle = '#45626a';
      c.lineWidth = 1;
      c.font = '11px system-ui';
      const label = (key, x, y) => {
        const text = key + ' = ' + this.fmt(this.evaluated.parameters[key]),
          width = c.measureText(text).width + 12;
        x = Math.max(3, Math.min(w - width - 3, x));
        y = Math.max(3, Math.min(h - 25, y));
        c.fillStyle = '#ffffffed';
        c.fillRect(x, y, width, 22);
        c.strokeStyle = '#b8cbc8';
        c.strokeRect(x, y, width, 22);
        c.fillStyle = '#28634f';
        c.fillText(text, x + 6, y + 15);
        this.dimensionHits.push({ key, x, y, w: width });
      };
      const y = Math.min(h - 35, lo[1] + 27),
        x = Math.max(18, lo[0] - 30);
      c.beginPath();
      c.moveTo(lo[0], lo[1] + 8);
      c.lineTo(lo[0], y + 6);
      c.moveTo(hi[0], lo[1] + 8);
      c.lineTo(hi[0], y + 6);
      c.moveTo(lo[0], y);
      c.lineTo(hi[0], y);
      c.moveTo(lo[0] - 8, hi[1]);
      c.lineTo(x - 6, hi[1]);
      c.moveTo(lo[0] - 8, lo[1]);
      c.lineTo(x - 6, lo[1]);
      c.moveTo(x, hi[1]);
      c.lineTo(x, lo[1]);
      c.stroke();
      label(
        this.evaluated.parameters.D !== undefined ? 'D' : 'B',
        (lo[0] + hi[0]) / 2 - 30,
        y - 11,
      );
      if (this.evaluated.parameters.H !== undefined) label('H', x - 30, (lo[1] + hi[1]) / 2 - 11);
      (TEMPLATE_KEYS[this.def.template] || [])
        .filter((k) => !['B', 'H', 'D'].includes(k))
        .forEach((key, i) => label(key, hi[0] + 18, hi[1] + i * 29));
    }
    const anchor = this.evaluated?.anchor;
    if (anchor) {
      const [x, y] = this.screen(anchor);
      c.strokeStyle = '#df883e';
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.moveTo(x - 10, y);
      c.lineTo(x + 10, y);
      c.moveTo(x, y - 10);
      c.lineTo(x, y + 10);
      c.stroke();
    }
    if (this.snapPoint) {
      const [x, y] = this.screen(this.snapPoint);
      c.strokeStyle = '#15986b';
      c.strokeRect(x - 5, y - 5, 10, 10);
    }
    if (this.drag?.box) {
      const { p, end } = this.drag;
      c.fillStyle = '#377cc11a';
      c.strokeStyle = '#377cc1';
      c.fillRect(p[0], p[1], end[0] - p[0], end[1] - p[1]);
      c.strokeRect(p[0], p[1], end[0] - p[0], end[1] - p[1]);
    }
    c.fillStyle = '#748d94';
    c.font = '11px system-ui';
    c.fillText(`Rutsteg ${this.fmt(step)} mm`, 12, h - 12);
  }
}
