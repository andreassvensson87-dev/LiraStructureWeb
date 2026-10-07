/** Match the original multi-row cells and keep long attribute values inside them. */
export function frameText(e, context, resolve) {
  let value = String(e.type === 'attribute' ? resolve(e.key, context) : e.text || '');
  const capacity = Math.max(1, Math.floor((e.maxWidth || Infinity) / (e.size * 0.65)));
  if (e.rows > 1) {
    const lines = [];
    for (const paragraph of value.split(/\r?\n/)) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && `${line} ${word}`.length > capacity) {
          lines.push(line);
          line = '';
        }
        line = line ? `${line} ${word}` : word;
      }
      lines.push(line);
    }
    // Keep overflow on the final row and fit its font to the cell.
    value = e.row === e.rows - 1 ? lines.slice(e.row).join(' ') : lines[e.row] || '';
  } else value = value.replace(/\r?\n/g, ' ');
  const width = value.length * e.size * 0.65;
  return {
    value,
    size: e.maxWidth && width > e.maxWidth ? (e.size * e.maxWidth) / width : e.size,
  };
}
