/** Settings presentation uses the existing dialog attribute rows and coordinate groups. */
export function createCoordinateSettings() {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.dataset.settings = 'coordinates';
  tab.textContent = 'Koordinater';
  tab.setAttribute('aria-pressed', 'false');
  const panel = document.createElement('section');
  panel.dataset.settingsPanel = 'coordinates';
  panel.hidden = true;
  panel.innerHTML = `
    <h3>Koordinatsystem</h3>
    <label class="field">Plansystem<select data-crs aria-label="Plansystem"><option value="">Ej angivet</option><option value="EPSG:3006">SWEREF 99 TM</option><option value="custom">Annat koordinatsystem…</option></select></label>
    <label class="field" data-custom-crs-row hidden>CRS-beteckning<input data-custom-crs maxlength="200" placeholder="EPSG:…" aria-label="CRS-beteckning"></label>
    <label class="field">Höjdsystem<select data-datum aria-label="Höjdsystem"><option value="">Ej angivet</option><option value="RH2000">RH 2000</option><option value="custom">Annat höjdsystem…</option></select></label>
    <label class="field" data-custom-datum-row hidden>Höjdsystemets namn<input data-custom-datum maxlength="200" aria-label="Höjdsystemets namn"></label>
    <h3>Baspunkter</h3>
    <div class="coordinate-base-choice"><label class="field">Baspunkt<select data-base aria-label="Baspunkt"></select></label><button type="button" data-add>Ny</button><button type="button" data-delete>Ta bort</button></div>
    <div data-base-fields>
      <label class="field">Namn<input data-base-name maxlength="120" aria-label="Baspunktens namn"></label>
      <label class="setting-toggle"><span>Aktiv för referenser och export</span><input type="checkbox" data-active aria-label="Aktiv för referenser och export"></label>
      <h4>Lokal punkt · mm</h4><div class="coordinate-pick-row"><div class="coordinate-grid" data-local></div><button type="button" data-pick>Välj punkt</button></div>
      <h4>Verkliga koordinater · m</h4><div class="coordinate-grid" data-map></div>
      <label class="field">Rotation · °<input data-rotation type="text" inputmode="decimal" aria-label="Baspunktens rotation" title="Moturs från kartans östaxel till modellens X-axel, sett ovanifrån"></label>
    </div>
    <p class="inspector-note" data-empty>Skapa en baspunkt för att koppla lokala och verkliga koordinater.</p>`;
  const systems = document.createElement('div');
  systems.className = 'coordinate-grid coordinate-crs-grid';
  panel.querySelector('h3').after(systems);
  systems.append(
    panel.querySelector('[data-crs]').closest('label'),
    panel.querySelector('[data-datum]').closest('label'),
  );
  for (const [key, labels] of [
    ['local', ['X', 'Y', 'Z']],
    ['map', ['Öst (E)', 'Nord (N)', 'Höjd (H)']],
  ]) {
    const group = panel.querySelector(`[data-${key}]`);
    labels.forEach((label, i) => {
      const row = document.createElement('label');
      row.className = 'field';
      row.textContent = label;
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.dataset.coordinate = `${key}-${i}`;
      input.setAttribute('aria-label', `${key === 'local' ? 'Lokal' : 'Verklig'} ${label}`);
      row.append(input);
      group.append(row);
    });
  }
  return { tab, panel };
}
