const defaults = [
  { id: 'mark', title: 'Detalj', width: 30 },
  { id: 'name', title: 'Profil / namn', width: 65 },
  { id: 'material', title: 'Material', width: 45 },
  { id: 'quantity', title: 'Antal', width: 20 },
];
export const materialScheduleColumns = [
  { id: 'mark', title: 'INGÅENDE DEL', width: 23 },
  { id: 'name', title: 'PROFIL', width: 38.5 },
  { id: 'material', title: 'KVALITET', width: 16 },
  { id: 'quantity', title: 'ANTAL', width: 9.5 },
  { id: 'length', title: 'LÄNGD (mm)', width: 9.5 },
  { id: 'weight', title: 'VIKT (kg)', width: 13.5 },
];
export const materialScheduleFields = [
  ['fire', 'UT (BRAND)'],
  ['execution', 'UTFÖRANDEKLASS'],
  ['inspection', 'KOMPL. OFP'],
  ['tolerance', 'TOLERANSKLASS'],
  ['instructions', 'ALLMÄNNA ANVISNINGAR'],
  ['weldClass', 'SVETSKLASS'],
  ['weldInstructions', 'GENERELL SVETSANVISNING'],
  ['protection', 'ROSTSKYDD'],
  ['preparation', 'FÖRBEH.GRAD'],
  ['colour', 'KULÖR'],
  ['information', 'ÖVRIG INFORMATION'],
];
export function newMaterialSchedule(value = {}) {
  return normalizeAssemblySchedule({
    ...value,
    dockToTitle: value.dockToTitle !== false,
    style: 'material',
    columns: materialScheduleColumns,
    textSize: 2.15,
  });
}
const bounded = (value, fallback, min, max) =>
  Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max
    ? Number(value)
    : fallback;
export function normalizeAssemblySchedule(value = {}) {
  const material = value.style === 'material';
  const columns =
    Array.isArray(value.columns) && value.columns.length
      ? value.columns
      : material
        ? materialScheduleColumns
        : defaults;
  const ids = new Set();
  return {
    style: material ? 'material' : 'table',
    dockToTitle: material && value.dockToTitle !== false,
    notes: Object.fromEntries(
      materialScheduleFields.map(([id]) => [id, String(value.notes?.[id] ?? '').slice(0, 200)]),
    ),
    position:
      Array.isArray(value.position) &&
      value.position.length === 2 &&
      value.position.every(Number.isFinite)
        ? [...value.position]
        : [10, 240],
    visible: value.visible !== false,
    textSize: bounded(value.textSize, material ? 2.15 : 2.8, 1, 10),
    sort: ['mark', 'name', 'material', 'quantity', 'length', 'weight'].includes(value.sort)
      ? value.sort
      : 'mark',
    descending: value.descending === true,
    columns: columns
      .filter(
        (c) =>
          c &&
          typeof c.id === 'string' &&
          !ids.has(c.id) &&
          (materialScheduleColumns.some((d) => d.id === c.id) || c.id.startsWith('custom-')) &&
          ids.add(c.id),
      )
      .slice(0, 20)
      .map((c) => ({
        id: c.id,
        title: String(c.title ?? defaults.find((d) => d.id === c.id)?.title ?? 'Eget fält').slice(
          0,
          80,
        ),
        width: bounded(c.width, 30, 5, 300),
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
      : ['length', 'weight'].includes(id)
        ? row[id] == null
          ? '—'
          : `${id === 'weight' && row.approximate ? 'ca ' : ''}${row[id].toLocaleString('sv-SE', { maximumFractionDigits: id === 'length' ? 0 : 1, useGrouping: false })}`
        : String(settings.cells[row.key]?.[id] ?? row[id] ?? '');
  const sorted = [...rows].sort((a, b) => {
    const order = ['quantity', 'length', 'weight'].includes(settings.sort)
      ? (a[settings.sort] ?? -Infinity) - (b[settings.sort] ?? -Infinity)
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
    rowHeight:
      settings.style === 'material'
        ? Math.max(3.5, settings.textSize * 1.6)
        : Math.max(7, settings.textSize * 1.8 + 2),
    totalWeight: rows.some((r) => r.weight == null)
      ? null
      : rows.reduce((sum, r) => sum + r.weight, 0),
    approximate: rows.some((r) => r.approximate),
  };
}
