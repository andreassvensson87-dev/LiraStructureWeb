export function newDrawingText(position, width = 80) {
  return {
    id: crypto.randomUUID(),
    type: 'richtext',
    view: 'paper',
    points: [[...position]],
    width: Math.max(10, width),
    font: 'Arial',
    textSize: 3.5,
    lineSpacing: 1.2,
    paragraphs: [{ runs: [{ text: '' }], align: 'left', list: null }],
    frame: false,
    background: false,
  };
}

// Layout is shared by screen and PDF. The caller supplies font measurement.
export function layoutDrawingText(item, measure) {
  const lines = [];
  let number = 0;
  const size = item.textSize,
    spacing = size * item.lineSpacing;
  for (const paragraph of item.paragraphs) {
    number = paragraph.list === 'number' ? number + 1 : 0;
    const prefix = paragraph.list === 'bullet' ? '• ' : number ? number + '. ' : '';
    const indent = prefix ? size * 1.5 : 0;
    let runs = [],
      width = 0,
      first = true;
    const pushLine = () => {
      lines.push({
        runs,
        width,
        indent,
        prefix: first ? prefix : '',
        align: paragraph.align,
      });
      runs = [];
      width = 0;
      first = false;
    };
    for (const run of paragraph.runs) {
      for (const token of run.text.split(/(\s+)/).filter(Boolean)) {
        for (const chunk of token.split(/(\n)/)) {
          if (chunk === '\n') {
            pushLine();
            continue;
          }
          if (!chunk) continue;
          if (width && width + measure(chunk, run) > item.width - indent) pushLine();
          // Long words also wrap; retain styles across the break.
          for (const char of chunk) {
            if (width && width + measure(char, run) > item.width - indent) pushLine();
            const last = runs.at(-1);
            if (
              last &&
              last.bold === run.bold &&
              last.italic === run.italic &&
              last.underline === run.underline
            )
              last.text += char;
            else runs.push({ ...run, text: char });
            width += measure(char, run);
          }
        }
      }
    }
    pushLine();
  }
  return { lines, height: Math.max(spacing, lines.length * spacing), size, spacing };
}
