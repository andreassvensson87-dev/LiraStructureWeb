import { parsePositions } from '../grid-lines.js';
import { FRAME_EXAMPLE_SIZES, frameExampleCounts } from '../project/frame-example.js';
export function createSettingsController({
  project,
  checkpoint,
  onClose,
  onGridChanged,
  onChange,
  libraries = [],
  loadExample,
}) {
  const $ = (id) => document.getElementById(id);
  if (loadExample) {
    const section = document.createElement('section');
    section.innerHTML =
      '<h3>Exempelmodeller</h3><p>Stålstomme med pelare, I-balkar, bjälklag, väggpaneler, grundplintar och skruvförband. Demonstrationsmått för funktion och prestanda.</p><label class="field">Storlek<select data-example-size></select></label><p data-example-count></p><button type="button" class="primary" data-load-frame>Läs in stommodell</button><details><summary>Mindre skruvexempel</summary><p>Tre förband: trä, plåt och rör. 17 objekt.</p><button type="button" data-load-example>Läs in skruvexempel</button></details><p>Modellen ersätts vid inläsning. Du kan återställa den med Ångra. Stora modeller kan ta längre tid att bygga upp.</p>';
    const sizeSelect = section.querySelector('[data-example-size]');
    for (const size of FRAME_EXAMPLE_SIZES)
      sizeSelect.append(
        new Option(`${size.name} · ${size.x * 6} × ${size.y * 6} m · ${size.floors} plan`, size.id),
      );
    sizeSelect.value = 'small';
    const updateCount = () => {
      const counts = frameExampleCounts(FRAME_EXAMPLE_SIZES.find((s) => s.id === sizeSelect.value));
      section.querySelector('[data-example-count]').textContent =
        `${counts.objects.toLocaleString('sv-SE')} objekt · ${counts.screws.toLocaleString('sv-SE')} skruvar · ${counts.holes.toLocaleString('sv-SE')} borrhål`;
    };
    sizeSelect.onchange = updateCount;
    updateCount();
    document.querySelector('[data-settings-panel="project"]').append(section);
    const load = async (kind, button) => {
      button.disabled = true;
      $('settings-error').textContent = 'Bygger exempelmodellen…';
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
      try {
        const result = loadExample(kind, sizeSelect.value);
        fillSettings();
        $('settings-dialog').close();
        $('status').textContent = `${result} · Ångra återställer föregående modell`;
      } catch (error) {
        $('settings-error').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    section.querySelector('[data-load-example]').onclick = (e) =>
      load('fasteners', e.currentTarget);
    section.querySelector('[data-load-frame]').onclick = (e) => load('frame', e.currentTarget);
  }
  if (libraries.length) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.dataset.settings = 'libraries';
    tab.setAttribute('aria-pressed', 'false');
    tab.textContent = 'Bibliotek';
    document.querySelector('.settings-nav').append(tab);
    const panel = document.createElement('section');
    panel.dataset.settingsPanel = 'libraries';
    panel.hidden = true;
    panel.className = 'settings-libraries';
    for (const group of new Set(libraries.map((library) => library.group))) {
      const heading = document.createElement('h3');
      heading.textContent = group;
      panel.append(heading);
      for (const library of libraries.filter((entry) => entry.group === group)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'settings-library';
        const title = document.createElement('strong');
        title.textContent = library.name;
        const description = document.createElement('span');
        description.textContent = library.description;
        const arrow = document.createElement('span');
        arrow.className = 'settings-library-arrow';
        arrow.textContent = '↗';
        arrow.setAttribute('aria-hidden', 'true');
        button.append(title, description, arrow);
        button.onclick = library.open;
        panel.append(button);
      }
    }
    $('settings-error').before(panel);
  }
  function settingsCategory(name) {
    document
      .querySelectorAll('[data-settings]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.settings === name)));
    document
      .querySelectorAll('[data-settings-panel]')
      .forEach((p) => (p.hidden = p.dataset.settingsPanel !== name));
    document.querySelector('.settings-actions').hidden = name === 'libraries';
  }
  document
    .querySelectorAll('[data-settings]')
    .forEach((b) => (b.onclick = () => settingsCategory(b.dataset.settings)));
  function fillSettings() {
    $('grid-x').value = project.grid.x.join(' ');
    $('grid-y').value = project.grid.y.join(' ');
    $('snap-endpoints').checked = project.snap.endpoints;
    $('snap-axes').checked = project.snap.axes;
    $('snap-polar').value = project.snap.polar;
    $('snap-rotation').value = project.snap.rotation ?? '15';
    for (const key of [
      'corners',
      'quadrants',
      'midpoints',
      'perpendicular',
      'gridLines',
      'gridIntersections',
      'gridStepEnabled',
    ])
      $('snap-' + key).checked = project.snap[key];
    $('snap-gridStep').value = project.snap.gridStep;
    $('snap-gridStep').disabled = !project.snap.gridStepEnabled;
    for (const key of ['name', 'number', 'client']) $('project-' + key).value = project.info[key];
    document.title = project.info.name ? `${project.info.name} · LiraStructure` : 'LiraStructure';
  }
  $('snap-gridStepEnabled').onchange = () =>
    ($('snap-gridStep').disabled = !$('snap-gridStepEnabled').checked);
  $('settings-open').onclick = () => {
    fillSettings();
    $('settings-error').textContent = '';
    $('settings-dialog').showModal();
  };
  $('settings-close').onclick = $('settings-cancel').onclick = () => $('settings-dialog').close();
  $('settings-dialog').addEventListener('close', () => {
    fillSettings();
    onClose();
  });
  $('settings-form').onsubmit = (e) => {
    e.preventDefault();
    let next;
    try {
      next = { x: parsePositions($('grid-x').value), y: parsePositions($('grid-y').value) };
    } catch (error) {
      settingsCategory('grid');
      $('settings-error').textContent = error.message;
      return;
    }
    const step = Number($('snap-gridStep').value);
    if (
      $('snap-gridStepEnabled').checked &&
      (!Number.isFinite(step) || step < 0.001 || step > 100000)
    ) {
      settingsCategory('snap');
      $('settings-error').textContent = 'Rutsteget måste vara 0,001–100 000 mm.';
      return;
    }
    const gridChanged = JSON.stringify(next) !== JSON.stringify(project.grid);
    checkpoint();
    project.grid = next;
    project.info = Object.fromEntries(
      ['name', 'number', 'client'].map((key) => [key, $('project-' + key).value.trim()]),
    );
    project.snap = {
      ...Object.fromEntries(
        [
          'corners',
          'quadrants',
          'midpoints',
          'perpendicular',
          'gridLines',
          'gridIntersections',
          'gridStepEnabled',
        ].map((key) => [key, $('snap-' + key).checked]),
      ),
      gridStep: Number.isFinite(step) && step > 0 ? step : 100,
      endpoints: $('snap-endpoints').checked,
      axes: $('snap-axes').checked,
      polar: $('snap-polar').value,
      rotation: $('snap-rotation').value,
    };
    if (gridChanged) {
      onGridChanged();
    }
    onChange();
    $('settings-dialog').close();
    $('status').textContent = 'Inställningar uppdaterade';
  };
  return { fill: fillSettings };
}
