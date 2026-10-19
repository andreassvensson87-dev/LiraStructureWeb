import { createPropertyActions } from '../../inspector/property-actions.js';
import { propertyValues, commonPropertyValues } from '../../property-transfer.js';
import {
  drawingPropertyFields,
  drawingPropertyType,
  applyDrawingProperties,
} from '../../drawing-property-transfer.js';
import { linkedDimensions } from '../../dimension-links.js';

/** The drawing adapter owns selection/history; the shared UI only reports intents. */
export function createDrawingPropertyActions(editor, defaults) {
  let source = null,
    values = {},
    keys = [];
  const selected = () =>
    editor.items.filter((item) => editor.selectedIds.has(item.id) || item.id === editor.selected);
  const targets = () =>
    selected().filter(
      (item) =>
        item.id !== source?.id && drawingPropertyFields(item).some((f) => keys.includes(f.key)),
    );
  function proposals() {
    const changed = new Map();
    for (const target of targets()) {
      // Linked dimension styles share one owner; geometry and references stay untouched.
      const members =
        target.type === 'dimension' ? linkedDimensions(editor.items, target) : [target];
      for (const member of members)
        changed.set(member.id, applyDrawingProperties(member, values, keys));
    }
    return changed;
  }
  const bar = createPropertyActions({
    copy() {
      const items = selected();
      if (items.length !== 1) throw Error('Välj ett källobjekt.');
      source = structuredClone(items[0]);
      values = propertyValues(source, drawingPropertyFields(source));
      keys = Object.keys(values).filter((key) => key !== 'comment');
      editor.selected = null;
      editor.selectedIds.clear();
      editor.marquee?.clearViews();
      editor.ui();
      editor.showProperties?.();
      editor.adapter.redraw();
    },
    defaults() {
      const items = selected();
      const type = drawingPropertyType(items[0]);
      if (!type || items.some((item) => drawingPropertyType(item) !== type))
        throw Error('Välj en objekttyp med typikonerna.');
      const common = commonPropertyValues(items, drawingPropertyFields(items[0]));
      delete common.comment;
      defaults.set(`drawing:${type}`, { ...defaults.get(`drawing:${type}`), ...common });
      bar.message('Används vid nästa skapande');
    },
    apply() {
      const next = proposals();
      if (!next.size) throw Error('Välj målobjekt och egenskaper.');
      editor.checkpoint();
      editor.items.splice(
        0,
        editor.items.length,
        ...editor.items.map((item) => next.get(item.id) || item),
      );
      source = null;
      editor.ui();
      editor.adapter.redraw();
    },
    cancel() {
      controller.cancel();
    },
    changed(key, checked) {
      keys = checked ? [...new Set([...keys, key])] : keys.filter((k) => k !== key);
      editor.ui();
      editor.adapter.redraw();
    },
  });
  const controller = {
    root: bar.root,
    reset() {
      source = null;
    },
    active: () => !!source,
    cancel() {
      source = null;
      editor.ui();
      editor.adapter.redraw();
    },
    confirm: () => bar.root.querySelector('.primary').click(),
    sync() {
      const items = selected();
      const candidates = selected().filter(
        (item) => item.id !== source?.id && drawingPropertyFields(item).length,
      );
      bar.sync({
        visible:
          !editor.mode && (!!source || items.some((item) => drawingPropertyFields(item).length)),
        copying: !!source,
        choices: source
          ? drawingPropertyFields(source).map((field) => ({
              ...field,
              disabled:
                candidates.length > 0 &&
                !candidates.some((item) =>
                  drawingPropertyFields(item).some((f) => f.key === field.key),
                ),
            }))
          : [],
        selected: keys,
        count: source ? targets().length : 0,
        canApply: !!source && !!keys.length && !!targets().length,
        canDefault:
          items.length > 0 &&
          items.every((item) => drawingPropertyType(item) === drawingPropertyType(items[0])),
      });
      editor.panel.toggleAttribute('data-property-copy-active', !!source);
      editor.panel.append(bar.root);
      if (source) editor.panel.parentElement.classList.add('annotation-focused');
      for (const node of editor.panel.children) if (node !== bar.root) node.inert = !!source;
    },
    display(items) {
      if (!source || !keys.length || !targets().length) return items;
      try {
        const next = proposals();
        return items.map((item) => next.get(item.id) || item);
      } catch {
        return items;
      }
    },
    defaultsFor(item) {
      const stored = defaults.get(`drawing:${drawingPropertyType(item)}`);
      if (!Object.keys(stored).length) return item;
      try {
        return applyDrawingProperties(item, stored);
      } catch {
        return item;
      }
    },
  };
  return controller;
}
