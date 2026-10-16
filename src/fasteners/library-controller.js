import { withDefaultFasteners } from './default-catalog.js';
import {
  renderFastenerLibrary,
  renderFastenerSpec,
  syncFastenerHardwareFields,
  syncFastenerHoleFields,
} from './library-inspector.js';
import { installFloatingWindow } from '../ui/floating-window.js';
import { installLibraryWorkspace } from '../ui/library-workspace.js';
import {
  FASTENER_LIBRARY_KEY,
  FASTENER_KINDS,
  FASTENER_STANDARDS,
  hasNut,
  latestFasteners,
  mergeFasteners,
  validateFastenerLibrary,
  validateFastenerSpec,
} from './library.js';
const numeric = (name, label, value, min = 0) =>
  `<label class="field">${label}<input name="${name}" type="number" step="any" min="${min}" value="${value}" required></label>`;
const button = (text, action) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = action;
  return b;
};

/** Owns library records, versions, persistence and its existing shared window. */
export class FastenerLibraryController {
  constructor({ useSpec, closed }) {
    this.useSpec = useSpec;
    this.records = withDefaultFasteners();
    try {
      const raw = localStorage.getItem(FASTENER_LIBRARY_KEY);
      if (raw) this.records = withDefaultFasteners(validateFastenerLibrary(JSON.parse(raw)));
    } catch (e) {
      this.loadError = e.message;
    }
    this.library = document.createElement('dialog');
    this.library.id = 'fastener-library';
    this.library.setAttribute('aria-labelledby', 'fastener-library-title');
    this.library.innerHTML = `
      <div class="panel-title"><div><h2 id="fastener-library-title">Skruvbibliotek</h2><span class="fastener-subtitle">Grundsortiment och egna skruvar · mm</span></div><button type="button" data-close aria-label="Stäng skruvbibliotek">×</button></div>
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
    this.window = installFloatingWindow(this.library);
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
        this.editForm.elements.kind.value =
          this.editForm.elements.standard.value === 'DIN 976-1' ? 'rod' : 'bolt';
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
    this.library.addEventListener('close', closed);
    const edit = button('Redigera', () => {});
    const use = button(
      'Använd',
      () => {
        if (!this.editingSpec) return;
        this.useSpec(this.editingSpec);
        this.library.close();
      },
      'primary',
    );
    use.className = 'primary';
    const preview = document.createElement('div');
    preview.className = 'ui-fastener-preview';
    preview.innerHTML =
      '<svg viewBox="0 0 300 160" aria-label="Skruvens mått"><path d="M55 55h30v50H55Z M85 65h150v30H85Z M95 65l12 30m0-30 12 30m0-30 12 30m0-30 12 30m0-30 12 30m0-30 12 30m0-30 12 30m0-30 12 30m0-30 12 30m0-30 12 30"/><text x="160" y="135" text-anchor="middle"></text></svg>';
    this.editForm.querySelector('.fastener-edit-heading').after(preview);
    this.libraryUI = installLibraryWorkspace(this.library, {
      search: this.library.querySelector('[data-search]'),
      tree: this.library.querySelector('[data-records]'),
      details: this.editForm,
      form: this.editForm,
      save: this.editForm.querySelector('[type=submit]'),
      edit,
      use,
      refresh: () => this.renderLibrary(),
      commands: [
        { node: this.library.querySelector('[data-new]'), label: 'Ny' },
        { node: this.library.querySelector('[data-import]'), label: 'Importera' },
        { node: this.library.querySelector('[data-export]'), label: 'Exportera' },
      ],
      message: this.library.querySelector('[data-error]'),
    });
    this.library.querySelector('.fastener-library-layout').remove();
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
    if (!this.editingSpec) this.editSpec(latestFasteners(this.records)[0] || null);
    this.renderLibrary();
    this.library.querySelector('[data-error]').textContent = this.loadError || '';
    this.window.open();
  }
  renderLibrary() {
    return renderFastenerLibrary({
      library: this.library,
      records: this.records,
      editingSpec: this.editingSpec,
      editSpec: this.editSpec.bind(this),
      renderLibrary: this.renderLibrary.bind(this),
    });
  }
  editSpec(spec) {
    this.editingSpec = spec;
    return renderFastenerSpec(
      {
        editForm: this.editForm,
        library: this.library,
        syncHoleDefaults: this.syncHoleDefaults.bind(this),
        libraryUI: this.libraryUI,
        syncNut: this.syncNut.bind(this),
      },
      spec,
    );
  }
  syncNut() {
    return syncFastenerHardwareFields({ editForm: this.editForm, library: this.library });
  }
  syncHoleDefaults() {
    return syncFastenerHoleFields({ editForm: this.editForm, library: this.library });
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
}
