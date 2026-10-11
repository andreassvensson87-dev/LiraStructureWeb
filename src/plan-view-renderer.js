import { paintDrawingTool } from './drawing-tool-feedback.js';

import { vectorDrawing, appendVectorDrawing, appendModelFaces } from './drawing-vector.js';

import { appendViewTitle } from './drawing-view-title.js';

import { sectionGridLines, sectionLevelLines } from './section-grid.js';
import { visibleGridEndpoints } from './grid-label-position.js';
import {
  DRAWING_GRID_BUBBLE_DIAMETER,
  MODEL_GRID_BUBBLE_DIAMETER,
  modelGridBubbleMetrics,
  gridBubbleMetrics,
} from './grid-bubble-size.js';

import { appendMaterialHatch } from './drawing-hatch.js';
const svgNS = 'http://www.w3.org/2000/svg';
export function paintPlanView({
  svg,
  sections,
  center,
  span,
  annotations,
  modelFaces,
  record,
  hatchSurfaces,
  paperZoom,
  vectorCache,
  selectedParts,
  $,
  grid,
  drawSectionGrid,
  drawSectionLevels,
  frameSVG,
  views,
  references,
  sectionTool,
  detailTool,
  w,
  h,
}) {
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute(
    'd',
    (sections || [])
      .map(
        ([a, b]) =>
          `M${((a[0] - center.x) / span) * h + w / 2},${h / 2 - ((a[1] - center.y) / span) * h}L${((b[0] - center.x) / span) * h + w / 2},${h / 2 - ((b[1] - center.y) / span) * h}`,
      )
      .join(''),
  );
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#20343b');
  path.setAttribute('stroke-width', '2');
  const defs = document.createElementNS(svgNS, 'defs'),
    clip = document.createElementNS(svgNS, 'clipPath'),
    rect = document.createElementNS(svgNS, 'rect');
  clip.id = 'ga-active-crop';
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  clip.append(rect);
  defs.append(clip);
  const content = document.createElementNS(svgNS, 'g');
  content.setAttribute('clip-path', 'url(#ga-active-crop)');
  const project = (p) => [
    ((p[0] - center.x) / span) * h + w / 2,
    h / 2 - ((p[1] - center.y) / span) * h,
  ];
  if (annotations.items.some((item) => item.drawOrder === 'back'))
    appendModelFaces(content, modelFaces, project);
  if (record.settings.materialHatch !== false)
    appendMaterialHatch(content, hatchSurfaces, project, paperZoom || 1);
  appendVectorDrawing(
    content,
    vectorCache.map((set) =>
      selectedParts.has(set.sourceId) ? { ...set, color: '#16815e' } : set,
    ),
    project,
    {
      hidden: $('hidden-lines').checked,
      width: 0.18 * paperZoom,
      dash: 2 * paperZoom,
      gap: paperZoom,
    },
  );
  if (grid.group.visible) {
    const gridLines = grid.group.children.map((line) => ({
      geometry: line.geometry,
      overlay: true,
      dashed: true,
      color: '#82969f',
    }));
    appendVectorDrawing(content, vectorDrawing([], gridLines), project, {
      width: 0.15 * paperZoom,
      dash: 4 * paperZoom,
      gap: 2 * paperZoom,
    });
  }
  content.append(path);
  svg.replaceChildren(defs, content);
  drawSectionGrid(content, w, h);
  drawSectionLevels(content, w, h);
  annotations.render(content);
  annotations.richText?.paint(frameSVG);
  if (views?.active) {
    references.sync();
    paintDrawingTool(
      sectionTool,
      content,
      views.active.id,
      (p) => annotations.adapter.project(p),
      paperZoom,
    );
    paintDrawingTool(
      detailTool,
      content,
      views.active.id,
      (p) => annotations.adapter.project(p),
      paperZoom,
    );
    appendViewTitle(svg, views.active, paperZoom, h, paperZoom);
  }
}
export function paintSectionGrid(
  {
    views,
    sectionSource,
    span,
    center,
    getState,
    sectionFrameFor,
    annotations,
    frameLayout,
    paperZoom,
  },
  root,
  w,
  h,
) {
  const view = views?.active;
  if (!sectionSource()?.section || view.settings.showGrid === false) return;
  const width = (span * w) / h,
    bounds = [center.x - width / 2, center.y - span / 2, center.x + width / 2, center.y + span / 2];
  const layer = document.createElementNS(svgNS, 'g');
  layer.setAttribute('class', 'section-grid');
  layer.setAttribute('pointer-events', 'none');
  root.append(layer);
  const append = (tag, attrs, text) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    layer.append(node);
  };
  for (const line of sectionGridLines(getState().grid, sectionFrameFor(view), bounds)) {
    const points = line.points.map((p) => annotations.adapter.project(p));
    append('path', {
      d: `M${points[0]}L${points[1]}`,
      stroke: '#82969f',
      'stroke-width': 1,
      'stroke-dasharray': '7 4',
      fill: 'none',
    });
    const metrics = frameLayout
        ? gridBubbleMetrics(line.label, DRAWING_GRID_BUBBLE_DIAMETER * paperZoom)
        : modelGridBubbleMetrics(line.label, (MODEL_GRID_BUBBLE_DIAMETER * h) / span),
      radius = metrics.radius,
      ends = visibleGridEndpoints(points[0], points[1], w, h, radius + metrics.inset);
    if (!ends) continue;
    ends.forEach((p, index) => {
      if (index && Math.hypot(p[0] - ends[0][0], p[1] - ends[0][1]) < radius * 2 + metrics.inset)
        return;
      append(frameLayout ? 'ellipse' : 'rect', {
        ...(frameLayout
          ? { cx: p[0], cy: p[1], rx: radius, ry: metrics.height / 2 }
          : {
              x: p[0] - radius,
              y: p[1] - metrics.height / 2,
              width: radius * 2,
              height: metrics.height,
              rx: metrics.height / 2,
              ry: metrics.height / 2,
            }),
        fill: '#edf3f5',
        stroke: '#718995',
        'stroke-width': metrics.strokeWidth,
      });
      append(
        'text',
        {
          x: p[0],
          y: p[1],
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-size': metrics.fontSize,
          'font-family': 'Arial, sans-serif',
          fill: '#425d69',
        },
        line.label,
      );
    });
  }
}
export function paintSectionLevels(
  { views, sectionSource, span, center, getState, sectionFrameFor, annotations },
  root,
  w,
  h,
) {
  const view = views?.active;
  if (!sectionSource()?.section || view.settings.showLevels === false) return;
  const width = (span * w) / h,
    bounds = [center.x - width / 2, center.y - span / 2, center.x + width / 2, center.y + span / 2],
    layer = document.createElementNS(svgNS, 'g');
  layer.setAttribute('class', 'section-levels');
  layer.setAttribute('pointer-events', 'none');
  root.append(layer);
  const append = (tag, attrs, text) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    layer.append(node);
    return node;
  };
  for (const level of sectionLevelLines(getState().levels.items, sectionFrameFor(view), bounds)) {
    const [a, b] = level.points.map((p) => annotations.adapter.project(p)),
      left = a[0] <= b[0] ? a : b;
    append('path', {
      d: `M${a}L${b}`,
      stroke: '#758e9b',
      'stroke-width': 1,
      'stroke-dasharray': '10 4 2 4',
      fill: 'none',
    });
    const x = Math.max(7, Math.min(w - 7, left[0] + 7)),
      y = left[1];
    append('path', { d: `M${x},${y}l5,-5h-10Z`, fill: '#758e9b' });
    const label =
      level.name +
      ' · ' +
      (level.elevation >= 0 ? '+' : '') +
      level.elevation.toLocaleString('sv-SE') +
      ' mm';
    append(
      'text',
      {
        x: Math.max(7, Math.min(w - 10, left[0] + 16)),
        y: Math.max(13, Math.min(h - 5, y - 7)),
        'font-size': 11,
        'font-family': 'Arial, sans-serif',
        fill: '#425d69',
        stroke: 'white',
        'stroke-width': 3,
        'paint-order': 'stroke',
      },
      label,
    );
  }
}
