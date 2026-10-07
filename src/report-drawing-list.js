import {
  attributeRawValue,
  attributeDrawingValue,
  attributeChoiceParts,
  drawingAttributeContext,
} from './drawing-attributes.js';
export const defaultReportColumns = [
  { key: 'drawing.number', label: 'Ritningsnummer', width: 30 },
  { key: 'drawing.name', label: 'Namn', width: 60 },
  { key: 'drawing.revision', label: 'Rev.', width: 12 },
  { key: 'drawing.issueStatus', label: 'Status', width: 18 },
  { key: 'drawing.documentType', label: 'Handling', width: 20 },
  { key: 'drawing.category', label: 'Kategori', width: 28 },
  { key: 'drawing.scale', label: 'Skala', width: 22 },
];
export function drawingReportValue(key, record, state) {
  const context = drawingAttributeContext(record, state);
  const raw = attributeRawValue(key, context);
  if (['drawing.issueStatus', 'drawing.documentType'].includes(key))
    return (Array.isArray(raw) ? raw : [raw])
      .map((v) => {
        const parts = attributeChoiceParts(v);
        return parts.code || parts.text;
      })
      .filter(Boolean)
      .join(', ');
  return attributeDrawingValue(key, context);
}
export function drawingReportRows(
  state,
  columns,
  { search = '', type = '', sort = 'drawing.number' } = {},
) {
  const needle = search.trim().toLocaleLowerCase('sv');
  return state.drawings
    .filter((r) => !type || r.type === type)
    .map((record) => ({
      record,
      cells: columns.map((c) => drawingReportValue(c.key, record, state)),
    }))
    .filter(
      ({ cells }) =>
        !needle || cells.some((v) => String(v).toLocaleLowerCase('sv').includes(needle)),
    )
    .sort((a, b) =>
      drawingReportValue(sort, a.record, state).localeCompare(
        drawingReportValue(sort, b.record, state),
        'sv',
        { numeric: true },
      ),
    )
    .map(({ cells }) => cells);
}
