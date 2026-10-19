import { validateSeries } from '../numbering/rules.js';
import { validateMaterial } from '../materials.js';
import { validateObject, displayGeometry, isPhysical } from '../model-object.js';
import { applyObjectBatch } from './tools/transform-tool.js';
import { prepareTransferredFasteners } from '../fasteners/property-transfer.js';
import { copyComponentProperties } from '../components/property-copy.js';
import { propertyField as field, applyPropertyValues } from '../property-transfer.js';
import { normalizeForm } from '../profile-forms.js';
import { setItemRoll } from '../items/geometry.js';
import { componentCopyKeys, localComponentCopyKeys } from '../components/property-copy.js';
import { componentDefinition } from '../components/definitions.js';

export function modelPropertyType(object) {
  if (!object || object.generatedBy || object.parametricBlock) return null;
  const type = object.type || 'sweep';
  return type === 'component' ? `component:${object.kind}` : type;
}
export function modelPropertyFields(object) {
  const type = modelPropertyType(object);
  if (!type) return [];
  if (type.startsWith('component:')) {
    const allowed = componentCopyKeys(object.kind);
    return componentDefinition(object.kind)
      .parameters.filter((p) => allowed.includes(p.key))
      .map((p) => ({
        ...field(
          p.key,
          p.label,
          ...(p.key === 'boltSpec' ? ['boltSpec', 'lengthOptions'] : [p.key]),
        ),
        unchecked: localComponentCopyKeys.includes(p.key),
        defaultable: !localComponentCopyKeys.includes(p.key),
      }));
  }
  const common = [
    field('name', 'Namn'),
    field('material', 'Material'),
    field('color', 'Objektfärg', 'colorOverride'),
    field('series', 'Prefix och startnummer', 'partSeries'),
    field('ifcClass', 'IFC-klass'),
  ];
  if (['sweep', 'polysweep'].includes(type))
    return [
      field('profile', 'Profil och mått', 'profile', 'width', 'height', 'thickness', 'section'),
      field('rotation', 'Profilrotation'),
      field('profilePlacement', 'Insättning', 'placement'),
      ...common,
    ];
  if (type === 'plate')
    return [
      field('thickness', 'Tjocklek'),
      field('platePlacement', 'Insättning', 'side'),
      ...common,
    ];
  if (type === 'item') return [field('rotation', 'Rotation'), ...common];
  if (type === 'fastener')
    return [
      field('product', 'Standard, storlek och längd', 'spec'),
      field(
        'hardware',
        'Förband',
        'assembly',
        'accessories',
        'washers',
        'nutOffset',
        'startAllowance',
      ),
      { ...field('pattern', 'Mönster'), requiresValue: true },
      { ...field('hole', 'Hål'), requiresValue: true },
      ...common,
    ];
  return [];
}
export function applyModelProperties(target, values, selected) {
  const fields = modelPropertyFields(target);
  const next = applyPropertyValues(target, values, fields, selected);
  if (next.partSeries !== undefined) validateSeries(next.partSeries);
  if (next.material != null) validateMaterial(next.material);
  if (next.colorOverride != null && !/^#[0-9a-f]{6}$/i.test(next.colorOverride))
    throw Error('Ogiltig objektfärg.');
  if ((target.type || 'sweep') === 'item' && selected.includes('rotation') && values.rotation)
    return setItemRoll({ ...next, rotation: target.rotation }, next.rotation);
  return ['sweep', 'polysweep'].includes(target.type || 'sweep') ? normalizeForm(next) : next;
}

/** Prepare the complete batch before preview or a single model-editor commit. */
export function prepareModelPropertyTransfer({ objects: original, source, targets, values, keys }) {
  let objects = original;
  const changed = [];
  for (const target of targets) {
    if (target.type === 'component') {
      if (source.type !== 'component' || source.kind !== target.kind)
        throw Error('Välj samma kopplingstyp.');
      changed.push(copyComponentProperties(source, target, keys, objects));
    } else {
      const next = applyModelProperties(target, values, keys);
      if (next.type === 'fastener') {
        const result = prepareTransferredFasteners(next, objects);
        objects = result.objects;
        changed.push(...result.batch);
      } else changed.push(next);
    }
  }
  objects = applyObjectBatch(objects, changed).objects;
  for (const object of changed) {
    const error = validateObject(object);
    if (error) throw Error(error);
    if (isPhysical(object)) displayGeometry(object, objects, 'exact').dispose();
  }
  return { objects, changed };
}
