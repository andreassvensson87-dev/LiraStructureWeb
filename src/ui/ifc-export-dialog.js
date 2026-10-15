import { installDialogPresentation } from './dialog-presentation.js';
/** A task dialog built from the same Settings rows, tabs, disclosures and footer. */
export function createIFCExportDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'ifc-export-dialog';
  dialog.setAttribute('aria-labelledby', 'ifc-export-title');
  dialog.innerHTML = `<form>
    <div class="panel-title"><h2 id="ifc-export-title">Exportera IFC</h2><button type="button" data-close aria-label="Stäng IFC-export">×</button></div>
    <nav class="settings-nav" aria-label="IFC-exportkategorier"><button type="button" data-tab="export" aria-pressed="true">Export</button><button type="button" data-tab="settings" aria-pressed="false">Inställningar</button></nav>
    <section data-panel="export">
      <label class="field">Filnamn<input data-filename aria-label="IFC-filnamn" maxlength="120" required></label>
      <label class="field">Omfattning<select data-scope aria-label="Exportens omfattning"><option value="all">Hela modellen</option><option value="visible">Synliga objekt</option><option value="selected">Markerade objekt</option></select></label>
      <label class="field">Format<select aria-label="IFC-format" disabled><option>IFC4</option></select></label>
      <label class="field">Koordinater<select data-coordinates aria-label="Exportens koordinater"><option value="local">Lokala modellkoordinater</option><option value="map">Verkliga koordinater · aktiv baspunkt</option></select></label>
      <p class="inspector-note" data-base></p>
      <h3>Innehåll</h3>
      <label class="setting-toggle"><span>Material och färger</span><input type="checkbox" data-materials checked></label>
      <label class="setting-toggle"><span>Part- och assemblyegenskaper</span><input type="checkbox" data-properties checked></label>
      <label class="setting-toggle"><span>Assemblystruktur</span><input type="checkbox" data-assemblies checked></label>
      <label class="setting-toggle"><span>Skruvar</span><input type="checkbox" data-fasteners></label>
      <p class="inspector-note">Referensmodeller ingår inte.</p>
    </section>
    <section data-panel="settings" hidden>
      <h3>Geometri</h3><label class="field">Representation<select data-geometry aria-label="Geometrirepresentation"><option value="auto">Automatisk · profiler och slutgeometri</option><option value="final">Slutgeometri för alla delar</option></select></label><p>Profiler och extrusioner för raka, oskurna delar. Övriga delar använder slutgeometrin med kapningar och hål.</p>
      <h3>Koordinater</h3><p>Verkliga koordinater lagras som georeferering till projektets aktiva baspunkt. Geometrin behåller lokala koordinater.</p>
      <p>Plansystem, höjdsystem och baspunkter ändras under Inställningar → Koordinater.</p>
      <h3>Identiteter</h3><p>IFC-identiteter behålls för samma projekt och objekt vid upprepad export. Numreringen ändras inte av exporten.</p>
    </section>
    <section class="ifc-export-check"><div class="ifc-export-check-heading"><h3>Kontroll</h3><button type="button" data-check>Kontrollera igen</button></div><p data-summary role="status"></p><progress data-progress hidden></progress><div data-issues></div></section>
    <p data-error role="alert"></p><div data-download></div>
    <div class="settings-actions"><button type="button" data-cancel>Avbryt</button><button type="submit" class="primary" data-export>Exportera</button></div>
  </form>`;
  document.body.append(dialog);
  installDialogPresentation(dialog);
  const $ = (s) => dialog.querySelector(s);
  function report(data) {
    $('[data-check]').textContent = 'Kontrollera igen';
    const issues = $('[data-issues]');
    issues.replaceChildren();
    const errors = data.issues.filter((i) => i.severity === 'error'),
      warnings = data.issues.filter((i) => i.severity === 'warning');
    $('[data-summary]').textContent =
      `${data.parts} delar · ${data.assemblies} assemblies · ${errors.length} fel · ${warnings.length} anmärkningar`;
    const groups = new Map();
    for (const issue of data.issues) {
      const key = issue.severity + ':' + issue.code;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(issue);
    }
    for (const entries of groups.values()) {
      const details = document.createElement('details'),
        summary = document.createElement('summary');
      summary.textContent = `${entries[0].severity === 'error' ? 'Fel' : 'Anmärkning'} · ${entries.length} · ${entries[0].message}`;
      const list = document.createElement('ul');
      for (const issue of entries.slice(0, 100)) {
        const row = document.createElement('li');
        row.textContent = `${issue.name || issue.id || ''}${issue.code === 'object' ? ' · ' + issue.message : ''}`;
        list.append(row);
      }
      if (entries.length > 100) {
        const more = document.createElement('li');
        more.textContent = `Visar de första 100 av ${entries.length} objekt.`;
        list.append(more);
      }
      details.append(summary, list);
      issues.append(details);
    }
    $('[data-export]').disabled = !!errors.length;
  }

  return { dialog, report, form: dialog.querySelector('form'), $: (s) => dialog.querySelector(s) };
}
