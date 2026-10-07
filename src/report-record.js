import { validateReportViewport } from './report-layout.js';
import { reportTableStyle } from './report-table-style.js';

export const reportPropertyKeys = ['number', 'date', 'revision', 'issueStatus', 'documentType'];
export function reportPageContext(project, report, pageNumber, pageCount, rowCount) {
  const pageLabel = `Sida ${pageNumber} av ${pageCount}`;
  return {
    project,
    custom: {},
    report: { ...report, pageNumber, pageCount, rowCount, pageLabel },
    drawing: {
      ...report,
      name: `${report.title}\n${pageLabel}`,
      category: 'FÖRTECKNING',
    },
  };
}
export function validateReportRecord(report) {
  const text = (v, max = 200) => typeof v === 'string' && v.length <= max;
  if (
    !report ||
    typeof report !== 'object' ||
    !['drawing-list', 'material-list'].includes(report.kind) ||
    !text(report.id) ||
    !report.id ||
    !text(report.title, 120) ||
    !report.title.trim() ||
    !Array.isArray(report.columns) ||
    !report.columns.length ||
    report.columns.length > 100
  )
    throw Error('Ogiltig rapport i projektfilen.');
  for (const key of ['first', 'next', 'type', 'search', 'sort', ...reportPropertyKeys]) {
    const value = report[key];
    if (['issueStatus', 'documentType'].includes(key) && Array.isArray(value)) {
      if (value.length > 100 || !value.every((v) => text(v)))
        throw Error('Ogiltiga rapportegenskaper.');
    } else if (!text(value)) throw Error('Ogiltiga rapportegenskaper.');
  }
  if (report.date && !/^\d{4}-\d{2}-\d{2}$/.test(report.date))
    throw Error('Ogiltigt rapportdatum.');
  if (!(Number(report.font) >= 1.5 && Number(report.font) <= 6))
    throw Error('Ogiltig rapporttextstorlek.');
  for (const c of report.columns)
    if (
      !c ||
      !text(c.key) ||
      !c.key ||
      !text(c.label) ||
      !(Number.isFinite(c.width) && c.width > 0) ||
      (c.align !== undefined && !['start', 'middle', 'end'].includes(c.align))
    )
      throw Error('Ogiltiga rapportkolumner.');
  reportTableStyle(report.tableStyle);
  if (
    report.group !== undefined &&
    !['', 'material.material', 'material.profile'].includes(report.group)
  )
    throw Error('Ogiltig rapportgruppering.');
  for (const key of ['subtotals', 'totals'])
    if (report[key] !== undefined && typeof report[key] !== 'boolean')
      throw Error('Ogiltiga rapportsummeringar.');
  const assets = report.assets;
  if (!assets || !Array.isArray(assets.blocks) || assets.blocks.length > 2000)
    throw Error('Rapportens layoutblock saknas.');
  const blockIds = new Set();
  for (const block of assets.blocks) {
    if (
      !block ||
      !text(block.id) ||
      !block.id ||
      blockIds.has(block.id) ||
      !Array.isArray(block.entities)
    )
      throw Error('Ogiltigt rapportblock.');
    blockIds.add(block.id);
    for (const entity of block.entities) {
      const points = entity.type === 'line' ? entity.points : [entity.point];
      if (
        !Array.isArray(points) ||
        !points.length ||
        !points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
      )
        throw Error('Ogiltig geometri i rapportblock.');
    }
  }
  for (const layout of [assets.first, assets.next]) {
    if (!layout || !Array.isArray(layout.entities)) throw Error('Ogiltig rapportlayout.');
    validateReportViewport(layout);
    for (const instance of layout.entities)
      if (
        !blockIds.has(instance.blockId) ||
        !Array.isArray(instance.point) ||
        instance.point.length !== 2 ||
        !instance.point.every(Number.isFinite)
      )
        throw Error('Rapportens layout saknar ett giltigt block.');
  }
  if (
    assets.first.id !== report.first ||
    assets.next.id !== (report.next === 'same' ? report.first : report.next)
  )
    throw Error('Rapportens layoutreferenser stämmer inte.');
  return report;
}
export function validateProjectReports(reports = []) {
  if (!Array.isArray(reports) || reports.length > 10000) throw Error('Ogiltig rapportlista.');
  const ids = new Set();
  for (const report of reports) {
    validateReportRecord(report);
    if (ids.has(report.id)) throw Error('Rapporterna behöver unika identiteter.');
    ids.add(report.id);
  }
  return reports;
}
