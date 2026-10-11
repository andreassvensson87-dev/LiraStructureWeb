import { paintDrawingTool } from './drawing-tool-feedback.js';

import { appendDrawingViewGrips } from './drawing-view-grips.js';

import { drawingAttributeContext } from './drawing-attributes.js';
import { applyDrawingFont } from './drawing-preferences.js';

import { appendViewTitle } from './drawing-view-title.js';

import { viewById } from './drawing-views.js';

import { pasteboardBounds } from './drawing-pasteboard.js';
import { appendDrawingLayout } from './drawing-layout.js';

import { assemblyScheduleTable } from './assembly-schedule.js';
import {
  appendMaterialSchedule,
  materialScheduleHeight,
  materialSchedulePosition,
} from './assembly-material-schedule.js';

import {
  singlePartMaterialPosition,
  singlePartMaterialData,
  appendSinglePartMaterialSchedule,
  singlePartMaterialSize,
} from './single-part-material-schedule.js';
import { assemblySchedule } from './project/assemblies.js';

import { drawingAssemblies } from './assembly-numbering.js';

const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
};
export function composePartSheet({
  svg,
  record,
  paper,
  config,
  extraSections,
  $,
  sectionTool,
  projectAnnotation,
  detailTool,
  frameLayout,
  getAttributeState,
  annotations,
  assembly,
  partMaterialPanel,
  paintAssemblySchedule,
  assemblyPanel,
  selectedViews,
  navigation,
  size,
  setContentBounds,
}) {
  applyDrawingFont(svg, record);
  const [w, h] = paper;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.replaceChildren(
    node('rect', {
      'data-paper-boundary': 'true',
      width: w,
      height: h,
      fill: 'white',
      stroke: '#899ba4',
      'stroke-width': 1,
      'vector-effect': 'non-scaling-stroke',
      'pointer-events': 'none',
    }),
  );
  const boxes = [];
  for (const v of extraSections.items)
    boxes.push([
      v.position[0],
      v.position[1],
      v.position[0] + v.size[0],
      v.position[1] + v.size[1],
    ]);
  $('message').textContent = boxes.some(([x, y, r, bot]) => x < 0 || y < 0 || r > w || bot > h)
    ? 'En vy ligger utanför bladet. Ändra skala, format eller placering.'
    : '';
  extraSections.paint();
  extraSections.options();
  for (const view of config.views) {
    paintDrawingTool(sectionTool, svg, view.id, (p) => projectAnnotation(p, view.id), 1);
    paintDrawingTool(detailTool, svg, view.id, (p) => projectAnnotation(p, view.id), 1);
    appendViewTitle(svg, view, view.position[0] + 1, view.position[1] + view.size[1]);
  }
  appendDrawingLayout(svg, frameLayout, drawingAttributeContext(record, getAttributeState()));
  annotations.render(svg);
  annotations.richText?.paint(svg);
  if (!assembly) {
    const settings = config.partMaterialSchedule;
    if (settings.dockToTop) settings.position = singlePartMaterialPosition(paper, frameLayout);
    const data = singlePartMaterialData(record, getAttributeState());
    appendSinglePartMaterialSchedule(svg, data, settings);
    for (const input of partMaterialPanel.querySelectorAll('input')) {
      const key = input.dataset.materialField;
      if (key === 'visible') input.checked = settings.visible;
      else input.value = settings.position[key === 'x' ? 0 : 1];
    }
    if (settings.visible && data && !data.verified)
      $('message').textContent =
        'Numrera om detaljerna för att uppdatera materiallistans antal och totaler.';
    if (
      settings.visible &&
      (settings.position[0] < 0 ||
        settings.position[1] < 0 ||
        settings.position[0] + singlePartMaterialSize[0] > w ||
        settings.position[1] + singlePartMaterialSize[1] > h)
    )
      $('message').textContent =
        'Materiallistan ligger utanför bladet. Ändra placering eller välj ett större format.';
  }
  if (assembly) {
    const schedule = config.assemblySchedule;
    const table = assemblyScheduleTable(assemblySchedule(assembly, getAttributeState()), schedule);
    if (schedule.style === 'material' && schedule.dockToTitle)
      schedule.position = materialSchedulePosition(table, paper, frameLayout);
    paintAssemblySchedule();
    for (const input of assemblyPanel.querySelectorAll('input')) {
      const key = input.dataset.scheduleField;
      if (key === 'visible') input.checked = schedule.visible;
      else input.value = schedule.position[key === 'x' ? 0 : 1];
    }
    if (
      schedule.visible &&
      (schedule.position[0] < 0 ||
        schedule.position[0] + table.width > w ||
        schedule.position[1] - (schedule.style === 'material' ? 0 : table.rowHeight) < 0 ||
        schedule.position[1] +
          (schedule.style === 'material'
            ? materialScheduleHeight(table)
            : table.values.length * table.rowHeight) >
          h)
    )
      $('message').textContent =
        'Stycklistan ligger utanför bladet. Ändra placering under Stycklista eller välj ett större format.';
  }
  for (const selected of annotations.selected || annotations.mode ? [] : selectedViews()) {
    const handles = node('g', {
      'data-view': selected.id,
      class: 'drawing-view-grips-layer',
      transform: `translate(${selected.position})`,
    });
    appendDrawingViewGrips(handles, ...selected.size, navigation.scale);
    svg.append(handles);
  }
  const guides = [...svg.querySelectorAll('.section-extent-guides')];
  guides.forEach((n) => (n.style.display = 'none'));
  setContentBounds(pasteboardBounds(paper, svg.getBBox()));
  guides.forEach((n) => n.style.removeProperty('display'));
  size();
}
export function paintPartAssemblySchedule({ config, assembly, getAttributeState, svg, record }) {
  const settings = config.assemblySchedule;
  if (!settings?.visible) return;
  const table = assemblyScheduleTable(assemblySchedule(assembly, getAttributeState()), settings),
    [x, y] = settings.position,
    widths = table.columns.map((c) => c.width),
    height = table.rowHeight,
    g = node('g', {
      'data-assembly-schedule': assembly.id,
      transform: `translate(${x},${y})`,
      'font-size': table.settings.textSize,
    });
  if (table.settings.style === 'material') {
    appendMaterialSchedule(
      svg,
      table,
      assembly.id,
      drawingAssemblies(record, getAttributeState()).length,
    );
    return;
  }
  g.append(
    node(
      'text',
      { x: 0, y: -3, 'font-weight': 'bold' },
      `${assembly.mark} · ${drawingAssemblies(record, getAttributeState()).length} st assemblies · Stycklista per assembly`,
    ),
  );
  const values = table.values;
  values.forEach((row, i) => {
    let left = 0;
    row.forEach((value, j) => {
      g.append(
        node('rect', {
          x: left,
          y: i * height,
          width: widths[j],
          height,
          fill: i ? 'white' : '#eef3f2',
          stroke: '#899ba4',
          'stroke-width': 0.15,
        }),
      );
      const clipId = `assembly-cell-${i}-${j}`;
      const clip = node('clipPath', { id: clipId });
      clip.append(node('rect', { x: left + 1, y: i * height, width: widths[j] - 2, height }));
      g.append(
        clip,
        node(
          'text',
          {
            x: left + 1.5,
            y: i * height + height / 2 + table.settings.textSize * 0.35,
            'clip-path': `url(#${clipId})`,
          },
          value,
        ),
      );
      left += widths[j];
    });
  });
  svg.append(g);
}
export function syncPartViewInspector({
  profileDetailControl,
  viewName,
  config,
  selectedView,
  $,
  extraSections,
  viewPlacement,
}) {
  profileDetailControl?.sync();
  if (viewName)
    viewName.value =
      config.views?.find((v) => v.id === selectedView)?.name ||
      { top: 'Top', front: 'Front', section: 'Sektion A–A' }[selectedView] ||
      '';
  $('hidden-lines').checked = !!viewById(config, selectedView)?.settings.hiddenLines;
  $('selected-view').value = selectedView || '';
  $('hidden-lines').disabled = !selectedView;
  if (viewName) viewName.disabled = !selectedView;
  for (const v of ['top', 'front', 'section']) $('scale-' + v).parentElement.hidden = true;
  $('section').parentElement.hidden = true;
  $('scale-section').parentElement.hidden = true;
  extraSections?.sync();
  viewPlacement?.sync();
}
