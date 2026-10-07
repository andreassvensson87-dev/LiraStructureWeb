import {
  MODEL_FILTER_KEY,
  emptyModelFilter,
  normalizeModelFilter,
  modelFilterGroups,
  modelFilterRecord,
  matchesModelFilter,
  modelFilterFacets,
} from './model-filter.js';
import './model-filter.css';
export class ModelFilter {
  constructor({ inspector, change, showAll, selectMatches, getViewIds, baseVisible }) {
    Object.assign(this, { inspector, change, showAll, selectMatches, getViewIds, baseVisible });
    this.filter = emptyModelFilter();
    this.matches = new Set();
    this.groups = new Map();
    this.saved = [];
    try {
      const saved = JSON.parse(localStorage.getItem(MODEL_FILTER_KEY) || '[]');
      if (Array.isArray(saved))
        this.saved = saved
          .filter((s) => typeof s.id === 'string' && typeof s.name === 'string')
          .map((s) => ({ ...s, filter: normalizeModelFilter(s.filter) }));
    } catch {
      /* A damaged preset library must not prevent modelling. */
    }
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = 'filter-tab';
    tab.dataset.inspectorTab = 'filter';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'inspector-filter');
    tab.setAttribute('aria-selected', 'false');
    tab.textContent = 'Filter';
    document.querySelector('.inspector-tabs').append(tab);
    tab.onclick = () => {
      inspector.finish();
      inspector.show('filter');
    };
    this.panel = document.createElement('section');
    this.panel.id = 'inspector-filter';
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'tabpanel');
    this.panel.setAttribute('aria-labelledby', 'filter-tab');
    document.getElementById('inspector-model').after(this.panel);
    this.panel.innerHTML = `<h2>Modellfilter</h2><div class="mf-presets"><select aria-label="Sparade modellfilter"></select><button type="button" data-save aria-label="Spara modellfilter" title="Spara filter">▣</button><button type="button" data-remove aria-label="Ta bort sparat modellfilter" title="Ta bort sparat filter">×</button></div><form class="mf-save" hidden><label>Filternamn<input maxlength="80" required aria-label="Filternamn"></label><div><button class="primary">Spara filter</button><button type="button" data-cancel>Avbryt</button></div></form><input type="search" data-query aria-label="Sök i modellen" placeholder="Sök namn, beteckning eller profil…"><div class="mf-chips" aria-label="Aktiva modellfilter"></div><p class="mf-count" role="status" aria-live="polite"></p><label class="mf-check"><input type="checkbox" data-view>Endast i aktuell vy</label><div class="mf-groups"></div><p class="mf-note">Flera val i en grupp = eller · mellan grupper = och.</p><p class="mf-error" role="alert"></p><div class="mf-footer"><small>Filter tillämpas direkt</small><div><button type="button" data-reset>Visa alla</button><button type="button" class="primary" data-select>Markera träffar</button></div></div>`;
    this.$ = (s) => this.panel.querySelector(s);
    for (const [key, label] of modelFilterGroups) {
      const group = document.createElement('details');
      group.open = ['material', 'level', 'prefix'].includes(key);
      group.innerHTML =
        '<summary><span></span><small></small></summary><input type="search"><div class="mf-options"></div>';
      group.querySelector('span').textContent = label;
      const search = group.querySelector('input');
      search.placeholder = `Sök ${label.toLocaleLowerCase('sv')}…`;
      search.setAttribute('aria-label', `Sök filterval · ${label}`);
      search.oninput = () => this.paintOptions(key);
      if (key === 'level') {
        group.title = 'Närmaste nivå till objektets lägsta insättningspunkt.';
        const note = document.createElement('p');
        note.className = 'mf-note';
        note.textContent = 'Närmaste nivå till lägsta insättningspunkten.';
        group.append(note);
      }
      this.$('.mf-groups').append(group);
      this.groups.set(key, group);
    }
    const more = document.createElement('details');
    more.className = 'mf-more';
    const heading = document.createElement('summary');
    heading.textContent = 'Fler egenskaper';
    more.append(heading, this.groups.get('prefix'));
    this.$('.mf-groups').append(more);
    this.$('[data-query]').oninput = (event) => {
      this.filter.query = event.target.value;
      this.apply();
    };
    this.$('[data-view]').onchange = (event) => {
      this.filter.inView = event.target.checked;
      this.apply();
    };
    this.$('select').onchange = (event) => {
      const preset = this.saved.find((s) => s.id === event.target.value);
      if (preset) {
        this.filter = normalizeModelFilter(preset.filter);
        this.inputs();
        this.apply(false);
      }
    };
    this.$('[data-reset]').onclick = () => {
      this.reset();
      showAll();
    };
    this.$('[data-select]').onclick = () => selectMatches([...this.matches].filter(baseVisible));
    this.$('[data-save]').onclick = () => {
      this.$('form').hidden = false;
      this.$('form input').value =
        this.saved.find((s) => s.id === this.$('select').value)?.name || '';
      this.$('form input').focus();
    };
    this.$('[data-cancel]').onclick = () => (this.$('form').hidden = true);
    this.$('form').onsubmit = (event) => {
      event.preventDefault();
      const name = this.$('form input').value.trim();
      if (!name) return;
      const existing =
        this.saved.find((s) => s.id === this.$('select').value) ||
        this.saved.find((s) => s.name === name);
      const preset = {
        id: existing?.id || crypto.randomUUID(),
        name,
        filter: normalizeModelFilter(this.filter),
      };
      this.persist([...this.saved.filter((s) => s.id !== preset.id), preset], preset.id);
    };
    this.$('[data-remove]').onclick = () =>
      this.persist(this.saved.filter((s) => s.id !== this.$('select').value));
    this.$('[data-view]').title =
      'Visa modellobjekt som skär kamerans synfält. Uppdateras när du zoomar eller flyttar vyn.';
    this.presets();
  }
  persist(saved, selected = '') {
    try {
      localStorage.setItem(MODEL_FILTER_KEY, JSON.stringify(saved));
      this.saved = saved;
      this.presets(selected);
      this.$('form').hidden = true;
      this.$('.mf-error').textContent = '';
    } catch {
      this.$('.mf-error').textContent = 'Kunde inte spara filterbiblioteket.';
    }
  }
  presets(selected = '') {
    this.$('select').replaceChildren(
      new Option('Eget filter', ''),
      ...this.saved.map((s) => new Option(s.name, s.id)),
    );
    this.$('select').value = selected;
    this.$('[data-remove]').disabled = !selected;
  }
  inputs() {
    this.$('[data-query]').value = this.filter.query;
    this.$('[data-view]').checked = this.filter.inView;
  }
  reset() {
    this.filter = emptyModelFilter();
    this.signature = null;
    this.presets();
    this.inputs();
    for (const group of this.groups.values()) group.querySelector('input').value = '';
  }
  apply(custom = true) {
    if (custom) {
      this.$('select').value = '';
      this.$('[data-remove]').disabled = true;
    } else this.$('[data-remove]').disabled = false;
    this.signature = null;
    this.change();
  }
  sync(project) {
    this.project = project;
    const records = project.objects.map((s) => modelFilterRecord(s, project.levels));
    const viewIds = this.filter.inView ? this.getViewIds() : null;
    const signature = JSON.stringify([records, this.filter, viewIds ? [...viewIds].sort() : null]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.records = records;
      this.matches = new Set(
        records.filter((r) => matchesModelFilter(r, this.filter, viewIds)).map((r) => r.id),
      );
      this.facets = modelFilterFacets(records, this.filter, viewIds);
      for (const [key] of modelFilterGroups) this.paintOptions(key);
      const chips = this.$('.mf-chips');
      chips.replaceChildren();
      for (const [key, label] of modelFilterGroups)
        for (const value of this.filter.values[key]) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.textContent = `${label}: ${value} ×`;
          chip.setAttribute('aria-label', `Ta bort filter ${label}: ${value}`);
          chip.onclick = () => {
            this.filter.values[key] = this.filter.values[key].filter((v) => v !== value);
            this.apply();
          };
          chips.append(chip);
        }
    }
    const visible = [...this.matches].filter(this.baseVisible).length;
    this.$('.mf-count').textContent =
      `${this.matches.size} ${this.matches.size === 1 ? 'träff' : 'träffar'} av ${records.length} objekt${visible !== this.matches.size ? ` · ${visible} visas` : ''}`;
    this.$('[data-select]').disabled = !visible;
  }
  paintOptions(key) {
    const group = this.groups.get(key),
      list = group.querySelector('.mf-options'),
      search = group.querySelector('input').value.toLocaleLowerCase('sv');
    group.querySelector('input').hidden = (this.facets?.[key]?.length || 0) <= 8 && !search;
    const active = this.filter.values[key];
    group.querySelector('small').textContent = active.length ? `${active.length} val` : 'Alla';
    list.replaceChildren();
    for (const [value, count] of this.facets?.[key] || []) {
      if (!value.toLocaleLowerCase('sv').includes(search)) continue;
      const label = document.createElement('label');
      label.className = 'mf-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = active.includes(value);
      input.setAttribute(
        'aria-label',
        `${modelFilterGroups.find(([k]) => k === key)[1]}: ${value}`,
      );
      input.onchange = () => {
        this.filter.values[key] = input.checked
          ? [...active, value]
          : active.filter((v) => v !== value);
        this.apply();
      };
      const text = document.createElement('span');
      text.textContent = value;
      const number = document.createElement('small');
      number.textContent = count;
      label.append(input, text, number);
      list.append(label);
    }
    if (!list.children.length) {
      const empty = document.createElement('p');
      empty.className = 'mf-note';
      empty.textContent = 'Inga filterval.';
      list.append(empty);
    }
  }
  allows(id) {
    return !this.project || this.matches.has(id);
  }
  get active() {
    return !!(
      this.filter.query.trim() ||
      this.filter.inView ||
      Object.values(this.filter.values).some((values) => values.length)
    );
  }
}
