const paths = {
  folder: 'M3 6h7l2 2h9v12H3ZM3 6V4h7l2 2',
  cube: 'm12 3 9 5v8l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v8',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  workArea: 'M5 5h14v14H5ZM3 3h4v4H3ZM17 17h4v4h-4Z',
  workAreaFit: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M7 9l5-3 5 3v6l-5 3-5-3ZM7 9l5 3 5-3M12 12v6',
  elevations: 'M3 4h12M3 20h12M18 4v16M15 7l3-3 3 3M15 17l3 3 3-3M6 8h6v8H6Z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M4 10h16v12H4ZM12 14v4',
  insulation: 'M3 6h18v12H3ZM3 18l3-12 3 12 3-12 3 12 3-12 3 12',
  properties: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  profile: 'M5 3h14v3h-5v12h5v3H5v-3h5V6H5Z',
  referenceWhole:
    'M7 3H3v4M17 3h4v4M3 17v4h4M21 17v4h-4M6 6h5v5H6ZM13 6h5v5h-5ZM6 13h5v5H6ZM13 13h5v5h-5Z',
  referenceObject: [
    'M5 5h5v5H5ZM5 14h5v5H5ZM14 14h5v5h-5Z',
    'M12 6V3h3M18 3h3v3M21 9v3h-3M15 12h-3V9M15 6h3v3h-3Z',
  ],
  references: 'M5 3h11v14H5ZM9 17v4h11V7h-4M8 7h5M8 11h5',
  origin: 'M12 3v18M3 12h18M8 8h8v8H8Z',
  delete: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  library: 'M3 4h5v16H3ZM10 4h5v16h-5ZM17 4l4 1-2 15-4-1',
  gridLocked: 'M6 3v16M14 3v7M3 6h15M3 14h7M14 16v-3a3 3 0 0 1 6 0v3M12 16h10v6H12Z',
  gridUnlocked: 'M6 3v16M14 3v7M3 6h15M3 14h7M16 16v-3a3 3 0 0 1 6 0M12 16h10v6H12Z',
  grid: 'M6 3v18M18 3v18M3 6h18M3 18h18',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 3h4l1 3 3 1 3 3v4l-3 1-1 3-3 3h-4l-1-3-3-1-3-3v-4l3-1 1-3Z',
  detail: 'M3 3h12v12H3zM15 15l6 6M7 9h4M9 7v4',
  section: 'M5 3v18M19 3v18M2 7h7m-3-3 3 3-3 3M16 7h7m-3-3 3 3-3 3M5 15h14',
  select: 'm5 3 14 10-7 1-3 7Z',
  boxSelect: 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M3 11v2M11 3h2M21 11v2M11 21h2',
  dimension: 'M4 4v16M20 4v16M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3',
  text: 'M4 20 12 4l8 16M7 14h10',
  leader: 'M3 20l8-10h10M3 20l1-6M3 20l6-2',
  plus: 'M12 5v14M5 12h14',
  fit: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8z',
  layout: 'M3 3h12v6H3zM3 13h12v8H3zM18 13h3v8h-3z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'm5 12 4 4L19 6',
  number: 'M9 3 7 21M17 3l-2 18M4 8h17M3 16h17',
  down: 'm8 10 4 4 4-4',
  page: 'M5 3h10l4 4v14H5zM14 3v5h5',
  line: 'M4 20 20 4',
  polyline: 'm3 18 6-12 6 12 6-12',
  polygon: 'M12 3 21 9 18 21H6L3 9Z',
  circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  rectangle: 'M3 6h18v12H3Z',
  arc: 'M4 19a10 10 0 0 1 16-12',
  move: 'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
  copy: 'M8 8h13v13H8ZM3 16V3h13',
  rotate: 'M20 7a9 9 0 1 0 1 7M20 2v6h-6',
  undo: 'M8 4 3 9l5 5M3 9h10a6 6 0 0 1 0 12',
  redo: 'm16 4 5 5-5 5M21 9H11a6 6 0 0 0 0 12',
  save: 'M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8',
};
export function commandIcon(name = 'page') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = paths[name] || paths.page;
  svg.innerHTML = Array.isArray(path)
    ? path.map((d, i) => `<path d="${d}" opacity="${i ? 1 : 0.4}"/>`).join('')
    : `<path d="${path}"/>`;
  return svg;
}
