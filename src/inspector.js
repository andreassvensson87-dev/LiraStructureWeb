import { objectType } from './model/object-types/index.js';
import { FORM_OPTIONS, isRound, hasWall, normalizeForm } from './profile-forms.js';
// Inspector transactions keep the model unchanged until a field is confirmed.
export class Inspector {
  constructor({ getState, preview, commit, cancel, fill, validate, remove }) {
    Object.assign(this, { getState, preview, commit, cancel, fill, validate, remove });
    this.session = null;
    this.signature = '';
    this.tab = 'model';
    this.busy = false;
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    document
      .querySelectorAll('[data-inspector-tab]')
      .forEach((button) => (button.onclick = () => this.show(button.dataset.inspectorTab)));
    $('inspector-properties').addEventListener('input', (e) => this.input(e));
    $('inspector-properties').addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT' && this.session) this.finish();
    });
    $('inspector-properties').addEventListener('focusout', () => {
      if (this.session && !this.busy) this.finish();
    });
    $('inspector-properties').addEventListener(
      'keydown',
      (e) => {
        if (!this.session) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
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
  show(tab) {
    this.tab = tab;
    this.$('inspector-properties').hidden = tab !== 'properties';
    this.$('inspector-model').hidden = tab !== 'model';
    const references = this.$('inspector-references');
    if (references) references.hidden = tab !== 'references';
    document
      .querySelectorAll('[data-inspector-tab]')
      .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.inspectorTab === tab)));
  }
  sync() {
    const { selected, drawing, operation } = this.getState(),
      $ = this.$;
    const signature = selected
      .map((s) => s.id + ':' + (s.type || 'sweep') + ':' + (s.profile || ''))
      .join('|');
    if (signature !== this.signature) {
      this.session = null;
      this.cancel();
      this.signature = signature;
      this.buildCommon(selected);
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
      this.show('model');
    }
    $('apply').hidden = has;
    $('deselect').hidden = true;
    $('plate-new').hidden = true;
    if (selected.length === 1) $('plate-apply').hidden = true;
    $('common-fields').inert = !!operation;
    this.fillCommon(selected);
    this.show(this.tab);
  }
  buildCommon(selected) {
    const root = this.$('common-fields');
    root.replaceChildren();
    if (selected.length < 2) return;
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
              ['profile', 'Tvärsnitt', FORM_OPTIONS],
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
          : [];
    if (!fields.length) {
      const p = document.createElement('p');
      p.className = 'inspector-note';
      p.textContent =
        'Plate och sweep har olika egenskaper. Flytta, kopiera och rotera fungerar för hela markeringen.';
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
            key.endsWith('Alignment') ? (s.placement?.[key] ?? 'center') : s[key],
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
    if (this.session && this.session.input !== input) this.finish();
    if (!this.session)
      this.session = { input, sources: structuredClone(selected), batch: null, error: '' };
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
    session.batch = session.sources.map((s) => {
      const result = structuredClone(s);
      let value = input.type === 'number' ? Number(input.value) : input.value;
      if (input.type === 'number' && !input.value.trim()) {
        session.error = 'Ange ett tal.';
        return result;
      }
      if (key) {
        if (key === 'name') {
          value = value.trim();
          if (!value) session.error = 'Ange ett namn.';
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
          }[input.id] || (input.dataset.helperCoord ? input.dataset.helperCoord.split(':') : null);
        if (coords) result[coords[0]][coords[1]] = value;
      }
      return objectType(result).family === 'sweep' ? normalizeForm(result) : result;
    });
    session.error = session.error || session.batch.map(this.validate).find(Boolean) || '';
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
  }
  focusGeometry(index) {
    this.show('properties');
    const details = this.$(typeof index === 'number' ? 'plate-geometry' : 'sweep-geometry');
    details.open = true;
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
