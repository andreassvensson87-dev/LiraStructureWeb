import { isPhysical } from '../model-object.js';
import { identityError } from '../object-identity.js';
import { validateSeries, objectSeries } from '../numbering/rules.js';
import { partStatus } from '../part-marks.js';
import { createNumberingSeriesFields } from './attributes.js';

export function installModelIdentity({ $, actions, controllers, modelEditor, project, tools, ui }) {
  const render = (...args) => actions.render(...args);
  Object.assign(actions, { selectedPartDrawing, syncIdentity });
  const identityFields = document.createElement('div');
  identityFields.id = 'identity-fields';
  identityFields.className = 'dimensions';
  identityFields.innerHTML =
    '<label>Prefix<input id="object-prefix" maxlength="16"></label><label>Löpnummer<input id="object-number" type="number" min="1" step="1"></label>';
  $('inspector-identity').after(identityFields);
  const partLabel = document.createElement('div');
  partLabel.className = 'part-mark-row';
  partLabel.innerHTML = '<span>Part mark</span><strong id=object-part-mark></strong>';
  identityFields.append(partLabel);
  const { root: partSeriesFields } = createNumberingSeriesFields({
    prefix: '',
    start: 1,
    scope: 'Part',
    idPrefix: 'part-series',
  });
  identityFields.append(partSeriesFields);
  $('object-prefix').parentElement.firstChild.textContent = 'Objektprefix';
  identityFields.addEventListener('input', (e) => e.stopPropagation());
  const commitIdentity = (e) => {
    e.stopPropagation();
    const source = project.objects.find((s) => s.id === ui.selected);
    if (!source) return;
    const updated = {
        ...source,
        prefix: $('object-prefix').value.trim().toUpperCase(),
        number: Number($('object-number').value),
        ...(isPhysical(source)
          ? {
              partSeries: {
                prefix: $('part-series-prefix').value.trim(),
                start: Number($('part-series-start').value),
              },
            }
          : {}),
      },
      error = identityError(updated, project.objects);
    $('inspector-error').textContent = error;
    let seriesError = '';
    try {
      if (isPhysical(source)) {
        validateSeries(updated.partSeries);
      }
    } catch (problem) {
      seriesError = problem.message;
    }
    $('inspector-error').textContent = error || seriesError;
    if (error || seriesError || JSON.stringify(source) === JSON.stringify(updated)) return;
    controllers.inspector?.finish();
    modelEditor.update([updated]);
    render();
  };
  identityFields.addEventListener('change', commitIdentity);
  identityFields.addEventListener('focusout', commitIdentity);
  identityFields.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitIdentity(e);
    }
  });
  const openPartDrawing = document.createElement('button');
  openPartDrawing.id = 'inspector-open-drawing';
  openPartDrawing.type = 'button';
  openPartDrawing.hidden = true;
  $('inspector-properties').querySelector('.panel-title').after(openPartDrawing);
  function selectedPartDrawing() {
    const object =
      ui.selectedIds.size === 1 ? project.objects.find((s) => s.id === ui.selected) : null;
    if (!object || !isPhysical(object)) return null;
    const status = partStatus(object, project.objects, project.parts);
    if (!status.valid) return null;
    const record = project.drawings.find((d) => d.type === 'SP' && d.partKey === status.key);
    return record ? { ...record, sourceId: object.id } : null;
  }
  openPartDrawing.onclick = () => {
    controllers.inspector?.finish();
    const record = selectedPartDrawing();
    if (record) controllers.drawingManager.open(record);
    else syncIdentity();
  };
  function syncIdentity() {
    const root = $('identity-fields');
    if (!root) return;
    const s = project.objects.find((s) => s.id === ui.selected);
    root.hidden = !s;
    $('mode-label').hidden = !!s && isPhysical(s);
    root.inert = !!tools.operation;
    const shortcut = $('inspector-open-drawing'),
      record = selectedPartDrawing();
    if (shortcut) {
      shortcut.hidden = !record;
      shortcut.disabled = !!tools.operation;
      shortcut.textContent = record ? `Öppna ritning · ${record.number}` : 'Öppna ritning';
    }
    if (s) {
      $('object-part-mark').textContent = !isPhysical(s)
        ? ''
        : partStatus(s, project.objects, project.parts).label;
      $('object-prefix').value = s.prefix || '';
      $('object-number').value = s.number || '';
      const physical = isPhysical(s);
      $('object-prefix').closest('label').hidden = physical;
      $('object-number').closest('label').hidden = physical;
      partLabel.hidden = partSeriesFields.hidden = !physical;
      const series = objectSeries(s);
      for (const key of ['prefix', 'start']) $(`part-series-${key}`).value = series[key];
    }
  }
}
