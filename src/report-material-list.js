import { isPhysical } from './model-object.js';
import { objectQuantities } from './model/object-quantities.js';
import { partKey, partStatus } from './part-marks.js';

export const materialReportAttributes = [
  ['material.mark', 'Part mark'],
  ['material.count', 'Antal'],
  ['material.material', 'Material'],
  ['material.profile', 'Profil'],
  ['material.length', 'Längd · mm'],
  ['material.totalLength', 'Totallängd · m'],
  ['material.unitWeight', 'Styckevikt · kg'],
  ['material.weight', 'Totalvikt · kg'],
  ['material.volume', 'Volym · m³'],
  ['material.status', 'Numreringsstatus'],
].map(([key, name]) => ({ key, name }));
export const defaultMaterialReportColumns = [
  { key: 'material.mark', label: 'Part mark', width: 30 },
  { key: 'material.count', label: 'Antal', width: 13, align: 'end' },
  { key: 'material.material', label: 'Material', width: 35 },
  { key: 'material.profile', label: 'Profil', width: 42 },
  { key: 'material.length', label: 'Längd · mm', width: 24, align: 'end' },
  { key: 'material.weight', label: 'Totalvikt · kg', width: 29, align: 'end' },
];
const number = (n, digits = 2) =>
  n == null
    ? '—'
    : n.toLocaleString('sv-SE', { maximumFractionDigits: digits, useGrouping: false });
