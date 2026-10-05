const defaults = [
  { id: 'mark', title: 'Detalj', width: 30 },
  { id: 'name', title: 'Profil / namn', width: 65 },
  { id: 'material', title: 'Material', width: 45 },
  { id: 'quantity', title: 'Antal', width: 20 },
];
const bounded = (value, fallback, min, max) =>
  Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max
    ? Number(value)
    : fallback;
export function normalizeAssemblySchedule(value = {}) {
  const columns = Array.isArray(value.columns) && value.columns.length ? value.columns : defaults;
  const ids = new Set();
  return {
    position:
      Array.isArray(value.position) &&
      value.position.length === 2 &&
      value.position.every(Number.isFinite)
        ? [...value.position]
        : [10, 240],
    visible: value.visible !== false,
    textSize: bounded(value.textSize, 2.8, 1, 10),
    sort: ['mark', 'name', 'material', 'quantity'].includes(value.sort) ? value.sort : 'mark',
    descending: value.descending === true,
    columns: columns
      .filter(
        (c) =>
          c &&
          typeof c.id === 'string' &&
          !ids.has(c.id) &&
          (defaults.some((d) => d.id === c.id) || c.id.startsWith('custom-')) &&
          ids.add(c.id),
      )
      .slice(0, 20)
      .map((c) => ({
        id: c.id,
        title: String(c.title ?? defaults.find((d) => d.id === c.id)?.title ?? 'Eget fält').slice(
          0,
          80,
        ),
        width: bounded(c.width, 30, 10, 300),
        visible: c.visible !== false,
      })),
    cells: structuredClone(
      value.cells && typeof value.cells === 'object' && !Array.isArray(value.cells)
        ? value.cells
        : {},
    ),
  };
}
export function assemblyScheduleTable(rows, value) {
  const settings = normalizeAssemblySchedule(value);
  const columns = settings.columns.filter((c) => c.visible);
  const cell = (row, id) =>
    ['mark', 'quantity'].includes(id)
      ? String(row[id])
      : String(settings.cells[row.key]?.[id] ?? row[id] ?? '');
  const sorted = [...rows].sort((a, b) => {
    const order =
      settings.sort === 'quantity'
        ? a.quantity - b.quantity
        : cell(a, settings.sort).localeCompare(cell(b, settings.sort), 'sv', { numeric: true });
    return (
      (settings.descending ? -order : order) ||
      a.mark.localeCompare(b.mark, 'sv', { numeric: true })
    );
  });
  return {
    settings,
    columns,
    rows: sorted,
    values: [
      columns.map((c) => c.title),
      ...sorted.map((row) => columns.map((c) => cell(row, c.id))),
    ],
    width: columns.reduce((sum, c) => sum + c.width, 0),
    rowHeight: Math.max(7, settings.textSize * 1.8 + 2),
  };
}
