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
  const NS = 'http://www.w3.org/2000/svg',
    size = 8 / zoom,
    hitSize = 18 / zoom;
  for (const { kind, x, y } of drawingViewGrips(width, height)) {
    const handle = document.createElementNS(NS, 'g');
    handle.classList.add('drawing-view-grip');
    handle.dataset.viewGrip = kind;
    handle.dataset.gripX = x;
    handle.dataset.gripY = y;
    if (kind !== 'move') handle.dataset.sectionCrop = kind;
    handle.style.cursor = viewGripCursor(kind);
    const title = document.createElementNS(NS, 'title');
    title.textContent = kind === 'move' ? 'Flytta vyn' : 'Beskär vyn · skalan behålls';
    handle.append(title);
    for (const [side, className] of [
      [hitSize, 'view-grip-hit'],
      [size, 'view-grip-marker'],
    ]) {
      const rect = document.createElementNS(NS, 'rect');
      for (const [key, value] of Object.entries({
        x: x - side / 2,
        y: y - side / 2,
        width: side,
        height: side,
        class: className,
        'vector-effect': 'non-scaling-stroke',
      }))
        rect.setAttribute(key, value);
      handle.append(rect);
    }
    group.append(handle);
  }
}
export function updateDrawingViewGripSizes(root, zoom) {
  for (const grip of root.querySelectorAll('.drawing-view-grip')) {
    for (const [className, pixels] of [
      ['view-grip-hit', 18],
      ['view-grip-marker', 8],
    ]) {
      const rect = grip.querySelector('.' + className),
        size = pixels / zoom;
      rect.setAttribute('x', Number(grip.dataset.gripX) - size / 2);
      rect.setAttribute('y', Number(grip.dataset.gripY) - size / 2);
      rect.setAttribute('width', size);
      rect.setAttribute('height', size);
    }
  }
}