export function materialProfile(object) {
  if (object.type === 'plate') return `PL ${number(object.thickness, 1)}`;
  if (object.type === 'fastener') return object.spec?.name || 'Skruv';
  if (object.section?.name) return object.section.name;
  const names = {
    rectangle: 'Rekt.',
    rect: 'Rekt.',
    i: 'I',
    rhs: 'RHS',
    chs: 'CHS',
    circle: 'Rund',
    triangle: 'Triangel',
  };
  return `${names[object.profile] || object.profile || 'Profil'} ${number(object.width, 1)} × ${number(object.height, 1)}${object.thickness > 0 ? ' × ' + number(object.thickness, 1) : ''}`;
}
export function materialLength(object) {
  if (object.start && object.end)
    return Math.hypot(...object.end.map((v, i) => v - object.start[i]));
  if (object.polygon?.length) {
    const range = (axis) =>
      Math.max(...object.polygon.map((p) => p[axis])) -
      Math.min(...object.polygon.map((p) => p[axis]));
    return Math.max(range(0), range(1));
  }
  return null;
}
function value(key, row) {
  switch (key) {
    case 'material.mark':
      return row.mark;
    case 'material.material':
      return row.material;
    case 'material.profile':
      return row.profile;
    case 'material.status':
      return row.status;
    case 'material.count':
      return String(row.count);
    case 'material.length':
      return number(row.length, 1);
    case 'material.totalLength':
      return number(row.totalLength / 1000, 3);
    case 'material.unitWeight':
      return (row.approximate && row.unitWeight != null ? 'ca ' : '') + number(row.unitWeight);
    case 'material.weight':
      return (row.approximate && row.weight != null ? 'ca ' : '') + number(row.weight);
    case 'material.volume':
      return number(row.volume, 6);
    default:
      return '';
  }
}
function summary(columns, rows, label) {
  const sums = {
    'material.count': rows.reduce((s, r) => s + r.count, 0),
    'material.totalLength': rows.reduce((s, r) => s + r.totalLength, 0) / 1000,
    'material.weight': rows.reduce((s, r) => s + (r.weight || 0), 0),
    'material.volume': rows.reduce((s, r) => s + r.volume, 0),
  };
  const textIndex = columns.findIndex((c) =>
    ['material.mark', 'material.material', 'material.profile', 'material.status'].includes(c.key),
  );
  const labelIndex = textIndex < 0 ? 0 : textIndex;
  return columns.map((c, i) => {
    if (!(c.key in sums)) return i === labelIndex ? label : '';
    const formatted =
      (c.key === 'material.weight' && rows.some((r) => r.approximate) ? 'ca ' : '') +
      number(
        sums[c.key],
        c.key === 'material.volume' ? 6 : c.key === 'material.totalLength' ? 3 : 2,
      );
    const result =
      c.key === 'material.weight' && rows.some((r) => r.weight == null)
        ? `${formatted} + okänd`
        : formatted;
    return i === labelIndex ? `${label} · ${result}` : result;
  });
}
export function materialReportData(
  state,
  columns,
  {
    search = '',
    type = '',
    sort = 'material.mark',
    group = '',
    subtotals = true,
    totals = true,
    massCache = new Map(),
  } = {},
) {
  const groups = new Map(),
    objects = state.objects || [],
    parts = state.parts || { assignments: {} };
  for (const object of objects.filter((o) => isPhysical(o) && (!type || o.type === type))) {
    const key = partKey(object, objects),
      status = partStatus(object, objects, parts);
    const metricsKey = JSON.stringify([
      key,
      object.section?.density,
      object.section?.contourDefinition,
      object.section?.parameters,
    ]);
    const groupKey = `${status.valid ? status.mark : 'unverified:' + (status.mark || '')}:${metricsKey}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.count++;
      continue;
    }
    if (massCache.size > 5000) massCache.clear();
    let metrics = massCache.get(metricsKey);
    if (!metrics) {
      metrics = objectQuantities(object, objects);
      massCache.set(metricsKey, metrics);
    }
    groups.set(groupKey, {
      mark: status.valid
        ? status.mark
        : status.mark
          ? `${status.mark} · kontroll krävs`
          : 'Ej numrerad',
      status: status.valid ? 'Giltig' : status.mark ? 'Numrera om' : 'Ej numrerad',
      count: 1,
      material:
        object.material?.name ||
        (metrics.densitySource === 'profile' ? 'Profilens densitet' : 'Material saknas'),
      profile: materialProfile(object),
      length: materialLength(object),
      unitWeight: metrics.massKg,
      unitVolume: metrics.volumeM3,
      approximate: metrics.approximate,
      verified: status.valid,
    });
  }
  const needle = search.trim().toLocaleLowerCase('sv');
  const compare = (a, b) => String(a).localeCompare(String(b), 'sv', { numeric: true });
  const records = [...groups.values()]
    .map((r) => ({
      ...r,
      weight: r.unitWeight == null ? null : r.unitWeight * r.count,
      volume: r.unitVolume * r.count,
      totalLength: (r.length || 0) * r.count,
    }))
    .filter(
      (r) =>
        !needle || columns.some((c) => value(c.key, r).toLocaleLowerCase('sv').includes(needle)),
    )
    .sort((a, b) => {
      if (group && compare(value(group, a), value(group, b)))
        return compare(value(group, a), value(group, b));
      const field = {
        'material.count': 'count',
        'material.length': 'length',
        'material.totalLength': 'totalLength',
        'material.unitWeight': 'unitWeight',
        'material.weight': 'weight',
        'material.volume': 'volume',
      }[sort];
      return field
        ? (a[field] ?? -Infinity) - (b[field] ?? -Infinity)
        : compare(value(sort, a), value(sort, b));
    });
  const rows = [],
    rowKinds = [];
  let batch = [],
    lastGroup;
  const add = (cells, kind) => {
    rows.push(cells);
    rowKinds.push(kind);
  };
  const finish = () => {
    if (group && subtotals && batch.length)
      add(summary(columns, batch, `Summa · ${lastGroup}`), 'subtotal');
    batch = [];
  };
  for (const r of records) {
    const current = group ? value(group, r) : '';
    if (lastGroup !== undefined && lastGroup !== current) finish();
    lastGroup = current;
    batch.push(r);
    add(
      columns.map((c) => value(c.key, r)),
      'data',
    );
  }
  finish();
  if (totals && records.length) add(summary(columns, records, 'Totalt'), 'total');
  const partCount = records.reduce((s, r) => s + r.count, 0);
  const unverified = records.filter((r) => !r.verified).reduce((s, r) => s + r.count, 0);
  const unknownWeight = records.filter((r) => r.weight == null).reduce((s, r) => s + r.count, 0);
  const warnings = [
    unverified && `${unverified} delar saknar giltig part mark`,
    unknownWeight && `${unknownWeight} delar saknar densitet · viktsumman är ofullständig`,
  ].filter(Boolean);
  return { rows, rowKinds, partCount, groupCount: records.length, warnings };
}
