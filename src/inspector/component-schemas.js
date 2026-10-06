import { componentDefinition } from '../components/definitions.js';
import { componentInspectorSections } from '../components/inspector-layout.js';
import { componentCopyKeys, localComponentCopyKeys } from '../components/property-copy.js';
import { defineAttributeSchema } from './attributes.js';

export function componentInspectorSchema(kind) {
  const parameters = componentDefinition(kind).parameters;
  const copyKeys = componentCopyKeys(kind);
  const fields = parameters.map((parameter) => {
    const unit = parameter.label.match(/\((mm|°)\)/)?.[1];
    return {
      ...parameter,
      label:
        { thickness: 'Tjocklek', distance: 'Avstånd', gap: 'Spalt' }[parameter.key] ||
        parameter.label.replace(/\s*\((mm|°)\)/, ''),
      ariaLabel: parameter.label,
      unit,
      type:
        parameter.type === 'fastener'
          ? 'custom'
          : parameter.options
            ? 'select'
            : parameter.type || 'text',
      options: parameter.options?.map(([value, text]) => [
        value,
        parameter.key === 'sizeMode' && value === 'outstand' ? 'Utstick' : text,
      ]),
      selector: `#component-parameter-${parameter.key}`,
      row: 'label',
      copy: copyKeys.includes(parameter.key) ? parameter.key : undefined,
      visibleWhen: parameter.hidden ? ({ draft }) => !parameter.hidden(draft) : undefined,
    };
  });
  return defineAttributeSchema({
    key: `component-${kind}`,
    labels: '.attribute-row',
    lockContainers: 'form',
    fields,
    copyGroups: fields.filter((f) => f.copy).map((f) => [f.key, f.label]),
    unchecked: localComponentCopyKeys,
    groups: componentInspectorSections(kind).map((section) => ({
      key: section.id,
      label: section.label,
      collapsed: section.collapsed,
      fields: section.parameters.map((p) => p.key),
    })),
  });
}
