import { validateReportViewport } from './report-layout.js';
export const REPORT_VIEWPORT_ID = 'report-viewport';
export function reportViewportEntity(layout) {
  const a = layout.reportViewport;
  if (!a) return null;
  const bottom = layout.height - a.y - a.height,
    top = bottom + a.height;
  return {
    id: REPORT_VIEWPORT_ID,
    type: 'line',
    points: [
      [a.x, bottom],
      [a.x + a.width, bottom],
      [a.x + a.width, top],
      [a.x, top],
      [a.x, bottom],
    ],
  };
}
export function reportViewportGrips(layout) {
  const entity = reportViewportEntity(layout);
  if (!entity) return [];
  const points = entity.points.slice(0, 4);
  return [
    ...points.map((point, index) => ({ point, index })),
    ...points.map((p, i) => ({
      point: p.map((v, axis) => (v + points[(i + 1) % 4][axis]) / 2),
      index: i + 4,
    })),
    { point: points[0].map((v, axis) => (v + points[2][axis]) / 2), index: -1 },
  ];
}
export function editReportViewport(layout, base, target, index = -1) {
  const a = validateReportViewport(layout);
  let left = a.x,
    right = a.x + a.width,
    top = layout.height - a.y,
    bottom = top - a.height;
  if (index === -1) {
    const dx = target[0] - base[0],
      dy = target[1] - base[1];
    left += dx;
    right += dx;
    top += dy;
    bottom += dy;
  } else {
    if (![0, 1, 2, 3, 4, 5, 6, 7].includes(index)) throw Error('Ogiltigt rapportgrepp.');
    if ([0, 3, 7].includes(index)) left = target[0];
    if ([1, 2, 5].includes(index)) right = target[0];
    if ([0, 1, 4].includes(index)) bottom = target[1];
    if ([2, 3, 6].includes(index)) top = target[1];
  }
  const area = { ...a, x: left, y: layout.height - top, width: right - left, height: top - bottom };
  validateReportViewport({ ...layout, reportViewport: area });
  return area;
}
