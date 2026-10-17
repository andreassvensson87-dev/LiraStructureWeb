import { applyFastenerLayout, fastenerLayoutFromPoints } from './placement-frame.js';
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
  if (draft.layout) {
    draft = applyFastenerLayout(draft);
    limit = draft.layout.searchLength ?? null;
    start = draft.group?.origin || draft.start;
    direction = draft.group?.direction || draft.end;
  }
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

/** Same domain preparation for pointer preview and confirmation. */
export function preparePickedFasteners(draft, { start, xPoint, frame, model }) {
  const picked = fastenerLayoutFromPoints(start, xPoint, frame);
  const layout = {
    ...draft.layout,
    ...picked,
    offset: draft.layout?.offset || picked.offset,
    rotation: draft.layout?.rotation || 0,
    reversed: !!draft.layout?.reversed,
    searchLength: draft.layout?.searchLength ?? null,
  };
  const result = prepareFastenerPlacement(
    { ...draft, layout },
    {
      model,
      start,
      direction: xPoint,
      limit: layout.searchLength ?? null,
    },
  );
  return result.batch || [result.draft];
}
