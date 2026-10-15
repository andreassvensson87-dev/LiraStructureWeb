import { componentTransformSources } from '../../components/ownership.js';
import { objectType } from '../object-types/index.js';

/** Whole-part transforms carry ordinary cuts when every target is being transformed. */
export function modelTransformSources(objects, ids) {
  const sources = componentTransformSources(objects, ids);
  const selected = new Set(sources.map((s) => s.id));
  for (const object of objects)
    if (
      !selected.has(object.id) &&
      object.type !== 'component' &&
      objectType(object).cut &&
      object.targets?.length &&
      object.targets.every((id) => selected.has(id))
    )
      sources.push(object);
  return sources;
}
