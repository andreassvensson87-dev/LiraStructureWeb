import { Color } from 'three';
import { stepString as str, stepNumber as num, stepList as list } from './step.js';
import { objectColor } from '../materials.js';
export function property(w, name, value, type = 'IfcLabel') {
  if (value === undefined || value === null || value === '') return null;
  const encoded =
    typeof value === 'number'
      ? type === 'IfcInteger'
        ? String(value)
        : num(value)
      : typeof value === 'boolean'
        ? value
          ? '.T.'
          : '.F.'
        : str(value);
  return w.add('IFCPROPERTYSINGLEVALUE', str(name), '$', `${type.toUpperCase()}(${encoded})`, '$');
}
export async function propertySet(w, guid, owner, key, properties) {
  const values = properties.filter(Boolean);
  if (!values.length) return;
  const set = w.add(
    'IFCPROPERTYSET',
    str(await guid('pset:' + key)),
    '$',
    str('LiraStructure_' + key.split(':')[0]),
    '$',
    list(values),
  );
  w.add(
    'IFCRELDEFINESBYPROPERTIES',
    str(await guid('pset-rel:' + key)),
    '$',
    '$',
    '$',
    list([owner]),
    set,
  );
}
export function colorStyle(w, cache, object, item) {
  const color = objectColor(object);
  let style = cache.get(color);
  if (!style) {
    // Match the model's working RGB values and the existing IFC renderer.
    const rgb = new Color(color).toArray();
    const colour = w.add('IFCCOLOURRGB', '$', ...rgb.map(num));
    const shading = w.add('IFCSURFACESTYLESHADING', colour, '0.');
    style = w.add('IFCSURFACESTYLE', '$', '.BOTH.', list([shading]));
    cache.set(color, style);
  }
  w.add('IFCSTYLEDITEM', item, list([style]), '$');
}
export async function material(w, cache, guid, object, owner) {
  const source = object.material;
  if (!source) return;
  const key = JSON.stringify([
    source.id,
    source.revision,
    source.name,
    source.category,
    source.density,
  ]);
  let ref = cache.get(key);
  if (!ref) {
    ref = w.add('IFCMATERIAL', str(source.name), '$', str(source.category));
    if (Number.isFinite(source.density))
      w.add(
        'IFCMATERIALPROPERTIES',
        str('LiraStructure_Material'),
        '$',
        list([property(w, 'MassDensity', source.density / 1e9, 'IfcMassDensityMeasure')]),
        ref,
      );
    cache.set(key, ref);
  }
  w.add(
    'IFCRELASSOCIATESMATERIAL',
    str(await guid('material-rel:' + object.id)),
    '$',
    '$',
    '$',
    list([owner]),
    ref,
  );
}
