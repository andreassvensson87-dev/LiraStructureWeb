/** Measurements and output positions are millimetres, independent of preview zoom. */
export function wrapReportText(
  value,
  width,
  size,
  measure = (s) =>
    Array.from(s).reduce(
      (n, c) => n + (/[MW@]/.test(c) ? 0.85 : /[ilI., ]/.test(c) ? 0.28 : 0.56) * size,
      0,
    ),
) {
  if (!(width > 0)) throw Error('Kolumnen är för smal.');
  const lines = [];
  for (const paragraph of String(value ?? '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (line && measure(line + ' ' + word) <= width) {
        line += ' ' + word;
        continue;
      }
      if (line) {
        lines.push(line);
        line = '';
      }
      for (const char of word) {
        if (line && measure(line + char) > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}
export function paginateReport(
  rows,
  columns,
  areaForPage,
  {
    fontSize = 2.8,
    titleHeight = 12,
    padding = 2,
    paddingX = padding,
    paddingY = padding,
    lineSpacing = 1.4,
    headerSize = fontSize,
    measure,
    headerMeasure = measure,
  } = {},
) {
  if (!columns.length) throw Error('Välj minst en rapportkolumn.');
  if (
    !columns.every((c) => Number.isFinite(c.width) && c.width > 0) ||
    !Number.isFinite(fontSize) ||
    fontSize <= 0 ||
    ![paddingX, paddingY, lineSpacing, headerSize].every(Number.isFinite) ||
    paddingX < 0 ||
    paddingY < 0 ||
    lineSpacing < 1 ||
    headerSize <= 0
  )
    throw Error('Ogiltiga kolumnbredder eller texthöjd.');
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const textWidth = Math.min(areaForPage(0).width, areaForPage(1).width);
  const pages = [],
    lineHeight = fontSize * lineSpacing,
    headerLineHeight = headerSize * lineSpacing;
  const createPage = () => {
    const area = areaForPage(pages.length);
    const total = columns.reduce((sum, c) => sum + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * area.width);
    if (widths.some((w) => w <= paddingX * 2 + Math.max(fontSize, headerSize)))
      throw Error('Kolumnerna är för smala. Öka rapportytan eller minska antalet kolumner.');
    const headings = columns.map((c, i) =>
      wrapReportText(c.label, widths[i] - 2 * paddingX, headerSize, headerMeasure),
    );
    const headerHeight =
      Math.max(...headings.map((h) => h.length)) * headerLineHeight + 2 * paddingY;
    const capacity = area.height - titleHeight - headerHeight;
    if (capacity < lineHeight + 2 * paddingY)
      throw Error('Rapportytan är för låg för rubriker och tabellrader.');
    const page = {
      area,
      widths,
      headings,
      headerHeight,
      titleHeight,
      fontSize,
      lineHeight,
      padding,
      paddingX,
      paddingY,
      headerSize,
      headerLineHeight,
      rows: [],
      capacity,
      used: 0,
    };
    pages.push(page);
    return page;
  };
  let page = createPage();
  for (const [index, row] of rows.entries()) {
    let offset = 0;
    while (true) {
      const cells = row.map((value, i) =>
        wrapReportText(
          value,
          (columns[i].width / totalWidth) * textWidth - 2 * paddingX,
          fontSize,
          measure,
        ),
      );
      const count = Math.max(...cells.map((c) => c.length)),
        remaining = count - offset;
      const height = remaining * lineHeight + 2 * paddingY;
      if (height > page.capacity - page.used + 1e-6 && page.rows.length) {
        page = createPage();
        continue;
      }
      const take = Math.min(
        remaining,
        Math.floor((page.capacity - page.used - 2 * paddingY + 1e-6) / lineHeight),
      );
      if (take < 1) throw Error('Rapportytan rymmer inte en textrad.');
      const rowHeight = take * lineHeight + 2 * paddingY;
      page.rows.push({
        index,
        cells: cells.map((c) => c.slice(offset, offset + take)),
        height: rowHeight,
        continued: offset > 0,
      });
      page.used += rowHeight;
      offset += take;
      if (offset >= count) break;
      page = createPage();
    }
  }
  return pages;
}
