import { createSvgGrip, updateSvgGrip, updateScreenGrips } from './ui/grip.js';
export function drawingViewGrips(width, height) {
  return [
    ['nw', 0, 0],
    ['n', width / 2, 0],
    ['ne', width, 0],
    ['e', width, height / 2],
    ['se', width, height],
    ['s', width / 2, height],
    ['sw', 0, height],
    ['w', 0, height / 2],
    ['move', width / 2, height / 2],
  ].map(([kind, x, y]) => ({ kind, x, y }));
}
export function viewGripCursor(kind) {
  return kind === 'move'
    ? 'move'
    : kind === 'n' || kind === 's'
      ? 'ns-resize'
      : kind === 'e' || kind === 'w'
        ? 'ew-resize'
        : kind === 'nw' || kind === 'se'
          ? 'nwse-resize'
          : 'nesw-resize';
}
export function appendDrawingViewGrips(group, width, height, zoom) {
  for (const { kind, x, y } of drawingViewGrips(width, height)) {
    const handle = createSvgGrip({
      point: [x, y],
      role: kind === 'move' ? 'move' : 'point',
      zoom,
      key: `view:${group.dataset.view}:${kind}`,
      label: kind === 'move' ? 'Flytta vyn' : 'Beskär vyn · skalan behålls',
      attrs: { 'data-view-grip': kind, ...(kind === 'move' ? {} : { 'data-section-crop': kind }) },
    });
    handle.classList.add('drawing-view-grip');
    handle.style.cursor = viewGripCursor(kind);
    group.append(handle);
  }
}
export function updateDrawingViewGripSizes(root, zoom) {
  for (const grip of root.querySelectorAll('.drawing-view-grip')) updateSvgGrip(grip, zoom);
  updateScreenGrips(root);
}
