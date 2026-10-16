import { fastenerGroupBatch } from './groups.js';
import { automaticPlacement } from './placement.js';
import { validateFastener } from './object-type.js';
import { validateFastenerTargets } from './relations.js';

/** One detached proposal for create, preview and edit. Never changes the model or history. */
export function prepareFastenerPlacement(
  input,
  { model, start, direction, limit = null, fit = true },
) {
  let draft = structuredClone(input);
  if (!draft.holes.length) throw new Error('Välj minst ett objekt som ska ingå i förbandet.');
  delete draft.span;
  delete draft.insertion;
  draft.lengthMode = 'manual';
  delete draft.lengthOptions;
  delete draft.extraLength;
  let batch = null;
  if (draft.group) {
    draft.groupLimit = limit;
    if (fit) {
      batch = fastenerGroupBatch(draft, model);
      draft = batch[0];
    }
  } else if (fit) draft = automaticPlacement(draft, start, direction, model, limit);
  const error = validateFastener(draft);
  if (error) throw new Error(error);
  validateFastenerTargets(draft, model);
  return { draft, batch };
}
