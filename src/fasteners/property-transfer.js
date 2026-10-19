import { nextIdentity } from '../object-identity.js';
import { fastenerGroupBatch, replaceFastenerGroup } from './groups.js';
import { prepareFastenerPlacement } from './placement-draft.js';
const patternKeys = [
  'rows',
  'columns',
  'spacingX',
  'spacingY',
  'shape',
  'distancesX',
  'distancesY',
  'diameter',
  'positions',
];
const holeKeys = ['kind', 'extent', 'diameter', 'depth', 'countersink'];
const pick = (object, keys) =>
  Object.fromEntries(keys.map((key) => [key, structuredClone(object?.[key])]));
export function fastenerPropertySource(source) {
  if (source.type !== 'fastener') return source;
  return {
    ...source,
    pattern: source.group ? pick(source.group, patternKeys) : undefined,
    hole:
      source.holes?.length &&
      source.holes.every(
        (hole) =>
          JSON.stringify(pick(hole, holeKeys)) === JSON.stringify(pick(source.holes[0], holeKeys)),
      )
        ? pick(source.holes[0], holeKeys)
        : undefined,
  };
}
export function prepareTransferredFasteners(source, model) {
  const draft = structuredClone(source);
  if (draft.pattern) {
    if (!draft.group) throw Error('Målet måste vara en skruvgrupp.');
    Object.assign(draft.group, draft.pattern);
  }
  if (draft.hole) draft.holes = draft.holes.map((hole) => ({ ...hole, ...draft.hole }));
  delete draft.pattern;
  delete draft.hole;
  if (draft.group) {
    const batch = fastenerGroupBatch(draft, model);
    const known = new Set(model.map((object) => object.id));
    const identified = [...model];
    for (const object of batch) {
      if (!known.has(object.id)) {
        Object.assign(object, nextIdentity(object, identified));
        identified.push(object);
      }
    }
    return { objects: replaceFastenerGroup(model, batch), batch };
  }
  const { draft: next } = prepareFastenerPlacement(draft, {
    model,
    start: draft.start,
    direction: draft.end,
  });
  return { objects: model.map((o) => (o.id === next.id ? next : o)), batch: [next] };
}
