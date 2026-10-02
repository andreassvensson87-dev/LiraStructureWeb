import { SearchPicker } from './search-picker.js';
import { ColorLibrary } from './color-library.js';
import {
  MATERIAL_TYPES,
  MATERIAL_KEY,
  validateMaterial,
  validateMaterialLibrary,
  mergeMaterials,
  latestMaterials,
  objectColor,
} from './materials.js';
const options = (select) =>
  MATERIAL_TYPES.forEach(([id, name]) => select.append(new Option(name, id)));
export class MaterialUI {
  constructor(root, { apply }) {
    this.root = root;
    this.apply = apply;
    this.records = [];
    this.loadError = '';
    try {
      const raw = localStorage.getItem(MATERIAL_KEY);
      if (raw) this.records = validateMaterialLibrary(JSON.parse(raw));
    } catch (e) {
      this.loadError = e.message;
    }
    root.innerHTML =
      '<div class="material-quick-row"><div class="material-search"></div><button type="button" id="object-color-toggle" aria-label="Välj objektfärg" aria-expanded="false"><i></i></button><button type="button" id="material-library-open" aria-label="Öppna materialbibliotek" title="Materialbibliotek">↗</button></div><div class="object-palette" hidden><button type="button" id="object-color-auto">Materialets färg</button><div class="color-swatches"></div><button type="button" id="color-library-open">Redigera färgbibliotek ↗</button></div><p id="object-material-error" role="alert"></p>';
    this.error = root.querySelector('#object-material-error');
    this.picker = new SearchPicker(root.querySelector('.material-search'), {
      label: 'Sök material',
      placeholder: 'Sök material…',
      onSelect: (m) => this.run(() => this.apply({ material: m ? structuredClone(m) : null })),
    });
    this.palette = root.querySelector('.object-palette');
    this.colorToggle = root.querySelector('#object-color-toggle');
    this.colors = new ColorLibrary(() => this.renderColors());
    this.colorToggle.onclick = () => {
      this.palette.hidden = !this.palette.hidden;
      this.colorToggle.setAttribute('aria-expanded', String(!this.palette.hidden));
    };
    root.querySelector('#object-color-auto').onclick = () => this.setColor(null);
    root.querySelector('#color-library-open').onclick = () => this.colors.open();
    root.addEventListener('input', (e) => e.stopPropagation());
    root.addEventListener('change', (e) => e.stopPropagation());
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'material-library';
    this.dialog.innerHTML =
      '<header><strong>Materialbibliotek</strong><button type="button" id="material-close" aria-label="Stäng materialbibliotek">×</button></header><div class="material-layout"><nav aria-label="Materialkategorier"><div id="material-tree"></div><button type="button" id="material-new">Nytt material</button></nav><form id="material-edit"><label class="field">Materialtyp<select id="material-category"></select></label><label class="field">Namn<input id="material-name" maxlength="120" required></label><label class="field">Densitet · kg/m³<input id="material-density" type="number" min="0.001" max="100000" step="any" required></label><label class="field">Standardfärg<input id="material-color" type="color" value="#688391"></label><p id="material-version" class="inspector-note"></p><button type="submit" class="primary">Spara material</button></form></div><p id="material-error" role="alert"></p><footer><button type="button" id="material-export">Exportera</button><button type="button" id="material-import-open">Importera</button><input type="file" id="material-import" accept=".json,application/json" hidden></footer><p class="inspector-note">Sparas i denna webbläsare. Exportera för säkerhetskopia. Befintliga objekt behåller sin materialversion.</p>';
    document.body.append(this.dialog);
    this.$ = (id) => this.dialog.querySelector('#material-' + id);
    options(this.$('category'));
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    this.$('close').onclick = () => this.dialog.close();
    root.querySelector('#material-library-open').onclick = () => this.openLibrary();
    this.dialog.addEventListener('close', () => this.refresh());
    this.$('new').onclick = () => this.edit(null);
    this.$('edit').onsubmit = (e) => {
      e.preventDefault();
      try {
        const m = {
          id: this.editing?.id || crypto.randomUUID(),
          revision:
            1 +
            Math.max(
              0,
              ...this.records.filter((m) => m.id === this.editing?.id).map((m) => m.revision),
            ),
          category: this.$('category').value,
          name: this.$('name').value.trim(),
          density: Number(this.$('density').value),
          color: this.$('color').value,
        };
        validateMaterial(m);
        this.persist(mergeMaterials(this.records, [m]));
        this.edit(m);
        this.tree();
        this.$('error').textContent = 'Material sparat.';
      } catch (e) {
        this.$('error').textContent = e.message;
      }
    };
    this.$('export').onclick = () => {
      const url = URL.createObjectURL(
          new Blob([JSON.stringify({ schema: 1, materials: this.records }, null, 2)], {
            type: 'application/json',
          }),
        ),
        a = document.createElement('a');
      a.href = url;
      a.download = 'materialbibliotek.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    this.$('import-open').onclick = () => this.$('import').click();
    this.$('import').onchange = async () => {
      const file = this.$('import').files[0];
      if (!file) return;
      try {
        if (file.size > 5e6) throw new Error('Filen får vara högst 5 MB.');
        const data = validateMaterialLibrary(JSON.parse(await file.text()));
        this.persist(mergeMaterials(this.records, data));
        this.tree();
        this.$('error').textContent = 'Biblioteket importerat.';
      } catch (e) {
        this.$('error').textContent = e.message;
      }
      this.$('import').value = '';
    };
    this.edit(null);
  }
  openLibrary() {
    this.tree();
    this.$('error').textContent = this.loadError;
    this.dialog.showModal();
  }
  persist(records) {
    localStorage.setItem(MATERIAL_KEY, JSON.stringify({ schema: 1, materials: records }));
    this.records = records;
    this.loadError = '';
  }
  run(fn) {
    try {
      fn();
      this.error.textContent = '';
    } catch (e) {
      this.error.textContent = e.message;
    }
  }
  edit(m) {
    this.editing = m;
    this.$('category').value = m?.category || this.sources?.[0]?.material?.category || 'steel';
    this.$('name').value = m?.name || '';
    this.$('density').value = m?.density ?? '';
    this.$('color').value = m?.color || '#688391';
    this.$('version').textContent = m
      ? `Version ${m.revision} · Spara skapar en ny version`
      : 'Nytt material · ange egna materialdata';
  }
  tree() {
    const tree = this.$('tree');
    tree.replaceChildren();
    for (const [id, name] of MATERIAL_TYPES) {
      const group = document.createElement('details');
      group.open = true;
      const title = document.createElement('summary');
      title.textContent = name;
      group.append(title);
      for (const m of latestMaterials(this.records).filter((m) => m.category === id)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = m.name;
        button.onclick = () => this.edit(m);
        group.append(button);
      }
      tree.append(group);
    }
  }
  sync(sources, visible, disabled = false) {
    this.sources = sources;
    this.root.hidden = !visible;
    this.root.inert = disabled;
    if (visible) this.refresh();
  }
  renderColors() {
    const list = this.root.querySelector('.color-swatches');
    list.replaceChildren();
    for (const c of this.colors.colors) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = c.color;
      b.title = c.name;
      b.setAttribute('aria-label', c.name);
      b.setAttribute(
        'aria-pressed',
        String(this.sources?.every((s) => objectColor(s).toLowerCase() === c.color.toLowerCase())),
      );
      b.onclick = () => this.setColor(c.color);
      list.append(b);
    }
  }
  setColor(color) {
    this.run(() => this.apply({ colorOverride: color }));
    this.palette.hidden = true;
    this.colorToggle.setAttribute('aria-expanded', 'false');
  }
  refresh() {
    const sources = this.sources || [],
      first = sources[0],
      same = sources.every(
        (s) => JSON.stringify(s.material ?? null) === JSON.stringify(first?.material ?? null),
      );
    const choices = latestMaterials(this.records);
    if (
      same &&
      first?.material &&
      !choices.some((m) => m.id === first.material.id && m.revision === first.material.revision)
    )
      choices.push(first.material);
    this.picker.set(
      [
        { label: 'Inget material', value: null },
        ...choices.map((m) => ({
          label: m.name,
          detail: `${MATERIAL_TYPES.find(([id]) => id === m.category)?.[1]} · v${m.revision}`,
          value: m,
        })),
      ],
      same ? first?.material?.name || '' : 'Blandade material',
    );
    const mixed = sources.some((s) => objectColor(s) !== objectColor(first));
    this.colorToggle.querySelector('i').style.background = mixed
      ? 'linear-gradient(135deg,#688391 50%,#e3c957 50%)'
      : first
        ? objectColor(first)
        : '#688391';
    this.colorToggle.title = mixed
      ? 'Blandade färger'
      : first?.colorOverride
        ? 'Objektfärg'
        : 'Materialets färg';
    this.renderColors();
  }
}
