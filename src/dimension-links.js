import { dimensionPaperOffset, setDimensionPaperOffset } from './dimension-chain.js';

export function linkedDimensions(items, item) {
  if (!item) return [];
  return item.type === 'dimension' && item.dimensionLinkId
    ? items.filter(
        (p) =>
          p.type === 'dimension' &&
          p.view === item.view &&
          p.dimensionLinkId === item.dimensionLinkId,
      )
    : [item];
}
export function moveLinkedDimensions(items, item, line) {
  const delta = line.map((v, i) => v - item.line[i]);
  for (const member of linkedDimensions(items, item))
    member.line = member.line.map((v, i) => v + delta[i]);
}
export function unlinkDimensions(items, item) {
  const group = linkedDimensions(items, item);
  delete item.dimensionLinkId;
  if (group.length <= 2) for (const member of group) delete member.dimensionLinkId;
}
export function linkedPaperOffsets(items, item, value, project, unit) {
  return linkedDimensions(items, item).map((member) => {
    const old = dimensionPaperOffset(member, project, unit).value;
    const next = member === item ? value : (Math.sign(old) || 1) * Math.abs(value);
    return { member, line: setDimensionPaperOffset(member, next, project, unit) };
  });
}
