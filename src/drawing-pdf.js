import { appendViewTitle } from './drawing-view-title.js';
const svgNS = 'http://www.w3.org/2000/svg';
const controls =
  '.viewport-grip,.viewport-frame,.section-extent-guides,[data-section-endpoint],[data-detail-corner],[data-section-crop],.annotation-anchor,.annotation-hit';
export function pdfFileName(records) {
  const name = records.length === 1 ? records[0].number : 'Ritningar';
  return `${String(name || 'Ritning').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')}.pdf`;
}
export function pdfPageSize(width, height) {
  if (![width, height].every((v) => Number.isFinite(v) && v >= 50 && v <= 5000))
    throw Error('Ritningens pappersformat är ogiltigt.');
  return { width, height, orientation: width > height ? 'landscape' : 'portrait' };
}
function cleanSVG(source) {
  const svg = source.cloneNode(true);
  svg.querySelectorAll(controls).forEach((n) => n.remove());
  svg.querySelectorAll('[data-paper-boundary]').forEach((n) => n.setAttribute('stroke', 'none'));
  for (const node of [svg, ...svg.querySelectorAll('[font-weight]')]) {
    const weight = node.getAttribute('font-weight');
    if (weight && Number.isFinite(+weight))
      node.setAttribute('font-weight', +weight >= 600 ? 'bold' : 'normal');
  }
  svg.removeAttribute('class');
  svg.removeAttribute('style');
  return svg;
}
function namespaceSVG(svg, prefix) {
  const ids = new Map(
    [...svg.querySelectorAll('[id]')].map((node) => [node.id, `${prefix}-${node.id}`]),
  );
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) {
      let value = attr.value;
      if (attr.name === 'id' && ids.has(value)) value = ids.get(value);
      else
        for (const [old, replacement] of ids) {
          value = value.split(`url(#${old})`).join(`url(#${replacement})`);
          if (value === `#${old}`) value = `#${replacement}`;
        }
      attr.value = value;
    }
  }
  return svg;
}
export function singlePartPDFPage(editor) {
  const [width, height] = editor.paper;
  const svg = cleanSVG(editor.svg);
  return { ...pdfPageSize(width, height), svg };
}
export function gaPDFPage(editor) {
  const { width, height } = editor.frameLayout;
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  for (const view of editor.views.items) {
    editor.views.load(view);
    editor.rebuild();
    editor.draw();
    const content = namespaceSVG(cleanSVG(editor.svg), view.id);
    content.setAttribute('x', view.position[0]);
    content.setAttribute('y', view.position[1]);
    content.setAttribute('width', view.size[0]);
    content.setAttribute('height', view.size[1]);
    content.setAttribute('overflow', 'hidden');
    content.querySelectorAll('.drawing-view-title').forEach((n) => n.remove());
    // Grid bubbles are DOM overlays in the editor; reproduce them as vector SVG.
    if (editor.grid.group.visible)
      for (const { el } of editor.grid.labels) {
        if (el.hidden) continue;
        const x = parseFloat(el.style.left),
          y = parseFloat(el.style.top),
          radius = 3 * editor.paperZoom;
        if (![x, y, radius].every(Number.isFinite)) continue;
        const circle = document.createElementNS(svgNS, 'circle');
        for (const [key, value] of Object.entries({
          cx: x,
          cy: y,
          r: radius,
          fill: 'white',
          stroke: '#82969f',
          'stroke-width': 0.15 * editor.paperZoom,
        }))
          circle.setAttribute(key, value);
        const text = document.createElementNS(svgNS, 'text');
        for (const [key, value] of Object.entries({
          x,
          y: y + 0.9 * editor.paperZoom,
          'font-size': 2.5 * editor.paperZoom,
          'text-anchor': 'middle',
          fill: '#20343b',
        }))
          text.setAttribute(key, value);
        text.textContent = el.textContent;
        content.append(circle, text);
      }
    svg.append(content);
    appendViewTitle(svg, view, view.position[0] + 1, view.position[1] + view.size[1]);
  }
  const frame = namespaceSVG(cleanSVG(editor.frameSVG), 'frame');
  frame.setAttribute('width', width);
  frame.setAttribute('height', height);
  svg.append(frame);
  return { ...pdfPageSize(width, height), svg };
}
export async function createDrawingPDF(pages) {
  if (!pages.length) throw Error('Markera minst en ritning.');
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const first = pages[0];
  const doc = new jsPDF({
    unit: 'mm',
    format: [first.width, first.height],
    orientation: first.orientation,
    compress: true,
  });
  doc.setProperties({ title: 'Ritningar', creator: 'LiraStructure' });
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none';
  document.body.append(host);
  try {
    for (const [index, page] of pages.entries()) {
      pdfPageSize(page.width, page.height);
      if (index) doc.addPage([page.width, page.height], page.orientation);
      const svg = cleanSVG(page.svg);
      svg.setAttribute('width', page.width + 'mm');
      svg.setAttribute('height', page.height + 'mm');
      svg.setAttribute('font-family', 'Helvetica');
      host.replaceChildren(svg);
      await doc.svg(svg, { x: 0, y: 0, width: page.width, height: page.height });
    }
    return doc.output('blob');
  } finally {
    host.remove();
  }
}
export async function downloadDrawingPDF(blob, records, container) {
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error('PDF-filen kunde inte sparas.'));
    reader.readAsDataURL(blob);
  });
  const link = document.createElement('a');
  link.href = url;
  link.download = pdfFileName(records);
  link.textContent = 'Hämta PDF';
  container.replaceChildren(link);
  link.click();
}
