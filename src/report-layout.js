export const REPORT_TEMPLATE_KEY = 'lirastructure.report-templates.v1';
export function layoutAppliesTo(layout, target) {
  return !layout.usage ? target === 'drawing' : layout.usage === 'both' || layout.usage === target;
}
export function defaultReportLayout() {
  return {
    id: '',
    kind: 'layout',
    name: 'A4 · standardrapport',
    usage: 'report',
    width: 210,
    height: 297,
    entities: [],
    reportViewport: { x: 15, y: 25, width: 180, height: 247 },
  };
}
export function validateReportViewport(layout) {
  const area = layout.reportViewport;
  if (!area) throw Error('Layouten saknar rapportyta. Lägg till en i layouteditorn.');
  if (
    ![layout.width, layout.height, area.x, area.y, area.width, area.height].every(
      Number.isFinite,
    ) ||
    layout.width < 50 ||
    layout.width > 5000 ||
    layout.height < 50 ||
    layout.height > 5000 ||
    (area.fillViewport !== undefined && typeof area.fillViewport !== 'boolean') ||
    area.width < 30 ||
    area.height < 30 ||
    area.x < 0 ||
    area.y < 0 ||
    area.x + area.width > layout.width + 1e-6 ||
    area.y + area.height > layout.height + 1e-6
  )
    throw Error('Rapportytan måste rymmas på bladet och vara minst 30 × 30 mm.');
  return area;
}
export function reportAreaFromPoints(layout, a, b) {
  const area = {
    x: Math.min(a[0], b[0]),
    y: layout.height - Math.max(a[1], b[1]),
    width: Math.abs(b[0] - a[0]),
    height: Math.abs(b[1] - a[1]),
  };
  validateReportViewport({ ...layout, reportViewport: area });
  return area;
}
