import { mountAttributeLayout } from './attributes.js';
import { objectInspectorSchemas } from './object-schemas.js';
import {
  modelPropertyFields,
  modelPropertyType,
  applyModelProperties,
  prepareModelPropertyTransfer,
} from '../model/property-transfer.js';
import { propertyValues, commonPropertyValues } from '../property-transfer.js';
import { fastenerPropertySource } from '../fasteners/property-transfer.js';
import { selectedFastenerGroup } from '../fasteners/group-data.js';
import { createPropertyActions } from './property-actions.js';
import { createCreationDefaults } from './creation-defaults.js';
import { validateObject } from '../model-object.js';

export function installModelPropertyCopy({
  $,
  actions,
  controllers,
  modelEditor,
  project,
  tools,
  ui,
}) {
  const defaults = createCreationDefaults(localStorage);
  for (const type of ['sweep', 'polysweep', 'plate', 'item', 'fastener']) {
    const stored = defaults.get(type);
    ui.objectDrafts[type] = {
      ...Object.assign(
        {},
        ...['name', 'series', 'ifcClass', 'material', 'color'].map((key) => stored[key] || {}),
      ),
      ...ui.objectDrafts[type],
    };
  }
  const layouts = Object.values(objectInspectorSchemas).map((schema) => ({
    schema,
    layout: mountAttributeLayout($('inspector-properties'), schema),
  }));
  const locked = new Map();
  let sourceReference = null;
  let source = null,
    values = {},
    keys = [],
    previewSignature = '';
  const selection = () => {
    const items = actions.inspectorSelection();
    const owners = items.map(
      (o) => o.generatedBy && project.objects.find((owner) => owner.id === o.generatedBy),
    );
    if (source?.type === 'component') return [...new Set(items.map((o, i) => owners[i] || o))];
    if (owners.length && owners.every((o) => o && o === owners[0])) return [owners[0]];
    return items;
  };
  const representative = (items) =>
    selectedFastenerGroup(items) || (items.length === 1 ? items[0] : null);
  const current = () => {
    if (controllers.inspector.session?.error) throw Error(controllers.inspector.session.error);
    if (selection()[0]?.type === 'component' && selection().length === 1)
      return [controllers.componentUI.draft() || selection()[0]];
    const items = controllers.inspector
      .editingObjects()
      .map((o) => actions.readInspectorIdentity?.(o) || o);
    const first = representative(items);
    if (first?.type === 'fastener') return [controllers.fastenerUI.readPlacement()];
    if (first?.type === 'component') return [controllers.componentUI.draft() || first];
    return items;
  };
  const targets = () => {
    const seen = new Set();
    return selection().filter((o) => {
      const id = o.group?.id || o.id;
      if (seen.has(id) || id === (source?.group?.id || source?.id)) return false;
      seen.add(id);
      if (
        (o.type === 'component' || source?.type === 'component') &&
        (o.type !== source?.type || o.kind !== source.kind)
      )
        return false;
      return modelPropertyFields(o).some((field) => keys.includes(field.key) && values[field.key]);
    });
  };
  const prepare = () =>
    prepareModelPropertyTransfer({
      objects: project.objects,
      source,
      targets: targets(),
      values,
      keys,
    });
  function cancel() {
    source = null;
    previewSignature = '';
    actions.cancelInspectorPreview();
    sync();
    actions.render();
  }
  const bar = createPropertyActions({
    copy() {
      const items = current();
      const first = representative(items);
      if (!first) throw Error('Välj ett källobjekt.');
      source = structuredClone(first);
      sourceReference = project.objects.find((o) => o.id === source.id);
      const properties = fastenerPropertySource(source);
      const fields = modelPropertyFields(source).filter(
        (field) => !field.requiresValue || properties[field.key] !== undefined,
      );
      values = propertyValues(properties, fields);
      keys = fields
        .filter((f) => !f.unchecked)
        .map((f) => f.key)
        .filter((key) => !['name', 'series', 'ifcClass'].includes(key));
      controllers.inspector.rollback();
      actions.select(null);
      sync();
      controllers.inspector.show('properties');
    },
    defaults() {
      const items = current();
      if (!items.length) return;
      const type = modelPropertyType(items[0]);
      if (!type || items.some((o) => modelPropertyType(o) !== type))
        throw Error('Välj en objekttyp med typikonerna.');
      for (const object of items) {
        const error = validateObject(object);
        if (error) throw Error(error);
      }
      const common = commonPropertyValues(
        items.map(fastenerPropertySource),
        modelPropertyFields(items[0]).filter((f) => f.defaultable !== false),
      );
      defaults.set(type, { ...defaults.get(type), ...common });
      const identity = commonPropertyValues(
        items,
        modelPropertyFields(items[0]).filter((f) => ['name', 'series', 'ifcClass'].includes(f.key)),
      );
      ui.objectDrafts[type] = Object.assign({}, ...Object.values(identity));
      controllers.inspector.rollback();
      const original = representative(selection());
      if (original?.type === 'fastener') controllers.fastenerUI.loadPlacement(original);
      if (original?.type === 'component') controllers.componentUI.cancel();
      actions.resetInspectorIdentity();
      actions.syncMaterialPanel();
      bar.message('Används vid nästa skapande');
    },
    apply() {
      if (!source) return;
      const { objects, changed } = prepare();
      if (!changed.length) throw Error('Välj målobjekt och egenskaper.');
      modelEditor.replace(objects);
      source = null;
      previewSignature = '';
      actions.cancelInspectorPreview();
      actions.setSelection(changed.map((o) => o.id));
      actions.render();
      sync();
    },
    cancel,
    changed(key, checked) {
      keys = checked ? [...new Set([...keys, key])] : keys.filter((k) => k !== key);
      previewSignature = '';
      sync();
    },
  });
  $('inspector-properties').append(bar.root);
  function sync() {
    if (
      source &&
      (tools.operation || tools.drawing || !project.objects.includes(sourceReference))
    ) {
      source = null;
      previewSignature = '';
      actions.cancelInspectorPreview();
    }
    const items = selection(),
      first = representative(items);
    for (const { schema, layout } of layouts) {
      const compact = items.length > 0 && items.every(schema.editable);
      layout.sync({
        compact,
        copyVisible: false,
        copying: false,
        state: { selected: items, operation: tools.operation, drawing: tools.drawing },
      });
      $('inspector-properties').classList.toggle(schema.className, compact);
    }
    for (const node of $('inspector-properties').children) {
      if (node === bar.root) continue;
      if (source) {
        if (!locked.has(node)) locked.set(node, node.inert);
        node.inert = true;
      } else if (locked.has(node)) {
        node.inert = locked.get(node);
        locked.delete(node);
      }
    }
    $('inspector-properties').toggleAttribute('data-property-copy-active', !!source);
    const visible =
      !tools.operation &&
      !tools.drawing &&
      (!!source || items.some((o) => modelPropertyFields(o).length));
    const candidates = selection().filter(
      (item) =>
        item.id !== source?.id && (item.group?.id || item.id) !== (source?.group?.id || source?.id),
    );
    bar.sync({
      visible,
      copying: !!source,
      choices: source
        ? modelPropertyFields(source)
            .filter((field) => Object.hasOwn(values, field.key))
            .map((field) => ({
              ...field,
              disabled:
                candidates.length > 0 &&
                !candidates.some((item) =>
                  modelPropertyFields(item).some((f) => f.key === field.key),
                ),
            }))
        : [],
      selected: keys,
      count: source ? targets().length : 0,
      canApply: !!source && !!keys.length && !!targets().length,
      canDefault:
        !!items.length && items.every((o) => modelPropertyType(o) === modelPropertyType(items[0])),
    });
    if (source && visible) {
      $('inspector-empty').hidden = true;
      const signature = JSON.stringify([keys, targets()]);
      if (signature !== previewSignature) {
        previewSignature = signature;
        bar.run(() => {
          actions.cancelInspectorPreview();
          const { changed } = prepare();
          if (changed.length) controllers.inspector.preview(changed);
        });
      }
    }
    if (!source && !first) bar.root.querySelector('button').hidden = true;
  }
  const controller = {
    sync,
    cancel,
    active: () => !!source,
    confirm: () => bar.run(() => bar.root.querySelector('.primary').click()),
    canConfirm: () => !!source && !!keys.length && !!targets().length,
    creationValues: (type) => defaults.get(type),
    identityDefaults(type) {
      const stored = defaults.get(type);
      return Object.assign(
        {},
        ...['name', 'series', 'ifcClass', 'material', 'color'].map((key) => stored[key] || {}),
      );
    },
    defaultsFor(object) {
      const stored = defaults.get(modelPropertyType(object));
      if (!Object.keys(stored).length) return object;
      try {
        return applyModelProperties(object, stored, Object.keys(stored));
      } catch {
        return object;
      }
    },
  };
  controllers.propertyUI = controller;
}
