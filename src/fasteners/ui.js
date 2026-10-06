import {
  FASTENER_LIBRARY_KEY,
  defaultHoleForSpec,
  FASTENER_KINDS,
  FASTENER_STANDARDS,
  hasNut,
  latestFasteners,
  mergeFasteners,
  validateFastenerLibrary,
  validateFastenerSpec,
} from './library.js';
import { assemblyDefaults, fastenerSeriesKey } from './assembly.js';
import { createAssemblyPicker } from './assembly-ui.js';
import { createFastenerGroupEditor } from './group-ui.js';
import { fastenerGroupBatch } from './groups.js';
import { selectedFastenerGroup } from './group-data.js';
import { fastenerAccessories } from './accessories.js';
import { isFastener, validateFastener } from './object-type.js';
import { axisPlacement } from './geometry.js';
import { validateFastenerTargets, holesForPart } from './relations.js';
import { boreFeature } from './holes.js';
import { automaticPlacement, holeExtent, resolveFastenerHoles } from './placement.js';
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
    previewPlacement,
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
      previewPlacement,
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
    const groupTool = button('Skruvgrupp', () => this.startCreation(true));
    groupTool.id = 'fastener-group';
    groupTool.setAttribute('aria-label', 'Skruvgrupp');
    groupTool.setAttribute('aria-pressed', 'false');
    groupTool.innerHTML =
      '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/></svg><span>Skruvgrupp</span>';
    document.querySelector('.toolbox').append(groupTool);
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
          <div class="dimensions"><label class="field">Standard<select name="standard">${FASTENER_STANDARDS.map((value) => `<option value="${value}">${value || 'Egen specifikation'}</option>`).join('')}</select></label><label class="field">Serie<input name="series" maxlength="120" placeholder="Gemensamt namn för längdvarianter"></label><label class="field">Hållfasthetsklass<input name="grade" maxlength="120" placeholder="T.ex. 8.8"></label></div>
          <div class="dimensions"><label class="field">Tillverkare<input name="manufacturer" maxlength="120"></label><label class="field">Artikelnummer<input name="article" maxlength="120"></label><label class="field">Ytbehandling<input name="coating" maxlength="120"></label></div>
          <fieldset data-thread><legend>Gänga</legend><label class="fastener-check"><input type="checkbox" name="hasThread">Ange gängmått</label><div class="dimensions" data-thread-dimensions>${numeric('threadLength', 'Gänglängd från spets', 100, 0.001)}${numeric('threadPitch', 'Stigning (0 = ej angiven)', 0)}</div></fieldset>
          <fieldset data-anchor hidden><legend>Förankring i betong · produktdata</legend><div class="fastener-head-fields">${numeric('embedment', 'Förankringsdjup', 60, 0.001)}${numeric('drillDiameter', 'Borrdiameter i betong', 6, 0.001)}${numeric('anchorDrillDepth', 'Borrdjup i betong', 70, 0.001)}</div><p class="inspector-note">Ange mått för vald produkt. Frigångshål i plåten ställs separat under Hålstandard.</p></fieldset>
          <fieldset data-head><legend>Huvud</legend><div class="fastener-head-fields"><label class="field">Form<select name="headKind"><option value="countersunk">Försänkt</option><option value="cylinder">Cylindriskt</option><option value="hex">Sexkant</option></select></label>${numeric('headDiameter', 'Diameter / nyckelvidd', 12, 0.001)}${numeric('headHeight', 'Höjd', 4, 0.001)}</div></fieldset>
          <fieldset data-nut><legend>Mutter</legend><div class="dimensions">${numeric('nutAcrossFlats', 'Nyckelvidd', 17, 0.001)}${numeric('nutThickness', 'Tjocklek', 8, 0.001)}</div></fieldset>
          <fieldset><legend><label class="fastener-check"><input type="checkbox" name="hasWasher">Brickmått</label></legend><div class="fastener-head-fields" data-washer-dimensions>${numeric('washerInner', 'Innerdiameter', 11, 0.001)}${numeric('washerOuter', 'Ytterdiameter', 22, 0.001)}${numeric('washerThickness', 'Tjocklek', 2, 0.001)}</div></fieldset>
          <details data-library-holes><summary>Hålstandard <span data-hole-summary></span></summary>
            <div class="fastener-head-fields"><label class="field">Håltyp<select name="defaultHoleKind"><option value="none">Ingen borrning</option><option value="pilot">Förborrning / blindhål</option><option value="clearance">Frigång / genomgående</option></select></label>${numeric('defaultHoleDiameter', 'Diameter', 6, 0.001)}${numeric('defaultHoleDepth', 'Djup', 50, 0.001)}</div>
            <label class="field" data-default-extent>Omfattning<select name="defaultHoleExtent"><option value="wall">Närmaste vägg / fläns</option><option value="profile">Hela profilen</option></select></label>
            <label class="fastener-check fastener-default-cs"><input type="checkbox" name="defaultHasCountersink">Försänkning</label><div class="dimensions" data-default-countersink>${numeric('defaultCsDiameter', 'Diameter', 12, 0.001)}${numeric('defaultCsDepth', 'Djup', 4, 0.001)}</div>
            <p class="inspector-note">Standard för nya delkopplingar. Varje del kan ändras i inspectorn. Startläget beräknas från delens ytor vid placering. För genomgående hål beräknas även djupet.</p>
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
    this.editForm.elements.hasThread.onchange = () => this.syncNut();
    this.editForm.elements.standard.onchange = () => {
      if (this.editForm.elements.standard.value) {
        this.editForm.elements.kind.value = 'bolt';
        this.editForm.elements.headKind.value = 'hex';
        this.editForm.elements.hasThread.checked = true;
      }
      this.syncNut();
    };
    this.editForm.elements.namedItem('length').oninput = () => this.syncNut();
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
      <div class="dimensions fastener-length-options"><label class="field">Längdval<select name="lengthMode"><option value="manual">Vald bibliotekslängd</option><option value="auto">Automatisk längd</option></select></label><label class="field" data-extra-length>Extra längd efter mutter · mm<input name="extraLength" type="number" min="0" max="1000" step="any" value="5"></label></div><p data-length-result class="fastener-length-result" role="status"></p>
      <fieldset class="fastener-assembly-section"><legend>Förband</legend><label class="field">Utförande<select name="assemblyMode"><option value="preset">Visuella förbandsval</option><option value="manual">Manuella tillbehör</option></select></label><div data-assembly-picker></div><p class="inspector-note" data-assembly-hint>Muttrar och brickor placeras mot delarnas ytor. Klicka på bilden eller kryssa i valen.</p></fieldset>
      <section data-connections class="fastener-connections"><div class="fastener-connections-heading"><h3>Objekt i förbandet <span data-hole-count></span></h3><button type="button" data-select-targets>Välj objekt…</button></div><p data-target-empty class="inspector-note">Inga objekt valda. Välj vilka delar som ska ingå.</p><div data-holes></div><details data-hole-tools><summary>Avancerat · referensdel och hålstandard</summary><label class="field">Referensdel<select name="anchor"><option value="">Fristående</option></select></label><button type="button" data-apply-hole-defaults>Hämta hålstandard från bibliotek</button><p class="inspector-note">Endast valda delar med förborrning eller frigång får hål. Referensdelen styr skruvens läge vid flytt och rotation.</p></details></section>
      <p class="inspector-note">Ytor och materiallager hittas automatiskt i valda objekt. Punkterna anger bara skruvaxeln.</p><p class="inspector-note" data-layer-info></p>
      <details data-search-settings><summary>Begränsa vilka lager som ingår</summary><label class="fastener-check"><input type="checkbox" name="limitLayers">Begränsa söklängden</label><label class="field" data-drill-depth>Söklängd från första materialytan · mm<input name="drillDepth" type="number" min="0.001" step="any" value="100"></label><p class="inspector-note">En vägg som träffas tas med i sin helhet. För en enda rörvägg kan du också välja Närmaste vägg under objektets hålinställningar.</p></details><details data-position><summary>Placering · XYZ i mm</summary><fieldset><legend data-entry-label>Ingångsyta</legend><div class="coordinates">${['X', 'Y', 'Z'].map((a, i) => numeric(`start${i}`, a, 0, -1e7)).join('')}</div></fieldset><fieldset><legend data-exit-label>Utgångsyta</legend><div class="coordinates">${['X', 'Y', 'Z'].map((a, i) => numeric(`direction${i}`, a, i === 2 ? -100 : 0, -1e7)).join('')}</div></fieldset></details>
      <details data-manual-hardware><summary>Avancerat · manuella lägen</summary><label class="field" data-nut-offset hidden>Mutterläge · mm från under huvud<input name="nutOffset" type="number" step="any" min="0"></label>
      <fieldset data-washers><legend>Brickor</legend><div class="fastener-washer-options"><label class="fastener-check"><input type="checkbox" name="washerHead">Under huvud</label><label class="fastener-check" data-washer-nut><input type="checkbox" name="washerNut">Vid mutter</label></div><p data-washer-info class="inspector-note"></p></fieldset>

      <fieldset data-accessory-editor><legend>Muttrar och brickor</legend><label class="fastener-check"><input type="checkbox" name="customAccessories">Placera muttrar och brickor längs axeln</label><div data-accessories hidden><p class="inspector-note">Lägen i mm från skaftets start, längs skruvaxeln.</p><div data-accessory-rows></div><div class="fastener-accessory-actions"><button type="button" data-add-nut>+ Mutter</button><button type="button" data-add-washer>+ Bricka</button></div></div><label class="field" data-start-allowance hidden>Utstick före första ytan · mm<input name="startAllowance" type="number" min="0" step="any" value="0"></label></fieldset>
      </details><p data-error role="alert"></p><div class="fastener-actions"><button type="submit" class="primary">Skapa skruv</button><button type="button" data-delete class="danger">Ta bort skruv</button></div>`;
    this.placeForm.dataset.independentEditor = '';
    const groupRoot = document.createElement('fieldset');
    groupRoot.dataset.fastenerGroup = '';
    this.placeForm.querySelector('.fastener-assembly-section').before(groupRoot);
    this.groupEditor = createFastenerGroupEditor(groupRoot);
    for (const event of ['input', 'change'])
      this.placeForm.addEventListener(event, (e) => e.stopPropagation());
    this.placeForm.querySelector('[data-library]').onclick = () => this.openLibrary();
    this.placeForm.elements.limitLayers.onchange = () => {
      this.syncPlacementMode();
      this.previewRange();
    };
    this.placeForm.addEventListener('input', () => this.previewRange());
    this.placeForm.addEventListener('change', () => this.previewRange());
    this.placeForm.elements.spec.onchange = () => this.specChanged();
    this.accessoryRows = [];
    this.assemblyPicker = createAssemblyPicker(
      this.placeForm.querySelector('[data-assembly-picker]'),
      () => this.previewRange(),
    );
    this.placeForm.elements.assemblyMode.onchange = () => this.renderAccessories();
    this.placeForm.elements.lengthMode.onchange = () => this.renderAccessories();
    this.placeForm.elements.customAccessories.onchange = () => {
      if (this.placeForm.elements.customAccessories.checked && !this.accessoryRows.length) {
        const spec = this.currentSpec();
        this.accessoryRows = fastenerAccessories({
          spec,
          nutOffset: Number(this.placeForm.elements.nutOffset.value),
          washers: {
            head: this.placeForm.elements.washerHead.checked,
            nut: this.placeForm.elements.washerNut.checked,
          },
        });
      }
      this.renderAccessories();
    };
    for (const kind of ['nut', 'washer'])
      this.placeForm.querySelector(`[data-add-${kind}]`).onclick = () => {
        this.readAccessories();
        const spec = this.currentSpec();
        const end = Math.max(
          0,
          ...this.accessoryRows.map((item) => item.offset + spec[item.kind].thickness),
        );
        this.accessoryRows.push({
          kind,
          offset:
            kind === 'nut'
              ? Math.max(end, spec.length - (spec.thread?.length ?? spec.length))
              : end,
        });
        this.renderAccessories();
        this.previewRange();
      };
    this.placeForm.querySelector('[data-delete]').onclick = () =>
      document.getElementById('delete').click();
    this.placeForm.querySelector('[data-select-targets]').onclick = () => this.pickTargets();
    this.placeForm.querySelector('[data-apply-hole-defaults]').onclick = () => {
      this.holeRows = this.holeRows.map((h) => this.defaultHole(h.targetId));
      this.renderHoles();
    };
    this.placeForm.onsubmit = (e) => {
      e.preventDefault();
      if (this.getOperation()?.mode === 'fastenerTargets') {
        this.confirmTargets();
        return;
      }
      this.run(this.placeForm, () => {
        const draft = this.readPlacement(true);
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
  openLibrary({ preserveOperation = false } = {}) {
    if (!preserveOperation) this.finish();
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
          `${s.name} ${s.diameter} ${s.length} ${s.standard || ''} ${s.manufacturer || ''} ${s.article || ''}`
            .toLocaleLowerCase('sv')
            .includes(query),
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
      standard: spec?.standard || '',
      grade: spec?.grade || '',
      series: spec?.series || '',
      manufacturer: spec?.manufacturer || '',
      article: spec?.article || '',
      coating: spec?.coating || '',
      threadLength: spec?.thread?.length ?? spec?.length ?? 100,
      threadPitch: spec?.thread?.pitch ?? 0,
      embedment: spec?.anchor?.embedment ?? 60,
      drillDiameter: spec?.anchor?.drillDiameter ?? spec?.diameter ?? 6,
      anchorDrillDepth: spec?.anchor?.drillDepth ?? 70,
      name: spec?.name || '',
      diameter: spec?.diameter || 6,
      length: spec?.length || 100,
      headKind: spec?.head?.kind || 'countersunk',
      headDiameter: spec?.head?.diameter || 12,
      headHeight: spec?.head?.height || 4,
      nutAcrossFlats: spec?.nut?.acrossFlats || 17,
      nutThickness: spec?.nut?.thickness || 8,
      washerInner: spec?.washer?.innerDiameter || (spec?.diameter || 10) + 1,
      washerOuter: spec?.washer?.outerDiameter || (spec?.diameter || 10) * 2.2,
      washerThickness: spec?.washer?.thickness || 2,
      defaultHoleExtent: spec?.holeDefaults?.extent === 'wall' ? 'wall' : 'profile',
      defaultHoleKind: spec?.holeDefaults?.kind || 'none',
      defaultHoleDiameter: spec?.holeDefaults?.diameter ?? spec?.diameter ?? 6,
      defaultHoleDepth: spec?.holeDefaults?.depth ?? 50,
      defaultCsDiameter: spec?.holeDefaults?.countersink?.diameter ?? spec?.head?.diameter ?? 12,
      defaultCsDepth: spec?.holeDefaults?.countersink?.depth ?? spec?.head?.height ?? 4,
    };
    for (const [name, value] of Object.entries(values))
      this.editForm.elements.namedItem(name).value = value;
    this.editForm.elements.hasWasher.checked = !!spec?.washer;
    this.editForm.elements.hasThread.checked = !!spec?.thread || spec?.kind === 'rod';
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
    const f = this.editForm.elements;
    const rod = f.kind.value === 'rod';
    f.namedItem('length').closest('label').firstChild.textContent = rod
      ? 'Längd'
      : 'Längd under huvud';
    if (f.kind.value !== 'bolt') f.standard.value = '';
    const full = rod || f.standard.value === 'ISO 4017';
    if (full || f.standard.value) f.hasThread.checked = true;
    f.hasThread.disabled = full || !!f.standard.value;
    f.threadLength.readOnly = full;
    if (full) f.threadLength.value = f.namedItem('length').value;
    this.library.querySelector('[data-thread-dimensions]').hidden = !f.hasThread.checked;
    for (const name of ['threadLength', 'threadPitch'])
      f.namedItem(name).disabled = !f.hasThread.checked;
    this.library.querySelector('[data-head]').hidden = rod;
    for (const name of ['headKind', 'headDiameter', 'headHeight']) f.namedItem(name).disabled = rod;
    this.library.querySelector('[data-anchor]').hidden = f.kind.value !== 'concrete';
    for (const name of ['embedment', 'drillDiameter', 'anchorDrillDepth'])
      f.namedItem(name).disabled = f.kind.value !== 'concrete';
    this.library.querySelector('[data-nut]').hidden = !hasNut({ kind: f.kind.value });
    for (const name of ['nutAcrossFlats', 'nutThickness'])
      f.namedItem(name).disabled = !hasNut({ kind: f.kind.value });
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
    this.library.querySelector('[data-default-extent]').hidden =
      f.defaultHoleKind.value !== 'clearance';
    f.defaultHoleExtent.disabled = f.defaultHoleKind.value !== 'clearance';
    f.defaultHoleDepth.closest('label').hidden = f.defaultHoleKind.value === 'clearance';
    const countersink = enabled && f.defaultHasCountersink.checked;
    this.library.querySelector('[data-default-countersink]').hidden = !countersink;
    for (const name of ['defaultCsDiameter', 'defaultCsDepth'])
      f.namedItem(name).disabled = !countersink;
    this.library.querySelector('[data-hole-summary]').textContent = enabled
      ? `${f.defaultHoleKind.value === 'pilot' ? 'Förborrning' : 'Frigång'} · Ø${f.defaultHoleDiameter.value}${f.defaultHoleKind.value === 'pilot' ? ` × ${f.defaultHoleDepth.value}` : ''}`
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
                extent: f.defaultHoleKind.value === 'pilot' ? 'blind' : f.defaultHoleExtent.value,
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
        ...(f.kind.value !== 'rod'
          ? {
              head: {
                kind: f.headKind.value,
                diameter: Number(f.headDiameter.value),
                height: Number(f.headHeight.value),
              },
            }
          : {}),
        ...(f.standard.value ? { standard: f.standard.value } : {}),
        ...Object.fromEntries(
          ['manufacturer', 'article', 'grade', 'coating', 'series']
            .filter((key) => f.namedItem(key).value.trim())
            .map((key) => [key, f.namedItem(key).value.trim()]),
        ),
        ...(f.hasThread.checked
          ? {
              thread: {
                length: Number(f.threadLength.value),
                ...(Number(f.threadPitch.value) ? { pitch: Number(f.threadPitch.value) } : {}),
              },
            }
          : {}),
        ...(f.kind.value === 'concrete'
          ? {
              anchor: {
                embedment: Number(f.embedment.value),
                drillDiameter: Number(f.drillDiameter.value),
                drillDepth: Number(f.anchorDrillDepth.value),
              },
            }
          : {}),
        ...(f.hasWasher.checked
          ? {
              washer: {
                innerDiameter: Number(f.washerInner.value),
                outerDiameter: Number(f.washerOuter.value),
                thickness: Number(f.washerThickness.value),
              },
            }
          : {}),
        ...(hasNut({ kind: f.kind.value })
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
  startCreation(group = false) {
    this.finish();
    this.selectSource(null);
    this.loadPlacement(null);
    this.groupEditor.load(null, group);
    this.holeRows = [];
    this.anchor = '';
    this.renderHoles();
    this.beginTargets([], group);
  }
  pickTargets() {
    this.readHoles();
    this.beginTargets(
      this.holeRows.map((h) => h.targetId),
      this.groupEditor.enabled(),
    );
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
      const draft = this.readPlacement(!!this.editingObject);
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
    const snapshot = this.editingObject?.spec;
    const records = latestFasteners(this.records).filter(
      (s) => !snapshot || `${s.id}:${s.revision}` !== `${snapshot.id}:${snapshot.revision}`,
    );
    if (snapshot) records.unshift(snapshot);
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
    if (resetNut) {
      this.accessoryRows = [];
      this.placeForm.elements.customAccessories.checked = spec?.kind === 'rod';
      this.placeForm.elements.lengthMode.value = spec?.kind === 'bolt' ? 'auto' : 'manual';
      this.assemblyPicker.set(spec);
    }
    this.placeForm.querySelector('[data-nut-offset]').hidden = true;
    this.placeForm.querySelector('[data-washer-nut]').hidden = spec?.kind !== 'bolt';
    const head = this.placeForm.elements.washerHead,
      nut = this.placeForm.elements.washerNut;
    head.disabled = !spec?.washer || spec.head?.kind === 'countersunk';
    nut.disabled = !spec?.washer || spec.kind !== 'bolt';
    if (head.disabled) head.checked = false;
    if (nut.disabled) nut.checked = false;
    this.placeForm.querySelector('[data-washers]').hidden = head.disabled && nut.disabled;
    this.placeForm.querySelector('[data-washer-info]').textContent = spec?.washer
      ? `Ø${spec.washer.innerDiameter} / Ø${spec.washer.outerDiameter} × ${spec.washer.thickness} mm${head.disabled ? ' · plan bricka passar inte försänkt huvud' : ''}`
      : 'Lägg till brickmått i skruvbiblioteket.';
    if (resetNut)
      this.placeForm.elements.nutOffset.value =
        spec?.kind === 'bolt' ? spec.length - spec.nut.thickness : '';
    if (resetNut && !this.editingObject?.id && this.holeRows) {
      this.holeRows = this.holeRows.map((h) => this.defaultHole(h.targetId));
      this.renderHoles();
    }
    this.placeForm.querySelector('[data-spec-info]').textContent = spec
      ? `${spec.standard ? `${spec.standard} · ` : ''}${spec.kind === 'rod' ? 'Gängstång utan huvud' : spec.head?.kind === 'hex' ? 'Sexkantshuvud' : spec.head?.kind === 'countersunk' ? 'Försänkt huvud' : 'Cylindriskt huvud'}${spec.thread ? ` · Gänglängd ${spec.thread.length} mm` : ''}${spec.nut ? ` · Mutter ${spec.nut.acrossFlats} × ${spec.nut.thickness} mm` : ''}${spec.anchor ? ` · Förankring ${spec.anchor.embedment} mm · betongborr Ø${spec.anchor.drillDiameter} / ${spec.anchor.drillDepth} mm` : ''}`
      : 'Skapa först en bibliotekspost om biblioteket är tomt.';
    if (!resetNut) this.assemblyPicker.set(spec, this.assemblyPicker.get());
    this.renderAccessories();
  }
  defaultHole(targetId) {
    const h = defaultHoleForSpec(this.currentSpec(), targetId);
    return boreFeature(h);
  }
  readAccessories() {
    this.accessoryRows = [...this.placeForm.querySelectorAll('[data-accessory-row]')].map(
      (row) => ({
        kind: row.dataset.accessoryRow,
        offset: row.querySelector('input').value.trim()
          ? Number(row.querySelector('input').value)
          : NaN,
      }),
    );
  }
  renderAccessories() {
    const spec = this.currentSpec();
    const f = this.placeForm.elements;
    if (spec?.kind === 'rod') f.customAccessories.checked = true;
    f.customAccessories.disabled = !spec || spec.kind === 'rod';
    const preset = f.assemblyMode.value === 'preset';
    this.placeForm.querySelector('[data-assembly-picker]').hidden = !preset;
    this.placeForm.querySelector('[data-assembly-hint]').hidden = !preset;
    this.placeForm.querySelector('[data-manual-hardware]').hidden = preset;
    if (spec?.kind !== 'bolt') f.lengthMode.value = 'manual';
    f.lengthMode.disabled = spec?.kind !== 'bolt';
    const auto = f.lengthMode.value === 'auto';
    this.placeForm.querySelector('[data-extra-length]').hidden = !auto;
    f.extraLength.disabled = !auto;
    for (const input of this.placeForm.querySelectorAll('[data-accessory-row] input'))
      input.disabled = preset;
    const custom = !preset && f.customAccessories.checked;
    this.placeForm.querySelector('[data-accessories]').hidden = !custom;
    this.placeForm.querySelector('[data-start-allowance]').hidden = spec?.kind !== 'rod';
    f.startAllowance.disabled = spec?.kind !== 'rod' || preset;
    this.placeForm.querySelector('[data-washers]').hidden = custom || !spec?.washer;
    this.placeForm.querySelector('[data-add-nut]').disabled = !hasNut(spec);
    this.placeForm.querySelector('[data-add-washer]').disabled = !spec?.washer;
    const root = this.placeForm.querySelector('[data-accessory-rows]');
    root.replaceChildren();
    (this.accessoryRows || []).forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'fastener-accessory-row';
      row.dataset.accessoryRow = item.kind;
      const label = document.createElement('label');
      label.className = 'field';
      label.textContent = `${item.kind === 'nut' ? 'Mutter' : 'Bricka'} ${index + 1} · läge (mm)`;
      const input = document.createElement('input');
      input.type = 'number';
      input.required = true;
      input.disabled = !custom;
      input.min = '0';
      input.step = 'any';
      input.value = item.offset;
      input.setAttribute('aria-label', label.textContent);
      label.append(input);
      row.append(
        label,
        button('Ta bort', () => {
          this.readAccessories();
          this.accessoryRows.splice(index, 1);
          this.renderAccessories();
          this.previewRange();
        }),
      );
      root.append(row);
    });
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
    this.groupEditor.load(source);
    const f = this.placeForm.elements;
    const previousSpec = this.placeForm.elements.spec.value;
    this.refreshSpecs(source ? null : previousSpec);
    if (!source && !this.currentSpec() && this.specOptions.length) {
      const spec = this.specOptions[0];
      this.placeForm.elements.spec.value = `${spec.id}:${spec.revision}`;
      this.specChanged();
    }
    f.limitLayers.checked = !!source?.insertion?.automatic && !!source.insertion.limited;
    f.drillDepth.value =
      source?.insertion?.depth ||
      (source?.span
        ? Math.hypot(...source.span.end.map((v, i) => v - source.span.start[i]))
        : this.currentSpec()?.length || 100);
    this.placeForm.querySelector('[data-layer-info]').textContent = source?.layerCount
      ? `${source.layerCount} materiallager i förbandet`
      : '';
    this.syncPlacementMode();
    const start = source?.group?.origin ||
        source?.insertion?.start ||
        source?.span?.start ||
        source?.start || [0, 0, 0],
      end = source?.group?.direction ||
        source?.insertion?.direction ||
        source?.span?.end ||
        source?.end || [0, 0, -100];
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
      ? source.holes.map((h) => boreFeature({ ...h, extent: h.extent || 'manual' }))
      : this.getSelection()
          .filter((s) => isPhysical(s) && !isFastener(s))
          .map((s) => this.defaultHole(s.id));
    this.anchor = source?.anchorId ?? this.holeRows[0]?.targetId ?? '';
    this.accessoryRows = source ? fastenerAccessories(source) : [];
    f.customAccessories.checked = source?.accessories != null || this.currentSpec()?.kind === 'rod';
    f.startAllowance.value = source?.startAllowance || 0;
    f.assemblyMode.value = source && !source.assembly ? 'manual' : 'preset';
    this.assemblyPicker.set(
      this.currentSpec(),
      source?.assembly || assemblyDefaults(this.currentSpec() || { kind: 'wood' }),
    );
    f.lengthMode.value =
      source?.lengthMode || (!source && this.currentSpec()?.kind === 'bolt' ? 'auto' : 'manual');
    f.extraLength.value = source?.extraLength ?? 5;
    this.placeForm.querySelector('[data-length-result]').textContent = source
      ? `Vald längd: ${source.spec.length} mm`
      : '';
    if (source?.group) {
      const members = this.getObjects().filter((s) => s.group?.id === source.group.id);
      if (members.length) {
        const lengths = [...new Set(members.map((s) => s.spec.length))].sort((a, b) => a - b);
        this.placeForm.querySelector('[data-length-result]').textContent =
          `${members.length} skruvar · längder: ${lengths.join(', ')} mm`;
      }
    }
    this.placeForm.querySelector('[data-manual-hardware]').open = false;
    this.renderAccessories();
    this.renderHoles();
    this.placeForm.querySelector('[data-delete]').hidden = !source;
    this.placeForm.querySelector('[type=submit]').textContent = source
      ? source.group
        ? 'Modifiera skruvgrupp'
        : 'Spara skruv och hål'
      : 'Skapa skruv';
    this.placeForm.querySelector('[data-delete]').textContent = source?.group
      ? 'Ta bort skruvgrupp'
      : 'Ta bort skruv';
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
      const row = document.createElement('details');
      row.dataset.hole = i;
      row.dataset.boreId = h.id;
      const legend = document.createElement('summary');
      legend.textContent = `${this.getObjects().find((s) => s.id === h.targetId)?.name || 'Saknad del'} · ${h.kind === 'none' ? 'Ingen borrning' : `Ø${h.diameter} · ${h.kind === 'pilot' ? 'Förborrning' : 'Genomgående'}`}${h.layers ? ` · ${h.layers.length} lager` : ''}`;
      row.append(legend);
      const fields = document.createElement('div');
      fields.innerHTML = `<label class="field">Håltyp<select name="holeKind"><option value="none">Ingen borrning</option><option value="pilot">Förborrning / blindhål</option><option value="clearance">Frigång / genomgående</option></select></label><label class="field" data-extent>Omfattning<select name="extent"><option value="span">Automatiskt förband</option><option value="wall">Närmaste vägg / fläns</option><option value="profile">Hela profilen</option><option value="blind">Blindhål från ingångsytan</option><option value="manual">Manuellt startläge och djup</option></select></label><details data-hole-dimensions><summary>Hålmått · mm</summary><p class="inspector-note">Automatiska lägen beräknas vid placering och sparande. Välj manuellt för egna start- och djupmått.</p><div class="coordinates">${numeric('offset', 'Start · mm', h.offset, -1e7)}${numeric('diameter', 'Diameter · mm', h.diameter, 0.001)}${numeric('depth', 'Djup · mm', h.depth, 0.001)}</div><details><summary>Försänkning</summary><div class="dimensions">${numeric('csDiameter', 'Diameter · mm (0 = av)', h.countersink?.diameter || 0)}${numeric('csDepth', 'Djup · mm', h.countersink?.depth || 0)}</div></details></details>`;
      const kind = fields.querySelector('[name=holeKind]');
      kind.value = h.kind;
      const extent = fields.querySelector('[name=extent]');
      extent.value = holeExtent(h);
      const syncDimensions = () => {
        fields.querySelector('[data-extent]').hidden = kind.value === 'none';
        fields.querySelector('[name=offset]').readOnly = extent.value !== 'manual';
        fields.querySelector('[name=depth]').readOnly = !['blind', 'manual'].includes(extent.value);
        fields.querySelector('[data-hole-dimensions]').hidden = kind.value === 'none';
        fields
          .querySelectorAll('input')
          .forEach((input) => (input.disabled = kind.value === 'none'));
      };
      kind.onchange = () => {
        extent.value = kind.value === 'pilot' ? 'blind' : 'profile';
        syncDimensions();
      };
      extent.onchange = () => {
        if (extent.value === 'blind') kind.value = 'pilot';
        else if (extent.value !== 'manual') kind.value = 'clearance';
        syncDimensions();
      };
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
        id: this.holeRows[i].id,
        type: 'bore',
        targetId: this.holeRows[i].targetId,
        kind: row.querySelector('[name=holeKind]').value,
        extent: row.querySelector('[name=extent]').value,
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
  readPlacement(resolve = false) {
    const spec = this.currentSpec();
    if (!spec) throw new Error('Välj en skruv ur biblioteket.');
    this.readHoles();
    this.readAccessories();
    if (!this.holeRows.length) throw new Error('Välj minst ett objekt som ska ingå i förbandet.');
    const f = this.placeForm.elements;
    const start = [0, 1, 2].map((i) => Number(f[`start${i}`].value));
    const direction = [0, 1, 2].map((i) => Number(f[`direction${i}`].value));
    let draft = {
      ...(this.editingObject || {}),
      type: 'fastener',
      spec: structuredClone(spec),
      ...axisPlacement(spec, start, direction),
      placementMode: 'range',
      drillDepth: Number(f.drillDepth.value),
      holes: structuredClone(this.holeRows),
      washers: { head: f.washerHead.checked, nut: f.washerNut.checked },
      anchorId: this.anchor || null,
      accessories:
        f.assemblyMode.value === 'manual' && f.customAccessories.checked
          ? structuredClone(this.accessoryRows)
          : undefined,
      assembly: f.assemblyMode.value === 'preset' ? this.assemblyPicker.get() : undefined,
      lengthMode: f.lengthMode.value,
      extraLength: Number(f.extraLength.value),
      lengthOptions:
        f.lengthMode.value === 'auto'
          ? [
              ...new Map(
                [
                  ...(this.editingObject?.lengthOptions || []),
                  ...latestFasteners(this.records),
                  spec,
                ]
                  .filter((option) => fastenerSeriesKey(option) === fastenerSeriesKey(spec))
                  .map((option) => [`${option.id}:${option.revision}`, option]),
              ).values(),
            ]
          : undefined,
      startAllowance: spec.kind === 'rod' ? Number(f.startAllowance.value) : undefined,
      ...(spec.kind === 'bolt'
        ? {
            nutOffset:
              f.nutOffset.value === ''
                ? spec.length - spec.nut.thickness
                : Number(f.nutOffset.value),
          }
        : { nutOffset: null }),
    };
    delete draft.span;
    delete draft.insertion;
    draft = this.groupEditor.apply(draft, start, direction);
    this.previewBatch = null;
    if (draft.group) {
      draft.groupLimit = f.limitLayers.checked ? Number(f.drillDepth.value) : null;
      if (this.editingObject || this.getOperation()?.mode !== 'fastenerTargets') {
        this.previewBatch = fastenerGroupBatch(draft, this.getObjects());
        draft = this.previewBatch[0];
      }
    } else if (this.editingObject || this.getOperation()?.mode !== 'fastenerTargets')
      draft = automaticPlacement(
        draft,
        start,
        direction,
        this.getObjects(),
        f.limitLayers.checked ? Number(f.drillDepth.value) : null,
      );
    if (resolve && !draft.group) draft = resolveFastenerHoles(draft, this.getObjects());
    this.placeForm.querySelector('[data-length-result]').textContent =
      `${draft.lengthMode === 'auto' ? 'Automatiskt vald längd' : 'Vald längd'}: ${draft.spec.length} mm`;
    if (this.previewBatch) {
      const lengths = [...new Set(this.previewBatch.map((s) => s.spec.length))].sort(
        (a, b) => a - b,
      );
      this.placeForm.querySelector('[data-length-result]').textContent =
        `${this.previewBatch.length} skruvar · längder: ${lengths.join(', ')} mm`;
    }
    const error = validateFastener(draft);
    if (error) throw new Error(error);
    validateFastenerTargets(draft, this.getObjects());
    return draft;
  }
  previewRange() {
    const placing = this.getOperation()?.mode === 'fastenerDepth';
    if (!placing && !this.editingObject) return;
    try {
      const draft = this.readPlacement(true);
      if (placing || draft.group) this.previewPlacement(this.previewBatch || draft);
      else this.previewPlacement(null);
      draft.holes.forEach((h, i) => {
        const summary = this.placeForm.querySelector(`[data-hole="${i}"] > summary`);
        if (summary)
          summary.textContent = `${this.getObjects().find((o) => o.id === h.targetId)?.name || 'Del'} · ${h.kind === 'none' ? 'Ingen borrning' : `Ø${h.diameter} · ${h.kind === 'pilot' ? 'Förborrning' : 'Genomgående'}`} · ${h.layers.length} lager`;
      });
      this.placeForm.querySelector('[data-layer-info]').textContent =
        `${draft.layerCount} materiallager i förbandet`;
      this.placeForm.querySelector('[data-error]').textContent = '';
    } catch (e) {
      if (placing || this.groupEditor.enabled()) this.previewPlacement(null);
      this.placeForm.querySelector('[data-length-result]').textContent = '';
      this.placeForm.querySelector('[data-error]').textContent = e.message;
      this.placeForm.querySelector('[data-layer-info]').textContent = '';
    }
  }
  syncPlacementMode() {
    this.placeForm.querySelector('[data-entry-label]').textContent = 'Insättningspunkt';
    this.placeForm.querySelector('[data-exit-label]').textContent = 'Riktningspunkt';
    const limited = this.placeForm.elements.limitLayers.checked;
    this.placeForm.querySelector('[data-drill-depth]').hidden = !limited;
    this.placeForm.elements.drillDepth.disabled = !limited;
    this.placeForm.elements.drillDepth.required = limited;
  }
  sync(selected, operation) {
    if (selected.length && selected.every((s) => s.generatedBy)) {
      this.panel.hidden = true;
      return;
    }
    const choosing = operation?.mode === 'fastenerTargets';
    const creating = operation?.mode === 'fastenerCreate';
    document
      .getElementById('fastener')
      .setAttribute('aria-pressed', String((creating || choosing) && !this.groupEditor.enabled()));
    document
      .getElementById('fastener-group')
      .setAttribute('aria-pressed', String((creating || choosing) && this.groupEditor.enabled()));
    if (choosing) {
      this.panel.hidden = false;
      this.placeForm.dataset.pickingTargets = '';
      if (this.placeForm.parentElement !== this.panel) this.panel.replaceChildren(this.placeForm);
      document.getElementById('form').hidden = document.getElementById('plate-form').hidden = true;
      document.getElementById('object-heading').textContent = this.groupEditor.enabled()
        ? 'Skruvgrupp · Välj delar'
        : 'Skruv · Välj delar';
      document.getElementById('mode-label').textContent = 'Välj → Enter → Placera';
      this.placeForm.querySelector('[data-select-targets]').hidden = true;
      this.placeForm.querySelector('[data-position]').hidden = true;
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
    if (creating) {
      this.panel.replaceChildren();
      this.panel.hidden = false;
      document.getElementById('form').hidden = document.getElementById('plate-form').hidden = true;
      document.getElementById('object-heading').textContent = operation.draft.group
        ? 'Placera skruvgrupp'
        : 'Placera skruv';
      document.getElementById('mode-label').textContent =
        operation.draft.placementMode === 'range'
          ? 'Insättningspunkt → riktning'
          : 'Under huvud → riktning';
      const p = document.createElement('p');
      p.textContent = `${operation.draft.spec.name} · ${operation.draft.placementMode === 'range' ? 'Välj två punkter längs skruvaxeln. Ytor och hål beräknas automatiskt i valda objekt.' : 'Klicka under huvud och sedan i skruvens riktning.'} Skruvlängd ${operation.draft.spec.length} mm. Escape avbryter.`;
      this.panel.append(p);
      this.panel.inert = false;
      return;
    }
    const source =
      operation?.mode === 'fastenerDepth'
        ? operation.draft
        : selectedFastenerGroup(selected) ||
          (selected.length === 1 && isFastener(selected[0]) ? selected[0] : null);
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
      document.getElementById('object-heading').textContent = source.group
        ? `Skruvgrupp · ${source.group.columns} × ${source.group.rows}`
        : FASTENER_KINDS.find(([kind]) => kind === source.spec.kind)?.[1] || 'Skruv';
      if (source.group) document.getElementById('multi-selection').hidden = true;
    } else {
      this.loadedSource = null;
      this.panel.replaceChildren();
      const shownGroups = new Set();
      for (const s of related) {
        if (s.group && shownGroups.has(s.group.id)) continue;
        if (s.group) shownGroups.add(s.group.id);
        const members = s.group ? related.filter((member) => member.group?.id === s.group.id) : [s];
        const count = holesForPart(selected[0], members).length;
        const name = s.group ? `Skruvgrupp · ${s.group.columns} × ${s.group.rows}` : s.name;
        this.panel.append(
          button(`${name} · ${count ? `${count} kopplade hål` : 'Ingen borrning'}`, () =>
            this.openPlacement(s),
          ),
        );
      }
    }
    this.panel.inert = !!operation && operation.mode !== 'fastenerDepth';
    if (operation?.mode === 'fastenerDepth') {
      this.placeForm.querySelector('[data-delete]').hidden = true;
      this.placeForm.querySelector('[data-select-targets]').hidden = true;
      this.placeForm.querySelector('[type=submit]').textContent = source.group
        ? 'Skapa skruvgrupp'
        : 'Skapa skruv och hål';
      document.getElementById('object-heading').textContent = source.group
        ? 'Skruvgrupp · Kontrollera förband'
        : 'Skruv · Kontrollera förband';
      this.previewRange();
    }
  }
}
