import { validateObject } from '../model-object.js';
import { applyObjectBatch } from '../model/tools/transform-tool.js';
import { validateBlockInstances } from '../blocks/validation.js';
import { updateModelBlock } from '../blocks/model-adapter.js';

/** Owns model commits. UI and tools propose changes; they never own history. */
export function createModelEditor({ project, checkpoint }) {
  function validate(objects) {
    const ids = new Set();
    for (const object of objects) {
      if (!object.id || ids.has(object.id)) throw new Error('Objekten behöver unika identiteter.');
      ids.add(object.id);
      const error = validateObject(object);
      if (error) throw new Error(error);
    }
    validateBlockInstances(objects, 3, updateModelBlock);
    return objects;
  }
  function replace(objects) {
    validate(objects);
    if (
      objects.length === project.objects.length &&
      objects.every((s, i) => s === project.objects[i])
    )
      return false;
    // Prepare and validate completely before recording history or mutating the project.
    checkpoint();
    project.objects = objects;
    return true;
  }
  function prepare(batch, options) {
    for (const object of batch) {
      const error = validateObject(object);
      if (error) throw new Error(error);
      if (!options?.copy && !project.objects.some((s) => s.id === object.id))
        throw new Error('Objektet som ska ändras finns inte i modellen.');
    }
    const result = applyObjectBatch(project.objects, [...batch], options);
    validate(result.objects);
    return result;
  }
  return {
    prepare,
    replace,
    prepareCopySeries(batches) {
      let objects = project.objects;
      const ids = [];
      for (const batch of batches) {
        for (const object of batch) {
          const error = validateObject(object);
          if (error) throw new Error(error);
        }
        const result = applyObjectBatch(objects, [...batch], { copy: true });
        objects = result.objects;
        ids.push(...result.ids);
      }
      validate(objects);
      return { objects, ids };
    },
    update(batch, options) {
      const result = prepare(batch, options);
      replace(result.objects);
      return result;
    },
    add(objects) {
      replace([...project.objects, ...objects]);
    },
  };
}
