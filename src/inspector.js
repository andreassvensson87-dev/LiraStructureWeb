import { objectType } from './model/object-types/index.js';
import { SelectionScope } from './inspector/selection-scope.js';
import { installSelectionDock } from './inspector/selection-dock.js';
import { FORM_OPTIONS, isRound, hasWall, normalizeForm } from './profile-forms.js';
import { adoptAttributeLabel } from './inspector/attributes.js';
// Inspector transactions keep the model unchanged until a field is confirmed.
export class Inspector {
  constructor({
    getState,
    preview,
    commit,
    cancel,
    fill,
    fillStandard,
    validate,
    remove,
    scopeChanged = () => {},
  }) {
    Object.assign(this, {
      getState,
      preview,
      commit,
      cancel,
      fill,
      fillStandard,
      validate,
      remove,
    });
    this.rawState = getState;
    this.scope = new SelectionScope();
    this.getState = () => {
      const state = this.rawState();
      return { ...state, selected: this.scope.sync(state.selected) };
    };
    this.scopeChanged = scopeChanged;
    this.session = null;
    this.signature = '';
    this.commonSignature = '';
    this.tab = 'model';
    this.busy = false;
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    $('inspector-properties').querySelectorAll('label.field').forEach(adoptAttributeLabel);
    this.dock = installSelectionDock(this);
    const note = document.createElement('p');
    note.id = 'inspector-scope-note';
    note.className = 'inspector-scope-note';
    note.hidden = true;
    $('inspector-properties').querySelector('.panel-title').after(note);
    const profile = document.createElement('div');
    profile.className = 'inspector-multi-profile';
    profile.hidden = true;
    profile.innerHTML = '<span></span><button type="button">Välj profil ur bibliotek…</button>';
    profile.querySelector('button').onclick = () => $('section-library-open').click();
    $('common-fields').before(profile);
    const actions = document.createElement('div');
    actions.className = 'inspector-scope-actions';
    actions.hidden = true;
    actions.innerHTML =
      '<button type="button">Återställ</button><button type="button" class="primary">Modifiera</button>';
    actions.querySelector('button').onclick = () => {
      this.rollback();
      this.sync();
      this.scopeChanged();
    };
    actions.querySelector('.primary').onclick = () => this.finish();
    $('multi-selection').append(actions);
    this.actions = actions;
    this.multiProfile = profile;

    document
      .querySelectorAll('[data-inspector-tab]')
      .forEach((button) => (button.onclick = () => this.show(button.dataset.inspectorTab)));
    $('inspector-properties').addEventListener('input', (e) => this.input(e));
    $('inspector-properties').addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT' && this.session && !this.multiEditing) this.finish();
    });
    $('inspector-properties').addEventListener('focusout', () => {
      if (this.session && !this.busy && !this.multiEditing) this.finish();
    });
    $('inspector-properties').addEventListener(
      'keydown',
      (e) => {
        if (!this.session) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          this.rollback();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          this.finish();
        }
      },
      true,
    );
    $('inspector-properties').addEventListener(
      'submit',
      (e) => {
        if (e.target.hasAttribute('data-independent-editor')) return;
        if (this.getState().selected.length && !this.getState().operation) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.finish();
        }
      },
      true,
    );
  }
  get multiEditing() {
    return this.rawState().selected.length > 1 && !this.rawState().operation;
  }
  get standardType() {
    const selected = this.getState().selected;
    const type = selected[0] && objectType(selected[0]).id;
    return selected.length &&
      selected.every((s) => objectType(s).id === type) &&
      ['sweep', 'plate'].includes(type)
      ? type
      : null;
  }
  fillStandardFields() {
    const selected = this.editingObjects(),
      type = this.standardType;
    if (!this.multiEditing || !type || !selected.length || !this.fillStandard) return;
    const active = this.session?.input;
    const value = active?.value;
    this.fillStandard(selected[0]);
    const fields =
      type === 'sweep'
        ? {
            profile: 'profile',
            width: 'width',
            height: 'height',
            thickness: 'thickness',
            rotation: 'rotation',
          }
        : {
            'plate-thickness': 'thickness',
            'plate-side': 'side',
            'plate-contour-offset': 'contourOffset',
          };
    for (const [id, key] of Object.entries(fields)) {
      const input = this.$(id);
      const values = selected.map((s) => s[key] ?? (key === 'contourOffset' ? 0 : undefined));
      const mixed = values.some((v) => v !== values[0]);
      if (input.tagName === 'SELECT' && !input.querySelector('[data-mixed]')) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Blandat';
        option.dataset.mixed = 'true';
        option.disabled = true;
        input.prepend(option);
      }
      input.value = mixed ? '' : values[0];
      input.placeholder = 'Blandat';
    }
    if (type === 'sweep') {
      this.$('profile-height-field').hidden = selected.every((s) => isRound(s.profile));
      this.$('thickness-field').hidden = !selected.some((s) => hasWall(s.profile));
      this.$('thickness').disabled = !selected.some((s) => hasWall(s.profile));
      this.$('width').disabled = this.$('height').disabled = selected.some(
        (s) => s.profile === 'custom',
      );
      const samePlacement = selected.every((s) =>
        ['horizontalAlignment', 'verticalAlignment'].every(
          (key) => (s.placement?.[key] ?? 'center') === (selected[0].placement?.[key] ?? 'center'),
        ),
      );
      if (!samePlacement) {
        document
          .querySelectorAll('[data-placement-h]')
          .forEach((b) => b.setAttribute('aria-pressed', 'false'));
        if (this.$('sweep-placement-summary'))
          this.$('sweep-placement-summary').textContent = 'Blandat';
      }
      const sameProfile = selected.every(
        (s) =>
          JSON.stringify([s.profile, s.width, s.height, s.thickness, s.section]) ===
          JSON.stringify([
            selected[0].profile,
            selected[0].width,
            selected[0].height,
            selected[0].thickness,
            selected[0].section,
          ]),
      );
      this.$('cross-section').toggleAttribute('hidden', !sameProfile);
      if (!sameProfile) {
        this.$('profile-dimensions').textContent = 'Blandade tvärsnitt';
        this.$('section-reference').textContent = 'Blandade profiler';
      }
      const lengths = selected.map((s) => Math.hypot(...s.end.map((v, i) => v - s.start[i])));
      if (lengths.some((v) => Math.abs(v - lengths[0]) > 1e-6))
        this.$('length').textContent = 'Blandat';
    } else {
      this.$('plate-stage').textContent = `${selected.length} plåtar markerade`;
      this.$('plate-plane-fields').hidden = true;
    }
    if (active) active.value = value;
  }
  editingObjects() {
    return this.session?.batch || this.getState().selected;
  }
  chooseScope(type) {
    this.rollback();
    this.scope.sync(this.rawState().selected);
    this.scope.choose(type, this.rawState().selected);
    this.signature = '';
    this.scopeChanged();
    this.show('properties');
  }
  stage(change) {
    const selected = this.getState().selected;
    if (!selected.length || this.rawState().operation) return;
    if (!this.session)
      this.session = {
        sources: structuredClone(selected),
        batch: structuredClone(selected),
        error: '',
        errors: new Map(),
      };
    const batch = (this.session.batch || this.session.sources).map((s) =>
      change(structuredClone(s)),
    );
    const error = batch.map(this.validate).find(Boolean);
    if (error) {
      this.$('inspector-error').textContent = error;
      return false;
    }
    try {
      this.preview(batch);
    } catch (error) {
      this.$('inspector-error').textContent = error.message;
      return false;
    }
    this.session.batch = batch;
    this.session.error = [...this.session.errors.values()][0] || '';
    this.$('inspector-error').textContent = this.session.error;
    this.sync();
    this.scopeChanged(true);
    return true;
  }
  show(tab) {
    this.tab = tab;
    this.$('inspector-properties').hidden = tab !== 'properties';
    this.$('inspector-model').hidden = tab !== 'model';
    const filter = this.$('inspector-filter');
    if (filter) filter.hidden = tab !== 'filter';
    const references = this.$('inspector-references');
    if (references) references.hidden = tab !== 'references';
    document
      .querySelectorAll('[data-inspector-tab]')
      .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.inspectorTab === tab)));
    this.dock.sync();
  }
  sync() {
    const { selected, drawing, operation } = this.getState(),
      $ = this.$;
    const signature =
      this.scope.type +
      ':' +
      selected.map((s) => s.id + ':' + (s.type || 'sweep') + ':' + (s.profile || '')).join('|');
    if (signature !== this.signature) {
      this.session = null;
      this.cancel();
      this.signature = signature;
    }
    const editing = this.editingObjects();
    const commonSignature = JSON.stringify([
      this.multiEditing,
      editing.map((s) => [s.id, objectType(s).id, s.profile]),
    ]);
    if (commonSignature !== this.commonSignature) {
      this.commonSignature = commonSignature;
      this.buildCommon(editing, this.multiEditing);
    }
    const has = selected.length > 0,
      creating = drawing && !has;
    $('model-empty').hidden = true;
    $('inspector-identity').hidden = selected.length !== 1;
    $('inspector-name').disabled = !!operation;
    if (selected.length === 1 && document.activeElement !== $('inspector-name'))
      $('inspector-name').value = selected[0].name;
    $('inspector-empty').hidden = has || creating;
    $('inspector-properties').querySelector('.panel-title').hidden = !has && !creating;
    if (!has && !creating) {
      $('form').hidden = true;
      $('plate-form').hidden = true;
      if (this.tab === 'properties') this.show('model');
    }
    $('apply').hidden = has;
    $('deselect').hidden = true;
    $('plate-new').hidden = true;
    $('plate-apply').hidden = has;
    $('common-fields').inert = !!operation;
    this.fillCommon(this.editingObjects());
    for (const key of ['width', 'height', 'thickness']) {
      const input = this.$('common-' + key);
      if (input) input.disabled = this.editingObjects().some((s) => s.profile === 'custom');
    }
    if (this.multiEditing) {
      const type = this.standardType;
      $('form').hidden = type !== 'sweep';
      $('plate-form').hidden = type !== 'plate';
      $('common-fields').hidden = !!type;
      if (type) $(type === 'sweep' ? 'form' : 'plate-form').after($('multi-selection'));
      else $('form').before($('multi-selection'));
      this.fillStandardFields();
      $('inspector-identity').hidden = true;
      $('identity-fields').hidden = true;
      $('multi-selection').hidden = false;
      const groups = this.scope.groups(selected);
      const label = groups.length === 1 ? groups[0].label : 'Objekt';
      $('object-heading').textContent = label;
      $('mode-label').textContent =
        `${selected.length} av ${this.rawState().selected.length} markerade`;
      $('multi-count').textContent =
        `${selected.length} ${label.toLowerCase()} · gemensamma egenskaper`;
      const note = $('inspector-scope-note');
      note.hidden = false;
      note.textContent = this.scope.type
        ? `Ändringar gäller ${selected.length} markerade ${label.toLowerCase()}.`
        : 'Ändringar gäller hela markeringen.';
      this.actions.hidden = false;
      this.actions.querySelector('.primary').textContent =
        `Modifiera ${selected.length} ${label.toLowerCase()}`;
      this.actions.querySelector('.primary').disabled =
        !this.session?.batch || !!this.session.error;
      this.actions.querySelector('button').disabled = !this.session;
      $('multi-delete').hidden = !!this.scope.type;
      const sweeps = selected.every((s) => objectType(s).inspector === 'sweep');
      this.multiProfile.hidden = !sweeps || !!type;
      this.multiProfile.querySelector('span').textContent = sweeps
        ? this.editingObjects().every(
            (s) => s.section?.name && s.section.name === this.editingObjects()[0].section?.name,
          )
          ? this.editingObjects()[0].section.name
          : 'Profil · Blandat / egen form'
        : '';
    } else {
      $('common-fields').hidden = false;
      $('cross-section').removeAttribute('hidden');
      $('inspector-scope-note').hidden = true;
      this.actions.hidden = this.multiProfile.hidden = true;
      $('multi-delete').hidden = false;
    }
    $('sweep-geometry').hidden = true;
    $('plate-geometry').hidden =
      !selected.some((s) => objectType(s).cut) && !operation?.cutTargets && !operation?.lineCut;
    this.show(this.tab);
  }
  buildCommon(selected, force = false) {
    const root = this.$('common-fields');
    root.replaceChildren();
    if (!selected.length || (selected.length < 2 && !force)) return;
    const plates = selected.every((s) => objectType(s).inspector === 'plate'),
      sweeps = selected.every((s) => objectType(s).inspector === 'sweep');
    const lines = selected.every((s) => objectType(s).inspector === 'linecut');
    const fields = lines
      ? [
          [
            'side',
            'Skärsida',
            [
              ['positive', 'Positiv sida'],
              ['negative', 'Negativ sida'],
            ],
          ],
        ]
      : plates
        ? [
            ['thickness', 'Tjocklek · mm'],
            ...(selected.every((s) => !objectType(s).cut)
              ? [['contourOffset', 'Konturförskjutning · mm']]
              : []),
            [
              'side',
              'Placering',
              [
                ['center', 'Centrerat'],
                ['positive', 'Positiv sida'],
                ['negative', 'Negativ sida'],
              ],
            ],
          ]
        : sweeps
          ? [
              [
                'profile',
                'Tvärsnitt',
                selected.some((s) => s.profile === 'custom')
                  ? [...FORM_OPTIONS, ['custom', 'Biblioteksprofil']]
                  : FORM_OPTIONS,
              ],
              ...(selected.every((s) => s.profile !== 'custom')
                ? [
                    [
                      'width',
                      selected.every((s) => isRound(s.profile))
                        ? 'Diameter · mm'
                        : 'Bredd / diameter · mm',
                    ],
                    ...(selected.every((s) => !isRound(s.profile))
                      ? [['height', 'Höjd · mm']]
                      : []),
                  ]
                : []),
              ...(selected.every((s) => hasWall(s.profile))
                ? [['thickness', 'Tjocklek · mm']]
                : []),
              ['rotation', 'Profilrotation · °'],
              [
                'horizontalAlignment',
                'Insättning horisontellt',
                [
                  ['left', 'Vänster'],
                  ['center', 'Centrum'],
                  ['right', 'Höger'],
                ],
              ],
              [
                'verticalAlignment',
                'Insättning vertikalt',
                [
                  ['bottom', 'Nere'],
                  ['center', 'Mitten'],
                  ['top', 'Uppe'],
                ],
              ],
            ]
          : selected.every(
                (s) =>
                  objectType(s).id === 'fastener' &&
                  s.spec?.kind === 'bolt' &&
                  s.accessories == null,
              )
            ? [['nutOffset', 'Mutterläge · mm']]
            : [];
    if (!fields.length) {
      const p = document.createElement('p');
      p.className = 'inspector-note';
      p.textContent = 'Välj en objekttyp med ikonerna för att visa dess egenskaper.';
      root.append(p);
    }
    for (const [key, title, options] of fields) {
      const label = document.createElement('label');
      label.className = 'field';
      label.textContent = title;
      const input = document.createElement(options ? 'select' : 'input');
      input.dataset.common = key;
      input.id = 'common-' + key;
      if (options) {
        for (const [value, text] of [['', 'Blandat'], ...options]) {
          const o = document.createElement('option');
          o.value = value;
          o.textContent = text;
          input.append(o);
        }
      } else {
        input.type = 'number';
        input.step = 'any';
        input.placeholder = 'Blandat';
      }
      label.append(input);
      adoptAttributeLabel(label);
      root.append(label);
    }
  }
  fillCommon(selected) {
    if (!selected.length) return;
    this.$('common-fields')
      .querySelectorAll('[data-common]')
      .forEach((input) => {
        if (this.session?.input === input) return;
        const key = input.dataset.common,
          values = selected.map((s) =>
            key.endsWith('Alignment')
              ? (s.placement?.[key] ?? 'center')
              : key === 'contourOffset'
                ? (s[key] ?? 0)
                : s[key],
          );
        const same = values.every((v) => v === values[0]);
        input.value = same ? values[0] : '';
        input.setAttribute(
          'aria-label',
          `${input.parentElement.firstChild.textContent}${same ? '' : ' · Blandat'}`,
        );
      });
  }
  input(e) {
    const input = e.target,
      { selected, operation } = this.getState();
    if (this.busy || !selected.length || operation || !input.matches('input,select')) return;
    if (this.session && this.session.input !== input && !this.multiEditing) this.finish();
    if (!this.session)
      this.session = {
        input,
        sources: structuredClone(selected),
        batch: null,
        error: '',
        errors: new Map(),
      };
    this.session.input = input;
    const session = this.session,
      key =
        input.dataset.common ||
        {
          width: 'width',
          height: 'height',
          thickness: 'thickness',
          rotation: 'rotation',
          profile: 'profile',
          'plate-contour-offset': 'contourOffset',
          'plate-thickness': 'thickness',
          'plate-side': 'side',
          'inspector-name': 'name',
        }[input.id];
    session.error = '';
    session.errors.delete(input.id);
    const candidate = (this.multiEditing ? session.batch || session.sources : session.sources).map(
      (s) => {
        const result = structuredClone(s);
        let value = input.type === 'number' ? Number(input.value) : input.value;
        if (input.type === 'number' && !input.value.trim()) {
          session.error = 'Ange ett tal.';
          session.errors.set(input.id, session.error);
          return result;
        }
        if (key) {
          if (key === 'name') {
            value = value.trim();
            if (!value) session.error = 'Ange ett namn.';
          }
          if (objectType(result).editAttribute) {
            try {
              return objectType(result).editAttribute(result, key, value);
            } catch (error) {
              session.error = error.message;
              return result;
            }
          }
          if (key.endsWith('Alignment'))
            result.placement = {
              horizontalAlignment: 'center',
              verticalAlignment: 'center',
              ...result.placement,
              [key]: value,
            };
          else result[key] = value;
        } else if (input.dataset.vertex !== undefined)
          result.polygon[+input.dataset.vertex][+input.dataset.component] = value;
        else {
          const coords =
            {
              sx: ['start', 0],
              sy: ['start', 1],
              sz: ['start', 2],
              ex: ['end', 0],
              ey: ['end', 1],
              ez: ['end', 2],
            }[input.id] ||
            (input.dataset.helperCoord ? input.dataset.helperCoord.split(':') : null);
          if (coords) result[coords[0]][coords[1]] = value;
        }
        return objectType(result).family === 'sweep' ? normalizeForm(result) : result;
      },
    );
    session.error = session.error || candidate.map(this.validate).find(Boolean) || '';
    if (session.error) session.errors.set(input.id, session.error);
    else session.batch = candidate;
    session.error = [...session.errors.values()][0] || '';
    this.$('inspector-error').textContent = session.error;
    if (session.error) this.cancel();
    else {
      try {
        this.preview(session.batch);
      } catch (error) {
        session.error = error.message;
        this.$('inspector-error').textContent = error.message;
        this.cancel();
      }
    }
    if (this.multiEditing) {
      if (!session.error) this.fillStandardFields();
      this.actions.querySelector('.primary').disabled = !session.batch || !!session.error;
      this.actions.querySelector('button').disabled = false;
    }
  }
  finish() {
    if (!this.session || this.busy) return;
    const session = this.session;
    this.session = null;
    this.busy = true;
    if (session.error) {
      this.cancel();
      this.fill(session.sources);
      this.$('inspector-error').textContent = session.error;
    } else if (JSON.stringify(session.sources) !== JSON.stringify(session.batch)) {
      this.cancel();
      try {
        this.commit(session.batch);
        this.$('inspector-error').textContent = '';
      } catch (error) {
        this.fill(session.sources);
        this.$('inspector-error').textContent = error.message;
      }
    } else this.cancel();
    this.busy = false;
    this.sync();
    this.scopeChanged(true);
  }
  rollback() {
    const session = this.session;
    if (!session) return;
    this.session = null;
    this.busy = true;
    this.cancel();
    this.fill(session.sources);
    this.$('inspector-error').textContent = '';
    this.busy = false;
    this.sync();
    this.scopeChanged(true);
  }
  focusGeometry(index) {
    this.show('properties');
    const details = this.$(typeof index === 'number' ? 'plate-geometry' : 'sweep-geometry');
    if (!details.hidden) details.open = true;
    if (typeof index === 'number')
      this.$('plate-vertices')
        .querySelectorAll('.plate-vertex-row')
        .forEach((row, i) => (row.hidden = i !== index));
    else
      document
        .querySelectorAll('#sweep-geometry fieldset')
        .forEach((row, i) => (row.hidden = index === 'start' ? i !== 0 : i !== 1));
  }
}
