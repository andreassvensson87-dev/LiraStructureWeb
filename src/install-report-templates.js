import templates from './bundled-drawing-templates.js';
import { FRAME_LIBRARY_KEY } from './frame-model.js';
import { LAYOUT_KEY } from './frame-layout.js';
import { REPORT_TEMPLATE_KEY } from './report-layout.js';
import { defaultReportColumns } from './report-drawing-list.js';
import { defaultMaterialReportColumns } from './report-material-list.js';

import { frameReportTableStyle } from './report-table-style.js';

const installedKey = 'lirastructure.a4-report-template.v1';
export const a4ReportLayout = {
  id: 'mall-report-layout-a4-top',
  kind: 'layout',
  name: 'A4 · rapport med sidhuvud',
  usage: 'report',
  paperFormat: 'A4',
  width: 210,
  height: 297,
  reportViewport: { x: 20, y: 56, width: 180, height: 231 },
  entities: [
    {
      id: 'report-a4-frame',
      type: 'block',
      blockId: 'mall-ritram_a4',
      anchor: 'bottom-left',
      point: [0, 0],
      angle: 0,
    },
    {
      id: 'report-a4-header',
      type: 'block',
      blockId: 'mall-rithuvud_a3_a4',
      anchor: 'top-right',
      point: [-190, -56],
      angle: 0,
    },
  ],
};

/** Add the supplied A4 blocks and report preset once; keep subsequent user edits. */
export function installReportTemplates(storage = localStorage) {
  if (storage.getItem(installedKey)) return;
  const keys = [FRAME_LIBRARY_KEY, LAYOUT_KEY, REPORT_TEMPLATE_KEY, installedKey];
  const previous = keys.map((key) => storage.getItem(key));
  const read = (value) => {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) throw Error('Biblioteket har ett ogiltigt format.');
    return parsed;
  };
  const merge = (saved, additions) => [
    ...saved,
    ...additions.filter((item) => !saved.some((existing) => existing.id === item.id)),
  ];
  const blocks = templates.blocks.filter((block) =>
    a4ReportLayout.entities.some((entity) => entity.blockId === block.id),
  );
  const preset = {
    id: 'mall-report-drawing-list-a4',
    name: 'Ritningsförteckning · A4 med sidhuvud',
    title: 'Ritningsförteckning',
    first: a4ReportLayout.id,
    next: 'same',
    font: '2.8',
    tableStyle: frameReportTableStyle,
    type: '',
    search: '',
    sort: 'drawing.number',
    columns: defaultReportColumns,
  };
  const values = [
    JSON.stringify(merge(read(previous[0]), blocks)),
    JSON.stringify(merge(read(previous[1]), [a4ReportLayout])),
    JSON.stringify(merge(read(previous[2]), [preset])),
    '1',
  ];
  try {
    keys.forEach((key, index) => storage.setItem(key, values[index]));
  } catch (error) {
    keys.forEach((key, index) => {
      if (previous[index] === null) storage.removeItem(key);
      else storage.setItem(key, previous[index]);
    });
    throw error;
  }
}

export function installMaterialReportTemplate(storage = localStorage) {
  const key = 'lirastructure.material-report-template.v1';
  if (storage.getItem(key)) return;
  const previous = storage.getItem(REPORT_TEMPLATE_KEY);
  const saved = JSON.parse(previous || '[]');
  if (!Array.isArray(saved)) throw Error('Ogiltigt rapportmallbibliotek.');
  const preset = {
    id: 'mall-report-material-a4',
    kind: 'material-list',
    name: 'Materialförteckning · A4 med sidhuvud',
    title: 'Material- och mängdförteckning',
    first: a4ReportLayout.id,
    next: 'same',
    font: '2.8',
    tableStyle: frameReportTableStyle,
    type: '',
    search: '',
    sort: 'material.mark',
    group: 'material.material',
    subtotals: true,
    totals: true,
    columns: defaultMaterialReportColumns,
  };
  try {
    if (!saved.some((p) => p.id === preset.id))
      storage.setItem(REPORT_TEMPLATE_KEY, JSON.stringify([...saved, preset]));
    storage.setItem(key, '1');
  } catch (error) {
    if (previous === null) storage.removeItem(REPORT_TEMPLATE_KEY);
    else storage.setItem(REPORT_TEMPLATE_KEY, previous);
    throw error;
  }
}

/** Upgrade only the supplied report presets and the unchanged original viewport. */
export function installFullFrameReportTables(storage = localStorage) {
  const marker = 'lirastructure.full-frame-report-tables.v1';
  if (storage.getItem(marker)) return;
  const keys = [LAYOUT_KEY, REPORT_TEMPLATE_KEY, marker];
  const previous = keys.map((key) => storage.getItem(key));
  const layouts = JSON.parse(previous[0] || '[]');
  const presets = JSON.parse(previous[1] || '[]');
  if (!Array.isArray(layouts) || !Array.isArray(presets)) throw Error('Ogiltigt rapportbibliotek.');
  const upgradedLayouts = layouts.map((layout) => {
    const v = layout.reportViewport;
    return layout.id === a4ReportLayout.id &&
      v?.x === 23 &&
      v.y === 61 &&
      v.width === 174 &&
      v.height === 223
      ? { ...layout, reportViewport: { ...a4ReportLayout.reportViewport } }
      : layout;
  });
  const upgradedPresets = presets.map((preset) =>
    ['mall-report-drawing-list-a4', 'mall-report-material-a4'].includes(preset.id)
      ? { ...preset, tableStyle: { ...preset.tableStyle, ...frameReportTableStyle } }
      : preset,
  );
  try {
    storage.setItem(LAYOUT_KEY, JSON.stringify(upgradedLayouts));
    storage.setItem(REPORT_TEMPLATE_KEY, JSON.stringify(upgradedPresets));
    storage.setItem(marker, '1');
  } catch (error) {
    keys.forEach((key, index) => {
      if (previous[index] === null) storage.removeItem(key);
      else storage.setItem(key, previous[index]);
    });
    throw error;
  }
}
