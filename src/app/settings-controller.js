import { parsePositions } from '../grid-lines.js';
export function createSettingsController({
  project,
  checkpoint,
  onClose,
  onGridChanged,
  onChange,
}) {
  const $ = (id) => document.getElementById(id);
  function settingsCategory(name) {
    document
      .querySelectorAll('[data-settings]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.settings === name)));
    document
      .querySelectorAll('[data-settings-panel]')
      .forEach((p) => (p.hidden = p.dataset.settingsPanel !== name));
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
