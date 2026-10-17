import { bindInspectorField } from './field-state.js';
import { createMarkChangeButton } from '../ui/mark-change-dialog.js';
import { isPhysical } from '../model-object.js';
import { identityError } from '../object-identity.js';
import { validateSeries, objectSeries } from '../numbering/rules.js';
import { partStatus } from '../part-marks.js';
import { createNumberingSeriesFields, createAttributeRow } from './attributes.js';
import { objectType } from '../model/object-types/index.js';
import { objectNameField, objectIFCClassField } from './object-schemas.js';
import { objectInspectorContext } from './object-context.js';
import { applyObjectDraft } from '../model/object-draft.js';

export function installModelIdentity({ $, actions, controllers, modelEditor, project, tools, ui }) {
  const render = (...args) => actions.render(...args);
  ui.objectDrafts ||= {};
  const context = () =>
    objectInspectorContext({
      selected: project.objects.filter((s) => ui.selectedIds.has(s.id)),
      drawing: tools.drawing,
      operation: tools.operation,
    });
  function applyCreationAttributes(object) {
    return applyObjectDraft(object, ui.objectDrafts[object.type || 'sweep']);
  }
  Object.assign(actions, { selectedPartDrawing, syncIdentity, applyCreationAttributes });
  const nameRow = createAttributeRow(objectNameField);
  const nameInput = nameRow.querySelector('input');
  nameInput.id = 'inspector-name';
  nameInput.maxLength = 200;
  $('inspector-name').closest('label').replaceWith(nameRow);
  nameRow.id = 'inspector-identity';
  const identityFields = document.createElement('div');
  identityFields.id = 'identity-fields';
  identityFields.className = 'dimensions';
  identityFields.innerHTML =
    '<label>Prefix<input id="object-prefix" maxlength="16"></label><label>Löpnummer<input id="object-number" type="number" min="1" step="1"></label>';
  $('inspector-identity').after(identityFields);
  const ifcRow = createAttributeRow(objectIFCClassField);
  const ifcInput = ifcRow.querySelector('select');
  ifcInput.id = 'inspector-ifc-class';
  $('inspector-identity').after(ifcRow);
  const partLabel = document.createElement('div');
  partLabel.className = 'part-mark-row';
  partLabel.innerHTML = '<span>Part mark</span><strong id=object-part-mark></strong>';
  const changeMark = createMarkChangeButton(() => {
    const current = context();
    if (current.mode === 'edit' && current.object)
      controllers.markChange.open({ kind: 'part', id: current.object.id });
  });
  changeMark.setAttribute('aria-label', 'Byt partmark');
  partLabel.append(changeMark);
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
    const current = context();
    if (current.mode === 'create') {
      const draft = {
        ...ui.objectDrafts[current.type],
        name: nameInput.value,
        ...(isPhysical(current.object)
          ? {
              ifcClass: ifcInput.value,
              partSeries: {
                prefix: $('part-series-prefix').value.trim(),
                start: Number($('part-series-start').value),
              },
            }
          : {}),
      };
      ui.objectDrafts[current.type] = draft;
      try {
        applyObjectDraft(current.object, draft);
        $('inspector-error').textContent = '';
      } catch (error) {
        $('inspector-error').textContent = error.message;
      }
      return;
    }
    const source = project.objects.find((s) => s.id === ui.selected);
    if (!source) return;
    const updated = {
        ...source,
        name: nameInput.value.trim(),
        prefix: $('object-prefix').value.trim().toUpperCase(),
        number: Number($('object-number').value),
        ...(isPhysical(source)
          ? {
              ifcClass: ifcInput.value,
              partSeries: {
                prefix: $('part-series-prefix').value.trim(),
                start: Number($('part-series-start').value),
              },
            }
          : {}),
      },
      error = !updated.name ? 'Ange ett namn.' : identityError(updated, project.objects);
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
    const same =
      updated.name === source.name &&
      (!isPhysical(source) ||
        updated.ifcClass === (source.ifcClass || objectType(source).ifcClass)) &&
      updated.prefix === source.prefix &&
      updated.number === source.number &&
      (!isPhysical(source) ||
        ['prefix', 'start'].every(
          (key) => objectSeries(source)[key] === objectSeries(updated)[key],
        ));
    if (error || seriesError || same) return;
    controllers.inspector?.finish();
    modelEditor.update([updated]);
    render();
  };
  ifcRow.addEventListener('input', (e) => e.stopPropagation());
  ifcRow.addEventListener('change', commitIdentity);
  identityFields.addEventListener('change', commitIdentity);
  identityFields.addEventListener('focusout', commitIdentity);
  identityFields.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitIdentity(e);
    }
  });
  // The same name control edits a detached draft or the selected object transaction.
  nameRow.addEventListener('input', (e) => {
    e.stopPropagation();
    if (context().mode === 'create') commitIdentity(e);
  });
  nameRow.addEventListener('change', commitIdentity);
  nameRow.addEventListener('focusout', commitIdentity);
  nameRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitIdentity(e);
    }
    if (e.key === 'Escape' && context().mode === 'edit') {
      e.preventDefault();
      e.stopPropagation();
      nameInput.value = context().object.name;
      $('inspector-error').textContent = '';
    }
  });
  identityFields.addEventListener('input', (e) => {
    if (context().mode === 'create') commitIdentity(e);
  });
  bindInspectorField(nameInput, () => context().object?.name ?? nameInput.value);
  bindInspectorField(
    ifcInput,
    () =>
      context().object?.ifcClass ||
      (context().object && objectType(context().object).ifcClass) ||
      '',
  );
  for (const key of ['prefix', 'start'])
    bindInspectorField($(`part-series-${key}`), () =>
      context().object ? objectSeries(context().object)[key] : $(`part-series-${key}`).value,
    );
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
    const current = context(),
      creating = current.mode === 'create';
    const s = current.object;
    const physical = s && isPhysical(s);
    ifcRow.hidden = !physical;
    ifcInput.disabled = current.locked;
    if (physical)
      ifcInput.value =
        (creating ? ui.objectDrafts[current.type]?.ifcClass : s.ifcClass) || objectType(s).ifcClass;
    root.classList.toggle('dimensions', !physical);
    root.hidden = !s || (creating && !physical);
    const section = root.closest('[data-attribute-section="identity"]');
    if (section) section.hidden = root.hidden;
    nameRow.hidden = !s;
    nameInput.disabled = current.locked;
    nameInput.placeholder = creating ? 'Automatiskt namn' : '';
    if (s && document.activeElement !== nameInput)
      nameInput.value = creating ? ui.objectDrafts[current.type]?.name || '' : s.name || '';
    $('mode-label').hidden = !!s && isPhysical(s);
    root.inert = current.locked;
    changeMark.hidden = creating || !physical;
    changeMark.disabled =
      !s ||
      creating ||
      current.locked ||
      !!tools.operation ||
      !partStatus(s, project.objects, project.parts).valid;
    const shortcut = $('inspector-open-drawing'),
      record = selectedPartDrawing();
    if (shortcut) {
      shortcut.hidden = !record;
      shortcut.disabled = !!tools.operation;
      shortcut.textContent = record ? `Öppna ritning · ${record.number}` : 'Öppna ritning';
    }
    if (s) {
      $('object-part-mark').textContent = !physical
        ? ''
        : creating
          ? 'Ej numrerad'
          : partStatus(s, project.objects, project.parts).label;
      $('object-prefix').value = s.prefix || '';
      $('object-number').value = s.number || '';
      $('object-prefix').closest('label').hidden = physical;
      $('object-number').closest('label').hidden = physical;
      partLabel.hidden = partSeriesFields.hidden = !physical;
      const series = creating
        ? ui.objectDrafts[current.type]?.partSeries || objectSeries(s)
        : objectSeries(s);
      for (const key of ['prefix', 'start'])
        if (document.activeElement !== $(`part-series-${key}`))
          $(`part-series-${key}`).value = series[key];
    }
  }
}
