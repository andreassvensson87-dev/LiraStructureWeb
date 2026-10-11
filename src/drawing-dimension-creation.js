import {
  dimensionAxis,
  chainGeometry,
  holeDimensionPoints,
  insertDimensionPoint,
} from './dimension-chain.js';
export const dimensionDirections = { horizontal: 'Horisontell', vertical: 'Vertikal', free: 'Fri' };

/** Return a draft or a validation message without changing the live annotation or history. */
export function pickDimensionPoint(
  { draft, mode, workflow },
  hit,
  {
    candidates = [],
    source,
    sourceMark,
    reference = null,
    manualLeaders = false,
    uuid = () => crypto.randomUUID(),
  } = {},
) {
  if (workflow === 'holes' && !draft && ['horizontal', 'vertical'].includes(mode)) {
    const points = holeDimensionPoints(candidates, hit.reference, mode);
    if (points.length < 2)
      return { message: 'Välj en hålbild med minst två hålcentrum i måttriktningen.' };
    return {
      draft: {
        id: uuid(),
        type: 'dimension',
        kind: mode,
        view: hit.view,
        points: points.map((p) => [...p]),
        references: points.map((p) => p.reference),
      },
      place: true,
    };
  }
  if (mode === 'leader') {
    if (!manualLeaders && (!source || !sourceMark))
      return {
        message: 'Välj en numrerad detalj. Numrering finns i ritningshanterarens Mer-meny.',
      };
    return {
      draft: {
        id: uuid(),
        type: 'leader',
        ...(manualLeaders ? { manual: true, comment: '' } : {}),
        view: hit.view,
        sourceId: source || undefined,
        points: [[...hit.point]],
        references: [reference],
      },
    };
  }
  if (!draft)
    return {
      draft: {
        id: uuid(),
        type: 'dimension',
        kind: mode,
        view: hit.view,
        points: [[...hit.point]],
        references: [hit.reference || null],
      },
    };
  if (draft.points.some((p) => Math.hypot(p[0] - hit.point[0], p[1] - hit.point[1]) < 1e-5))
    return { duplicate: true, draft };
  const next = {
    ...draft,
    points: [...draft.points, [...hit.point]],
    references: [...draft.references, hit.reference || null],
  };
  return { draft: next, place: workflow === 'point' && next.points.length === 2 };
}
export function prepareDimensionPlacement(draft) {
  const next = { ...draft, axis: dimensionAxis(draft.kind, draft.points) };
  if (chainGeometry({ ...next, line: next.points[0] }).points.length < 2)
    throw Error('Punkterna måste ge ett mått i vald riktning.');
  return next;
}
export function withDimensionPoint(item, hit) {
  const next = structuredClone(item);
  if (!insertDimensionPoint(next, hit.point)) return null;
  next.references ??= Array(next.points.length - 1).fill(null);
  next.references.push(hit.reference || null);
  return next;
}
