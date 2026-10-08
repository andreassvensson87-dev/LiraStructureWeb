import { partStatus } from './part-marks.js';
import { isPhysical } from './model-object.js';
import { objectQuantities } from './model/object-quantities.js';
import { materialProfile, materialLength } from './report-material-list.js';
const NS = 'http://www.w3.org/2000/svg';
export const singlePartMaterialSize = [91, 12];
export function normalizeSinglePartMaterialSchedule(value = {}) {
  return {
    visible: value.visible !== false,
    dockToTop: value.dockToTop !== false,
    position:
      Array.isArray(value.position) &&
      value.position.length === 2 &&
      value.position.every(Number.isFinite)
        ? [...value.position]
        : [319, 10],
  };
}
export function singlePartMaterialPosition(paper, layout) {
  const area = layout?.contentArea;
  return [(area?.[2] ?? paper[0] - 10) - singlePartMaterialSize[0], area?.[1] ?? 10];
}
/** Count only current instances of the drawing's numbered part type. */
export function singlePartMaterialData(record, state) {
  const objects = state.objects || [];
  const source = objects.find((o) => o.id === record.sourceId && isPhysical(o));
  if (!source) return null;
  const status = partStatus(source, objects, state.parts || { assignments: {} });
  const verified = status.valid && status.key === record.partKey;
  const quantity = verified
    ? objects.filter(
        (o) =>
          isPhysical(o) &&
          state.parts?.assignments[o.id]?.key === record.partKey &&
          partStatus(o, objects, state.parts).valid,
      ).length
    : 1;
  const metrics = objectQuantities(source, objects);
  const length = materialLength(source);
  const width =
    source.type === 'plate' && source.polygon?.length
      ? Math.min(
          ...[0, 1].map(
            (axis) =>
              Math.max(...source.polygon.map((p) => p[axis])) -
              Math.min(...source.polygon.map((p) => p[axis])),
          ),
        )
      : null;
  return {
    quantity,
    verified,
    profile: materialProfile(source) + (width == null ? '' : ` × ${format(width, 1)}`),
    material: source.material?.name || '—',
    length,
    unitWeight: metrics.massKg,
    totalLength: length == null ? null : length * quantity,
    totalWeight: metrics.massKg == null ? null : metrics.massKg * quantity,
    approximate: metrics.approximate,
  };
}
const format = (value, digits) =>
  value == null
    ? '—'
    : value.toLocaleString('sv-SE', { maximumFractionDigits: digits, useGrouping: false });
export function appendSinglePartMaterialSchedule(svg, data, settings) {
  if (!settings.visible || !data) return;
  const node = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, value);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const g = node('g', {
    'data-single-part-material': '',
    transform: `translate(${settings.position})`,
    'font-family': 'Arial, sans-serif',
    fill: '#000',
    stroke: 'none',
  });
  let serial = 0;
  const cell = (x, y, width, label, value, weight = false) => {
    const id = `single-part-material-cell-${serial++}`;
    const clip = node('clipPath', { id });
    clip.append(node('rect', { x: x + 0.3, y, width: width - 0.6, height: 6 }));
    g.append(
      node('rect', { x, y, width, height: 6, fill: 'white', stroke: '#000', 'stroke-width': 0.15 }),
      clip,
      node(
        'text',
        {
          x: x + width - 0.5,
          y: y + 1.75,
          'font-size': 1.29,
          'text-anchor': 'end',
          'clip-path': `url(#${id})`,
        },
        label,
      ),
      node(
        'text',
        {
          x: x + width - 0.5,
          y: y + 5.25,
          'font-size': 2.15,
          'text-anchor': 'end',
          'clip-path': `url(#${id})`,
        },
        `${weight && data.approximate && value !== '—' ? 'ca ' : ''}${value}`,
      ),
    );
  };
  cell(0, 0, 8.5, 'ANTAL', data.verified ? String(data.quantity) : '—');
  cell(8.5, 0, 32, 'PROFIL', data.profile);
  cell(40.5, 0, 21, 'KVALITET', data.material);
  cell(61.5, 0, 14.5, 'LÄNGD [mm]', format(data.length, 0));
  cell(76, 0, 15, 'VIKT [kg]', format(data.unitWeight, 1), true);
  cell(61.5, 6, 14.5, 'LÄNGD TOT.', data.verified ? format(data.totalLength, 0) : '—');
  cell(76, 6, 15, 'VIKT TOT.', data.verified ? format(data.totalWeight, 1) : '—', true);
  svg.append(g);
  return g;
}
