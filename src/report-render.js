import { appendDrawingLayout } from './drawing-layout.js';
import { paginateReport } from './report-pagination.js';
import { validateReportViewport } from './report-layout.js';
import { reportTableStyle, reportFonts } from './report-table-style.js';
import { reportPageContext } from './report-record.js';
const NS = 'http://www.w3.org/2000/svg';
function node(tag, attrs, text) {
  const el = document.createElementNS(NS, tag);
  if (tag === 'text') el.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
  for (const [key, value] of Object.entries(attrs || {})) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}
export function renderReport({
  title,
  rows,
  columns,
  firstLayout,
  nextLayout,
  fontSize,
  project,
  blocks,
  tableStyle,
  properties = {},
  rowKinds = [],
  rowCount = rows.length,
}) {
  const style = reportTableStyle(tableStyle);
  const areaForPage = (i) => validateReportViewport(i ? nextLayout : firstLayout);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const measure =
    (font, size, bold = false) =>
    (text) => {
      ctx.font = `${bold ? 'bold ' : ''}${size * 10}px ${reportFonts[font].measure}`;
      return ctx.measureText(text).width / 10;
    };
  const pages = paginateReport(rows, columns, areaForPage, {
    fontSize,
    titleHeight: style.tableOnly ? 0 : 12,
    measure: rowKinds.some((kind) => kind !== 'data')
      ? (text) =>
          Math.max(measure(style.font, fontSize)(text), measure(style.font, fontSize, true)(text))
      : measure(style.font, fontSize),
    headerMeasure: measure(style.headerFont, style.headerSize, style.headerBold),
    headerSize: style.headerSize,
    paddingX: style.paddingX,
    paddingY: style.paddingY,
    lineSpacing: style.lineSpacing,
  });
  return pages.map((page, i) => {
    const layout = i ? nextLayout : firstLayout;
    const svg = node('svg', {
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      'font-family': 'Arial, sans-serif',
      role: 'img',
      'aria-label': `${title} · sida ${i + 1} av ${pages.length}`,
    });
    svg.append(node('rect', { width: layout.width, height: layout.height, fill: 'white' }));
    appendDrawingLayout(
      svg,
      layout,
      reportPageContext(project, { ...properties, title }, i + 1, pages.length, rowCount),
      blocks,
    );
    const a = page.area;
    if (!style.tableOnly) {
      svg.append(
        node(
          'text',
          { x: a.x, y: a.y + 4, 'font-size': 4, 'font-weight': 'bold', fill: '#263b43' },
          title,
        ),
      );
      svg.append(
        node(
          'text',
          { x: a.x, y: a.y + 9, 'font-size': 2.6, fill: '#61777c' },
          project.name || project.number || '',
        ),
      );
      svg.append(
        node(
          'text',
          { x: a.x + a.width, y: a.y + 9, 'text-anchor': 'end', 'font-size': 2.6, fill: '#61777c' },
          `Sida ${i + 1} av ${pages.length}`,
        ),
      );
    }
    let y = a.y + page.titleHeight;
    const paintRow = (cells, height, header = false, index = 0) => {
      const summary = ['subtotal', 'total'].includes(rowKinds[index]) && !header;
      svg.append(
        node('rect', {
          x: a.x,
          y,
          width: a.width,
          height,
          fill:
            header || summary
              ? style.headerFill
              : style.striped && index % 2
                ? style.stripeFill
                : style.fill,
          stroke: style.borderWidth ? style.borderColor : 'none',
          'stroke-width': style.borderWidth,
        }),
      );
      let x = a.x;
      cells.forEach((lines, c) => {
        if (c)
          svg.append(
            node('line', {
              x1: x,
              y1: y,
              x2: x,
              y2: y + height,
              stroke: style.borderWidth ? style.borderColor : 'none',
              'stroke-width': style.borderWidth,
            }),
          );
        const align = ['start', 'middle', 'end'].includes(columns[c].align)
          ? columns[c].align
          : 'start';
        const textX =
          align === 'end'
            ? x + page.widths[c] - page.paddingX
            : align === 'middle'
              ? x + page.widths[c] / 2
              : x + page.paddingX;
        const size = header ? page.headerSize : fontSize;
        lines.forEach((line, n) =>
          svg.append(
            node(
              'text',
              {
                x: textX,
                y:
                  y + page.paddingY + size + n * (header ? page.headerLineHeight : page.lineHeight),
                'text-anchor': align,
                'font-size': size,
                'font-family': reportFonts[header ? style.headerFont : style.font].css,
                'font-weight': (header && style.headerBold) || summary ? 'bold' : 'normal',
                fill: header || summary ? style.headerColor : style.textColor,
              },
              line,
            ),
          ),
        );
        x += page.widths[c];
      });
      y += height;
    };
    paintRow(page.headings, page.headerHeight, true);
    page.rows.forEach((row) => paintRow(row.cells, row.height, false, row.index));
    if ((a.fillViewport ?? style.fillViewport) && a.y + a.height - y > 0.000001) {
      paintRow(
        columns.map(() => []),
        a.y + a.height - y,
        false,
        -1,
      );
    }
    if (!rows.length && !style.tableOnly)
      svg.append(
        node(
          'text',
          { x: a.x + 2, y: y + 6, 'font-size': fontSize, fill: '#61777c' },
          properties.kind === 'material-list'
            ? 'Inga delar matchar urvalet.'
            : 'Inga ritningar matchar urvalet.',
        ),
      );
    return {
      svg,
      width: layout.width,
      height: layout.height,
      orientation: layout.width > layout.height ? 'landscape' : 'portrait',
    };
  });
}
