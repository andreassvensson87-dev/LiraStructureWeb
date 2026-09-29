export const PAPER_KEY = 'lirastructure.paper-formats.v1';
export const standardPapers = [
  ['A4', 210, 297],
  ['A3', 297, 420],
  ['A2', 420, 594],
  ['A1', 594, 841],
  ['A0', 841, 1189],
].map(([name, width, height]) => ({ id: name, name, width, height }));
export function validatePaper(p) {
  if (!p.name?.trim() || p.name.length > 60) throw Error('Ange ett formatnamn.');
  if (![p.width, p.height].every((n) => Number.isFinite(n) && n >= 50 && n <= 5000))
    throw Error('Bredd och höjd ska vara 50–5 000 mm.');
  return p;
}
export function paperSize(p, landscape) {
  return landscape
    ? [Math.max(p.width, p.height), Math.min(p.width, p.height)]
    : [Math.min(p.width, p.height), Math.max(p.width, p.height)];
}
export function sheetLayout(bounds, scale, paper) {
  const scales = typeof scale === 'number' ? { top: scale, front: scale, section: scale } : scale;
  const length = bounds.max.x - bounds.min.x,
    width = Math.max(length / scales.front, length / scales.top),
    height = (bounds.max.z - bounds.min.z) / scales.front,
    topDepth = (bounds.max.y - bounds.min.y) / scales.top,
    sectionWidth = (bounds.max.y - bounds.min.y) / scales.section;
  const total = width + sectionWidth + 25,
    x = Math.max(15, (paper[0] - total) / 2),
    y = Math.max(topDepth + 40, paper[1] / 2);
  return { x, y, topY: y - height / 2 - topDepth / 2 - 32, sectionX: x + width + 25 };
}
