import {
  FASTENER_LIBRARY_KEY,
  defaultHoleForSpec,
  FASTENER_KINDS,
  latestFasteners,
  mergeFasteners,
  validateFastenerLibrary,
  validateFastenerSpec,
} from './library.js';
import { isFastener, validateFastener } from './object-type.js';
import { axisPlacement } from './geometry.js';
import { validateFastenerTargets, holesForPart } from './relations.js';
import { partAxisInterval } from './placement.js';
import { isPhysical } from '../model-object.js';
import './style.css';

const numeric = (name, label, value, min = 0) =>
  `<label class="field">${label}<input name="${name}" type="number" step="any" min="${min}" value="${value}" required></label>`;
const button = (text, action) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = action;
  return b;
};
export class FastenerUI {
  constructor({
    getObjects,
    getSelection,
    commit,
    beginPlacement,
    finish,
    selectSource,
    showInspector,
    getOperation,
    beginTargets,
  }) {
    Object.assign(this, {
      getObjects,
      getSelection,
      commit,
      beginPlacement,
      finish,
      selectSource,
      showInspector,
      getOperation,
      beginTargets,
    });
    this.records = [];
    try {
      const raw = localStorage.getItem(FASTENER_LIBRARY_KEY);
      if (raw) this.records = validateFastenerLibrary(JSON.parse(raw));
    } catch (e) {
      this.loadError = e.message;
    }
    const tool = button('Skruv', () => this.startCreation());
    tool.id = 'fastener';
    tool.setAttribute('aria-label', 'Skruv och hål');
    tool.setAttribute('aria-pressed', 'false');
    tool.innerHTML =
      '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 5 3-3 5 5-3 3Zm5 5 9 9 3 1-1-3-9-9M12 12l3-3M15 15l3-3"/></svg><span>Skruv</span>';
    document.querySelector('.toolbox').append(tool);
    this.panel = document.createElement('section');
    this.panel.id = 'fastener-panel';
    this.panel.hidden = true;
    document.getElementById('form').after(this.panel);
    this.library = document.createElement('dialog');
    this.library.id = 'fastener-library';
    this.library.setAttribute('aria-labelledby', 'fastener-library-title');
    this.library.innerHTML = `
      <div class="panel-title"><div><h2 id="fastener-library-title">Skruvbibliotek</h2><span class="fastener-subtitle">Egna skruvar och dimensioner · mm</span></div><button type="button" data-close aria-label="Stäng skruvbibliotek">×</button></div>
      <div class="fastener-library-layout">
        <nav aria-label="Skruvar i biblioteket"><input aria-label="Sök skruvar" type="search" data-search placeholder="Sök namn eller dimension…"><div data-records></div><button type="button" data-new>+ Ny skruv</button></nav>
        <form data-edit>
          <div class="fastener-edit-heading"><h3 data-edit-title>Ny skruv</h3><span data-version></span></div>
          <div class="dimensions"><label class="field">Typ<select name="kind">${FASTENER_KINDS.map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></label><label class="field">Namn<input name="name" maxlength="120" placeholder="T.ex. Träskruv 6 × 100" required></label></div>
          <div class="dimensions">${numeric('diameter', 'Diameter', 6, 0.001)}${numeric('length', 'Längd under huvud', 100, 0.001)}</div>
          <fieldset><legend>Huvud</legend><div class="fastener-head-fields"><label class="field">Form<select name="headKind"><option value="countersunk">Försänkt</option><option value="cylinder">Cylindriskt</option><option value="hex">Sexkant</option></select></label>${numeric('headDiameter', 'Diameter / nyckelvidd', 12, 0.001)}${numeric('headHeight', 'Höjd', 4, 0.001)}</div></fieldset>
          <fieldset data-nut><legend>Mutter</legend><div class="dimensions">${numeric('nutAcrossFlats', 'Nyckelvidd', 17, 0.001)}${numeric('nutThickness', 'Tjocklek', 8, 0.001)}</div></fieldset>
          <fieldset><legend><label class="fastener-check"><input type="checkbox" name="hasWasher">Brickmått</label></legend><div class="fastener-head-fields" data-washer-dimensions>${numeric('washerInner', 'Innerdiameter', 11, 0.001)}${numeric('washerOuter', 'Ytterdiameter', 22, 0.001)}${numeric('washerThickness', 'Tjocklek', 2, 0.001)}</div></fieldset>
          <details data-library-holes><summary>Hålstandard <span data-hole-summary></span></summary>
            <div class="fastener-head-fields"><label class="field">Håltyp<select name="defaultHoleKind"><option value="none">Ingen borrning</option><option value="pilot">Förborrning / blindhål</option><option value="clearance">Frigång / genomgående</option></select></label>${numeric('defaultHoleDiameter', 'Diameter', 6, 0.001)}${numeric('defaultHoleDepth', 'Djup', 50, 0.001)}</div>
            <label class="fastener-check fastener-default-cs"><input type="checkbox" name="defaultHasCountersink">Försänkning</label><div class="dimensions" data-default-countersink>${numeric('defaultCsDiameter', 'Diameter', 12, 0.001)}${numeric('defaultCsDepth', 'Djup', 4, 0.001)}</div>
            <p class="inspector-note">Standard för nya delkopplingar. Varje del kan ändras i inspectorn. Genomgående håls läge och djup beräknas där från delens ytor.</p>
          </details>
          <div class="fastener-save"><span>Placerade skruvar behåller sin version.</span><button type="submit" class="primary">Spara skruv</button></div>
          <p data-error role="alert"></p>
        </form>
      </div>
      <footer><span>Sparas i webbläsaren · egna, ej verifierade produkter</span><div><button type="button" data-export title="Exportera bibliotek för säkerhetskopia">Exportera</button><button type="button" data-import>Importera</button><input type="file" data-file accept=".json,application/json" hidden></div></footer>`;
    document.body.append(this.library);
    this.library.addEventListener('keydown', (e) => e.stopPropagation());
    this.library.querySelector('[data-close]').onclick = () => this.library.close();
    this.library.querySelector('[data-new]').onclick = () => this.editSpec(null);
    this.library.querySelector('[data-search]').oninput = () => this.renderLibrary();
    this.editForm = this.library.querySelector('[data-edit]');
    this.editForm.elements.kind.onchange = () => this.syncNut();
    this.editForm.elements.hasWasher.onchange = () => this.syncNut();
    for (const name of [
      'defaultHoleKind',
      'defaultHasCountersink',
      'defaultHoleDiameter',
      'defaultHoleDepth',
    ])
      this.editForm.elements.namedItem(name).oninput = () => this.syncHoleDefaults();
    this.editForm.onsubmit = (e) => {
      e.preventDefault();
      this.run(this.library, () => this.saveSpec());
    };
    this.library.querySelector('[data-export]').onclick = () => this.exportLibrary();
    this.library.querySelector('[data-import]').onclick = () =>
      this.library.querySelector('[data-file]').click();
    this.library.querySelector('[data-file]').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (file.size > 2e6) throw new Error('Biblioteksfilen får vara högst 2 MB.');
        const records = validateFastenerLibrary(JSON.parse(await file.text()));
        this.persist(mergeFasteners(this.records, records));
        this.renderLibrary();
        this.library.querySelector('[data-error]').textContent = 'Bibliotek importerat.';
      } catch (error) {
        this.library.querySelector('[data-error]').textContent = error.message;
      }
      e.target.value = '';
    };
    this.placeForm = document.createElement('form');
    this.placeForm.className = 'fastener-editor';
    this.placeForm.dataset.placement = '';
    this.placeForm.innerHTML = `
      <div class="fastener-spec-row"><label class="field">Skruv ur bibliotek<select name="spec" required></select></label><button type="button" data-library title="Öppna skruvbibliotek" aria-label="Öppna skruvbibliotek">↗</button></div><p data-spec-info class="inspector-note"></p>
      <section data-connections class="fastener-connections"><div class="fastener-connections-heading"><h3>Objekt i förbandet <span data-hole-count></span></h3><button type="button" data-select-targets>Välj objekt…</button></div><p data-target-empty class="inspector-note">Inga objekt valda. Välj vilka delar som ska ingå.</p><div data-holes></div><details data-hole-tools><summary>Referensdel och hålberäkning</summary><label class="field">Referensdel<select name="anchor"><option value="">Fristående</option></select></label><button type="button" data-apply-hole-defaults>Hämta hålstandard från bibliotek</button><button type="button" data-calculate>Beräkna genomgående hål</button><p class="inspector-note">Endast valda delar med förborrning eller frigång får hål. Referensdelen styr skruvens läge vid flytt och rotation.</p></details></section>
      <details data-position><summary>Placering · XYZ i mm</summary><fieldset><legend>Under huvud</legend><div class="coordinates">${['X', 'Y', 'Z'].map((a, i) => numeric(`start${i}`, a, 0, -1e7)).join('')}</div></fieldset><fieldset><legend>Riktningspunkt</legend><div class="coordinates">${['X', 'Y', 'Z'].map((a, i) => numeric(`direction${i}`, a, i === 2 ? -100 : 0, -1e7)).join('')}</div></fieldset></details>
      <label class="field" data-nut-offset>Mutterläge · mm från under huvud<input name="nutOffset" type="number" step="any" min="0"></label>
      <fieldset data-washers><legend>Brickor</legend><div class="fastener-washer-options"><label class="fastener-check"><input type="checkbox" name="washerHead">Under huvud</label><label class="fastener-check" data-washer-nut><input type="checkbox" name="washerNut">Vid mutter</label></div><p data-washer-info class="inspector-note"></p></fieldset>

      <p data-error role="alert"></p><div class="fastener-actions"><button type="submit" class="primary">Skapa skruv</button><button type="button" data-delete class="danger">Ta bort skruv</button></div>`;
    this.placeForm.dataset.independentEditor = '';
    for (const event of ['input', 'change'])
      this.placeForm.addEventListener(event, (e) => e.stopPropagation());
    this.placeForm.querySelector('[data-library]').onclick = () => this.openLibrary();
    this.placeForm.elements.spec.onchange = () => this.specChanged();
    this.placeForm.querySelector('[data-delete]').onclick = () =>
      document.getElementById('delete').click();
    this.placeForm.querySelector('[data-select-targets]').onclick = () => this.pickTargets();
    this.placeForm.querySelector('[data-apply-hole-defaults]').onclick = () => {
      this.holeRows = this.holeRows.map((h) => this.defaultHole(h.targetId));
      this.renderHoles();
    };
    this.placeForm.querySelector('[data-calculate]').onclick = () =>
      this.run(this.placeForm, () => this.calculateHoles());
    this.placeForm.onsubmit = (e) => {
      e.preventDefault();
      if (this.getOperation()?.mode === 'fastenerTargets') {
        this.confirmTargets();
        return;
      }
      this.run(this.placeForm, () => {
        const draft = this.readPlacement();
        this.commit(draft);
      });
    };
    this.library.addEventListener('close', () => {
      if (this.placeForm.isConnected) this.refreshSpecs(this.placeForm.elements.spec.value);
    });
    this.editSpec(null);
  }
  run(dialog, action) {
    try {
      action();
      dialog.querySelector('[data-error]').textContent = '';
    } catch (e) {
      dialog.querySelector('[data-error]').textContent = e.message;
    }
  }
  persist(records) {
    localStorage.setItem(FASTENER_LIBRARY_KEY, JSON.stringify({ schema: 1, fasteners: records }));
    this.records = records;
  }
  openLibrary() {
    this.finish();
    this.renderLibrary();
    this.library.querySelector('[data-error]').textContent = this.loadError || '';
    this.library.showModal();
  }
  renderLibrary() {
    const root = this.library.querySelector('[data-records]');
    root.replaceChildren();
    const query = this.library.querySelector('[data-search]').value.toLocaleLowerCase('sv');
    let count = 0;
    for (const [kind, label] of FASTENER_KINDS) {
      const specs = latestFasteners(this.records).filter(
        (s) =>
          s.kind === kind &&
          `${s.name} ${s.diameter} ${s.length}`.toLocaleLowerCase('sv').includes(query),
      );
      if (!specs.length) continue;
      const heading = document.createElement('h3');
      heading.textContent = `${label} · ${specs.length}`;
      root.append(heading);
      for (const spec of specs) {
        const entry = button('', () => this.editSpec(spec));
        entry.dataset.specId = spec.id;
        entry.setAttribute('aria-pressed', String(this.editingSpec?.id === spec.id));
        const name = document.createElement('strong');
        name.textContent = spec.name;
        const dimensions = document.createElement('span');
        dimensions.textContent = `Ø${spec.diameter} × ${spec.length}`;
        entry.title = `${spec.name} · ${dimensions.textContent} mm · version ${spec.revision}`;
        entry.setAttribute('aria-label', entry.title);
        entry.append(name, dimensions);
        root.append(entry);
        count++;
      }
    }
    if (!count) {
      const empty = document.createElement('p');
      empty.className = 'fastener-empty';
      empty.textContent = query
        ? 'Inga skruvar matchar sökningen.'
        : 'Biblioteket är tomt. Lägg till din första skruv eller importera ett bibliotek.';
      root.append(empty);
    }
  }
  editSpec(spec) {
    this.editingSpec = spec;
    const values = {
      kind: spec?.kind || 'wood',
      name: spec?.name || '',
      diameter: spec?.diameter || 6,
      length: spec?.length || 100,
      headKind: spec?.head.kind || 'countersunk',
      headDiameter: spec?.head.diameter || 12,
      headHeight: spec?.head.height || 4,
      nutAcrossFlats: spec?.nut?.acrossFlats || 17,
      nutThickness: spec?.nut?.thickness || 8,
      washerInner: spec?.washer?.innerDiameter || (spec?.diameter || 10) + 1,
      washerOuter: spec?.washer?.outerDiameter || (spec?.diameter || 10) * 2.2,
      washerThickness: spec?.washer?.thickness || 2,
      defaultHoleKind: spec?.holeDefaults?.kind || 'none',
      defaultHoleDiameter: spec?.holeDefaults?.diameter ?? spec?.diameter ?? 6,
      defaultHoleDepth: spec?.holeDefaults?.depth ?? 50,
      defaultCsDiameter: spec?.holeDefaults?.countersink?.diameter ?? spec?.head.diameter ?? 12,
      defaultCsDepth: spec?.holeDefaults?.countersink?.depth ?? spec?.head.height ?? 4,
    };
    for (const [name, value] of Object.entries(values))
      this.editForm.elements.namedItem(name).value = value;
    this.editForm.elements.hasWasher.checked = !!spec?.washer;
    this.editForm.elements.defaultHasCountersink.checked = !!spec?.holeDefaults?.countersink;
    this.library.querySelector('[data-library-holes]').open = false;
    this.syncHoleDefaults();
    this.library.querySelector('[data-edit-title]').textContent = spec
      ? 'Redigera skruv'
      : 'Ny skruv';
    this.library.querySelector('[data-version]').textContent = spec
      ? `Version ${spec.revision}`
      : 'Ej sparad';
    this.editForm.querySelector('[type=submit]').textContent = spec
      ? 'Spara ny version'
      : 'Spara skruv';
    this.library
      .querySelectorAll('[data-spec-id]')
      .forEach((entry) =>
        entry.setAttribute('aria-pressed', String(entry.dataset.specId === spec?.id)),
      );
    this.library.querySelector('[data-error]').textContent = '';
    this.syncNut();
  }
  syncNut() {
    this.library.querySelector('[data-nut]').hidden = this.editForm.elements.kind.value !== 'bolt';
    const enabled = this.editForm.elements.hasWasher.checked;
    this.library.querySelector('[data-washer-dimensions]').hidden = !enabled;
    for (const name of ['washerInner', 'washerOuter', 'washerThickness'])
      this.editForm.elements.namedItem(name).disabled = !enabled;
  }
  syncHoleDefaults() {
    const f = this.editForm.elements;
    const enabled = f.defaultHoleKind.value !== 'none';
    for (const name of ['defaultHoleDiameter', 'defaultHoleDepth', 'defaultHasCountersink'])
      f.namedItem(name).disabled = !enabled;
    const countersink = enabled && f.defaultHasCountersink.checked;
    this.library.querySelector('[data-default-countersink]').hidden = !countersink;
    for (const name of ['defaultCsDiameter', 'defaultCsDepth'])
      f.namedItem(name).disabled = !countersink;
    this.library.querySelector('[data-hole-summary]').textContent = enabled
      ? `${f.defaultHoleKind.value === 'pilot' ? 'Förborrning' : 'Frigång'} · Ø${f.defaultHoleDiameter.value} × ${f.defaultHoleDepth.value}`
      : 'Ingen borrning';
  }
  saveSpec() {
    const f = this.editForm.elements,
      spec = {
        id: this.editingSpec?.id || crypto.randomUUID(),
        revision:
          1 +
          Math.max(
            0,
            ...this.records.filter((s) => s.id === this.editingSpec?.id).map((s) => s.revision),
          ),
        kind: f.kind.value,
        name: f.namedItem('name').value.trim(),
        diameter: Number(f.diameter.value),
        length: Number(f.namedItem('length').value),
        holeDefaults: {
          kind: f.defaultHoleKind.value,
          ...(f.defaultHoleKind.value !== 'none'
            ? {
                diameter: Number(f.defaultHoleDiameter.value),
                depth: Number(f.defaultHoleDepth.value),
                ...(f.defaultHasCountersink.checked
                  ? {
                      countersink: {
                        diameter: Number(f.defaultCsDiameter.value),
                        depth: Number(f.defaultCsDepth.value),
                      },
                    }
                  : {}),
              }
            : {}),
        },
        head: {
          kind: f.headKind.value,
          diameter: Number(f.headDiameter.value),
          height: Number(f.headHeight.value),
        },
        ...(f.hasWasher.checked
          ? {
              washer: {
                innerDiameter: Number(f.washerInner.value),
                outerDiameter: Number(f.washerOuter.value),
                thickness: Number(f.washerThickness.value),
              },
            }
          : {}),
        ...(f.kind.value === 'bolt'
          ? {
              nut: {
                acrossFlats: Number(f.nutAcrossFlats.value),
                thickness: Number(f.nutThickness.value),
              },
            }
          : {}),
      };
    validateFastenerSpec(spec);
    this.persist(mergeFasteners(this.records, [spec]));
    this.editSpec(spec);
    this.renderLibrary();
  }
  exportLibrary() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ schema: 1, fasteners: this.records }, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skruvbibliotek.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  startCreation() {
    this.finish();
    this.loadPlacement(null);
    this.holeRows = [];
    this.anchor = '';
    this.renderHoles();
    this.beginTargets([]);
  }
  pickTargets() {
    this.readHoles();
    this.beginTargets(this.holeRows.map((h) => h.targetId));
  }
  setTargets(ids) {
    this.readHoles();
    const existing = new Map(this.holeRows.map((h) => [h.targetId, h]));
    this.holeRows = ids.map((id) => existing.get(id) || this.defaultHole(id));
    if (!ids.includes(this.anchor)) this.anchor = ids[0] || '';
    this.renderHoles();
  }
  confirmTargets() {
    this.run(this.placeForm, () => {
      const draft = this.readPlacement();
      if (this.editingObject) {
        this.finish();
        this.commit(draft);
      } else this.beginPlacement(draft);
    });
  }
  availableParts() {
    return this.getObjects().filter((s) => isPhysical(s) && !isFastener(s));
  }
  refreshSpecs(selected) {
    const select = this.placeForm.elements.spec;
    select.replaceChildren(new Option('Välj skruv…', ''));
    const records = latestFasteners(this.records);
    const snapshot = this.editingObject?.spec;
    if (
      snapshot &&
      !records.some((s) => `${s.id}:${s.revision}` === `${snapshot.id}:${snapshot.revision}`)
    )
      records.unshift(snapshot);
    this.specOptions = records;
    records.forEach((s) =>
      select.append(
        new Option(
          `${s.name} · Ø${s.diameter} × ${s.length} · v${s.revision}`,
          `${s.id}:${s.revision}`,
        ),
      ),
    );
    if (selected && records.some((s) => `${s.id}:${s.revision}` === selected))
      select.value = selected;
    else if (snapshot) select.value = `${snapshot.id}:${snapshot.revision}`;
    this.specChanged(false);
  }
  currentSpec() {
    const value = this.placeForm.elements.spec.value;
    return this.specOptions.find((s) => `${s.id}:${s.revision}` === value) || null;
  }
  specChanged(resetNut = true) {
    const spec = this.currentSpec();
    this.placeForm.querySelector('[data-nut-offset]').hidden = spec?.kind !== 'bolt';
    this.placeForm.querySelector('[data-washer-nut]').hidden = spec?.kind !== 'bolt';
    const head = this.placeForm.elements.washerHead,
      nut = this.placeForm.elements.washerNut;
    head.disabled = !spec?.washer || spec.head.kind === 'countersunk';
    nut.disabled = !spec?.washer || spec.kind !== 'bolt';
    if (head.disabled) head.checked = false;
    if (nut.disabled) nut.checked = false;
    this.placeForm.querySelector('[data-washer-info]').textContent = spec?.washer
      ? `Ø${spec.washer.innerDiameter} / Ø${spec.washer.outerDiameter} × ${spec.washer.thickness} mm${head.disabled ? ' · plan bricka passar inte försänkt huvud' : ''}`
      : 'Lägg till brickmått i skruvbiblioteket.';
    if (resetNut)
      this.placeForm.elements.nutOffset.value =
        spec?.kind === 'bolt' ? spec.length - spec.nut.thickness : '';
    if (resetNut && !this.editingObject && this.holeRows) {
      this.holeRows = this.holeRows.map((h) => this.defaultHole(h.targetId));
      this.renderHoles();
    }
    this.placeForm.querySelector('[data-spec-info]').textContent = spec
      ? `${spec.head.kind === 'hex' ? 'Sexkantshuvud' : spec.head.kind === 'countersunk' ? 'Försänkt huvud' : 'Cylindriskt huvud'}${spec.nut ? ` · Mutter ${spec.nut.acrossFlats} × ${spec.nut.thickness} mm` : ''}`
      : 'Skapa först en bibliotekspost om biblioteket är tomt.';
  }
  defaultHole(targetId) {
    return defaultHoleForSpec(this.currentSpec(), targetId);
  }
  openPlacement(source = null) {
    this.finish();
    if (!source) source = this.getSelection().find(isFastener) || null;
    if (source) {
      this.selectSource(source.id);
      this.showInspector();
      return;
    }
    this.startCreation();
  }
  loadPlacement(source) {
    if (source && this.loadedSource?.id !== source.id)
      this.placeForm.querySelector('[data-position]').open = false;
    this.loadedSource = source;
    this.editingObject = source;
    const f = this.placeForm.elements;
    const previousSpec = this.placeForm.elements.spec.value;
    this.refreshSpecs(source ? null : previousSpec);
    if (!source && !this.currentSpec() && this.specOptions.length) {
      const spec = this.specOptions[0];
      this.placeForm.elements.spec.value = `${spec.id}:${spec.revision}`;
      this.specChanged();
    }
    const start = source?.start || [0, 0, 0],
      end = source?.end || [0, 0, -100];
    start.forEach((v, i) => (f[`start${i}`].value = v));
    end.forEach((v, i) => (f[`direction${i}`].value = v));
    f.nutOffset.value =
      source?.nutOffset ??
      (this.currentSpec()?.kind === 'bolt'
        ? this.currentSpec().length - this.currentSpec().nut.thickness
        : '');
    f.washerHead.checked = !!source?.washers?.head;
    f.washerNut.checked = !!source?.washers?.nut;
    this.holeRows = source
      ? structuredClone(source.holes)
      : this.getSelection()
          .filter((s) => isPhysical(s) && !isFastener(s))
          .map((s) => this.defaultHole(s.id));
    this.anchor = source?.anchorId ?? this.holeRows[0]?.targetId ?? '';
    this.renderHoles();
    this.placeForm.querySelector('[data-delete]').hidden = !source;
    this.placeForm.querySelector('[type=submit]').textContent = source
      ? 'Spara skruv och hål'
      : 'Skapa skruv';
    this.placeForm.querySelector('[data-error]').textContent = '';
  }
  renderHoles() {
    const root = this.placeForm.querySelector('[data-holes]');
    root.replaceChildren();
    this.placeForm.querySelector('[data-hole-count]').textContent = this.holeRows.length
      ? `(${this.holeRows.length})`
      : '';
    this.placeForm.querySelector('[data-target-empty]').hidden = this.holeRows.length > 0;
    this.placeForm.querySelector('[data-hole-tools]').hidden = !this.holeRows.length;
    this.holeRows.forEach((h, i) => {
      const row = document.createElement('fieldset');
      row.dataset.hole = i;
      const legend = document.createElement('legend');
      legend.textContent = this.getObjects().find((s) => s.id === h.targetId)?.name || 'Saknad del';
      row.append(legend);
      const fields = document.createElement('div');
      fields.innerHTML = `<label class="field">Håltyp<select name="holeKind"><option value="none">Ingen borrning</option><option value="pilot">Förborrning / blindhål</option><option value="clearance">Frigång / genomgående</option></select></label><details data-hole-dimensions><summary>Hålmått · mm</summary><div class="coordinates">${numeric('offset', 'Start · mm', h.offset, -1e7)}${numeric('diameter', 'Diameter · mm', h.diameter, 0.001)}${numeric('depth', 'Djup · mm', h.depth, 0.001)}</div><details><summary>Försänkning</summary><div class="dimensions">${numeric('csDiameter', 'Diameter · mm (0 = av)', h.countersink?.diameter || 0)}${numeric('csDepth', 'Djup · mm', h.countersink?.depth || 0)}</div></details></details>`;
      const kind = fields.querySelector('[name=holeKind]');
      kind.value = h.kind;
      const syncDimensions = () => {
        fields.querySelector('[data-hole-dimensions]').hidden = kind.value === 'none';
        fields
          .querySelectorAll('input')
          .forEach((input) => (input.disabled = kind.value === 'none'));
      };
      kind.onchange = syncDimensions;
      syncDimensions();
      row.append(
        fields,
        button('Ta bort delkoppling', () => {
          this.readHoles();
          this.holeRows.splice(i, 1);
          if (this.anchor === h.targetId) this.anchor = this.holeRows[0]?.targetId || '';
          this.renderHoles();
        }),
      );
      root.append(row);
    });
    const select = this.placeForm.elements.anchor;
    select.replaceChildren(new Option('Fristående', ''));
    this.holeRows.forEach((h) =>
      select.append(
        new Option(
          this.getObjects().find((s) => s.id === h.targetId)?.name || h.targetId,
          h.targetId,
        ),
      ),
    );
    select.value = this.anchor;
    select.onchange = () => (this.anchor = select.value);
  }
  readHoles() {
    this.holeRows = [...this.placeForm.querySelectorAll('[data-hole]')].map((row, i) => {
      const value = (name) => Number(row.querySelector(`[name=${name}]`).value);
      return {
        targetId: this.holeRows[i].targetId,
        kind: row.querySelector('[name=holeKind]').value,
        offset: value('offset'),
        diameter: value('diameter'),
        depth: value('depth'),
        ...(value('csDiameter') || value('csDepth')
          ? { countersink: { diameter: value('csDiameter'), depth: value('csDepth') } }
          : {}),
      };
    });
    this.anchor = this.placeForm.elements.anchor.value;
  }
  readPlacement() {
    const spec = this.currentSpec();
    if (!spec) throw new Error('Välj en skruv ur biblioteket.');
    this.readHoles();
    if (!this.holeRows.length) throw new Error('Välj minst ett objekt som ska ingå i förbandet.');
    const f = this.placeForm.elements;
    const start = [0, 1, 2].map((i) => Number(f[`start${i}`].value));
    const direction = [0, 1, 2].map((i) => Number(f[`direction${i}`].value));
    const draft = {
      ...(this.editingObject || {}),
      type: 'fastener',
      spec: structuredClone(spec),
      ...axisPlacement(spec, start, direction),
      holes: structuredClone(this.holeRows),
      washers: { head: f.washerHead.checked, nut: f.washerNut.checked },
      anchorId: this.anchor || null,
      ...(spec.kind === 'bolt'
        ? {
            nutOffset:
              f.nutOffset.value === ''
                ? spec.length - spec.nut.thickness
                : Number(f.nutOffset.value),
          }
        : { nutOffset: null }),
    };
    const error = validateFastener(draft);
    if (error) throw new Error(error);
    validateFastenerTargets(draft, this.getObjects());
    return draft;
  }
  calculateHoles() {
    const draft = this.readPlacement();
    this.holeRows = draft.holes.map((h) =>
      h.kind === 'clearance'
        ? {
            ...h,
            ...partAxisInterval(
              draft,
              this.getObjects().find((s) => s.id === h.targetId),
              this.getObjects().filter((s) => s.id !== draft.id),
            ),
          }
        : h,
    );
    this.renderHoles();
  }
  sync(selected, operation) {
    const choosing = operation?.mode === 'fastenerTargets';
    const creating = operation?.mode === 'fastenerCreate';
    document.getElementById('fastener').setAttribute('aria-pressed', String(creating || choosing));
    if (choosing) {
      this.panel.hidden = false;
      this.placeForm.dataset.pickingTargets = '';
      if (this.placeForm.parentElement !== this.panel) this.panel.replaceChildren(this.placeForm);
      document.getElementById('form').hidden = document.getElementById('plate-form').hidden = true;
      document.getElementById('object-heading').textContent = 'Skruv · Välj delar';
      document.getElementById('mode-label').textContent = 'Välj → Enter → Placera';
      this.placeForm.querySelector('[data-select-targets]').hidden = true;
      this.placeForm.querySelector('[data-position]').hidden = true;
      this.placeForm.querySelector('[data-calculate]').disabled = true;
      this.placeForm.querySelector('[data-delete]').hidden = true;
      this.placeForm.querySelector('[type=submit]').textContent = 'Bekräfta delar ↵';
      this.placeForm.querySelector('[data-target-empty]').textContent =
        'Klicka på delarna i modellen. Enter bekräftar, Escape avbryter.';
      this.panel.inert = false;
      return;
    }
    delete this.placeForm.dataset.pickingTargets;
    this.placeForm.querySelector('[data-select-targets]').hidden = false;
    this.placeForm.querySelector('[data-position]').hidden = false;
    this.placeForm.querySelector('[data-calculate]').disabled = false;
    if (creating) {
      this.panel.replaceChildren();
      this.panel.hidden = false;
      document.getElementById('form').hidden = document.getElementById('plate-form').hidden = true;
      document.getElementById('object-heading').textContent = 'Placera skruv';
      document.getElementById('mode-label').textContent = 'Under huvud → riktning';
      const p = document.createElement('p');
      p.textContent = `${operation.draft.spec.name} · Klicka under huvud och sedan i skruvens riktning. Längd ${operation.draft.spec.length} mm. Escape avbryter.`;
      this.panel.append(p);
      this.panel.inert = false;
      return;
    }
    const source = selected.length === 1 && isFastener(selected[0]) ? selected[0] : null;
    const related =
      selected.length === 1
        ? this.getObjects()
            .filter(isFastener)
            .filter((s) => s.holes.some((h) => h.targetId === selected[0].id))
        : [];
    this.panel.hidden = !source && !related.length;
    if (source) {
      if (this.loadedSource !== source) this.loadPlacement(source);
      if (this.placeForm.parentElement !== this.panel) this.panel.replaceChildren(this.placeForm);
      document.getElementById('form').hidden = document.getElementById('plate-form').hidden = true;
      document.getElementById('object-heading').textContent =
        source.spec.kind === 'wood' ? 'Träskruv' : 'Skruv med mutter';
    } else {
      this.loadedSource = null;
      this.panel.replaceChildren();
      for (const s of related) {
        const count = holesForPart(selected[0], [s]).length;
        this.panel.append(
          button(`${s.name} · ${count ? 'Kopplat hål' : 'Ingen borrning'}`, () =>
            this.openPlacement(s),
          ),
        );
      }
    }
    this.panel.inert = !!operation;
  }
}
