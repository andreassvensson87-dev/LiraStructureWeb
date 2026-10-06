import { inputDevice, setInputDevice, zoomSpeed, setZoomSpeed } from '../input-device.js';
import { parsePositions } from '../grid-lines.js';
import { createGridLabelEditor } from './grid-label-editor.js';
import { validateGridLabels } from '../grid-labels.js';
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
  const gridLabelEditor = createGridLabelEditor(
    document.querySelector('[data-settings-panel="grid"]'),
  );
  const navigationButton = document.createElement('button');
  navigationButton.type = 'button';
  navigationButton.dataset.settings = 'navigation';
  navigationButton.setAttribute('aria-pressed', 'false');
  navigationButton.textContent = 'Navigering';
  document.querySelector('.settings-nav').append(navigationButton);
  const navigationPanel = document.createElement('section');
  navigationPanel.dataset.settingsPanel = 'navigation';
  navigationPanel.hidden = true;
  navigationPanel.innerHTML =
    '<label class=field>Inmatningsenhet<select id=input-device aria-label="Inmatningsenhet"><option value=mouse>Mus med scrollhjul</option><option value=trackpad>Trackpad</option></select></label><label class=field>Zoomhastighet<input id=zoom-speed aria-label="Zoomhastighet" type=range min=25 max=400 step=5 value=100></label><output id=zoom-speed-value for=zoom-speed></output><button type=button id=zoom-speed-reset>Återställ zoomhastighet</button>';
  $('settings-error').before(navigationPanel);
  const updateZoomLabel = () => {
    $('zoom-speed-value').textContent = `${$('zoom-speed').value} %`;
  };
  $('zoom-speed').oninput = updateZoomLabel;
  $('zoom-speed-reset').onclick = () => {
    $('zoom-speed').value = 100;
    updateZoomLabel();
  };
  if (loadExample) {
    const section = document.createElement('section');
    section.innerHTML =
      '<h3>Exempelmodeller</h3><label class="field">Storlek<select data-example-size></select></label><p data-example-count></p><button type="button" class="primary" data-load-frame>Läs in stommodell</button>';
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
    const load = async (button) => {
      button.disabled = true;
      $('settings-error').textContent = 'Bygger exempelmodellen…';
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
      try {
        const result = loadExample(sizeSelect.value);
        fillSettings();
        $('settings-dialog').close();
        $('status').textContent = `${result} · Ångra återställer föregående modell`;
      } catch (error) {
        $('settings-error').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    section.querySelector('[data-load-frame]').onclick = (e) => load(e.currentTarget);
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
        const arrow = document.createElement('span');
        arrow.className = 'settings-library-arrow';
        arrow.textContent = '↗';
        arrow.setAttribute('aria-hidden', 'true');
        button.append(title, arrow);
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
    $('zoom-speed').value = zoomSpeed() * 100;
    updateZoomLabel();
    $('input-device').value = inputDevice();
    $('grid-x').value = project.grid.x.join(' ');
    $('grid-y').value = project.grid.y.join(' ');
    gridLabelEditor.fill(project.grid);
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
      next = gridLabelEditor.read({
        x: parsePositions($('grid-x').value),
        y: parsePositions($('grid-y').value),
      });
      validateGridLabels(next);
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
    setInputDevice($('input-device').value);
    setZoomSpeed(Number($('zoom-speed').value) / 100);
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
