import fs from 'node:fs';
import { format } from 'prettier';
import { parseFrameDXF, frameFromDXF } from '../src/frame-dxf.js';

// Original CAD files are retained alongside the generated, editable library.
const directory = new URL('../assets/drawing-templates/', import.meta.url);
const read = (name) => {
  const { frame, skipped } = frameFromDXF(
    parseFrameDXF(fs.readFileSync(new URL(`${name}.dxf`, directory), 'utf8')),
    { name },
  );
  if (skipped.length) throw Error(`${name}: unsupported entities: ${skipped.join(', ')}`);
  frame.id = `mall-${name.toLowerCase()}`;
  const points = frame.entities.filter((e) => e.points).flatMap((e) => e.points);
  const min = [0, 1].map((i) => Math.min(...points.map((p) => p[i])));
  const max = [0, 1].map((i) => Math.max(...points.map((p) => p[i])));
  // CAD insertion origins can be far outside the paper (particularly A4).
  frame.origin = [0, 0];
  frame.width = max[0] - min[0];
  frame.height = max[1] - min[1];
  frame.entities.forEach((e, i) => {
    e.id = `${frame.id}-${i}`;
    const move = (p) => p.map((n, axis) => +(n - min[axis]).toFixed(6));
    if (e.points) e.points = e.points.map(move);
    else e.point = move(e.point);
    e.color = '#000000';
  });
  return frame;
};

// The supplied files use ordinary TEXT placeholders, not ATTDEF/ATTRIB.
// Map each value by its original cell, leaving the small captions intact.
const a1 = [
  ['drawing.issueStatus', 50, 114, 96],
  ['drawing.documentType', 50, 104, 96],
  ['drawing.date', 1, 96, 18],
  ['drawing.revisionComment', 21, 96, 77],
  ['project.name', 1, 87, 96],
  ['project.client', 1, 78, 96],
  ['drawing.contact', 1, 43, 47],
  ['drawing.drawnBy', 51, 43, 47],
  ['drawing.checkedBy', 1, 35, 47],
  ['project.number', 51, 35, 47],
  ['drawing.category', 1, 27, 96],
  ['drawing.name', 1, 20.5, 76],
  ['drawing.name', 1, 15.5, 76],
  ['drawing.name', 1, 10.5, 76],
  ['drawing.paperFormat', 81, 19, 17],
  ['drawing.scale', 81, 11, 17],
  ['drawing.revision', 80.5, 1, 17],
  ['drawing.number', 0.5, 1, 76],
];
const small = [
  ['drawing.issueStatus', 131, 37, 47],
  ['drawing.documentType', 131, 27, 47],
  ['drawing.revisionComment', 131, 19, 32],
  ['drawing.date', 131, 11, 32],
  ['drawing.paperFormat', 166, 19, 12],
  ['drawing.scale', 166, 11, 12],
  ['drawing.number', 131, 1, 32],
  ['drawing.revision', 166, 1, 12],
  ['project.name', 51, 38, 77],
  ['project.client', 51, 28.7, 77],
  ['drawing.category', 51, 19, 77],
  ['drawing.name', 51, 12.5, 77],
  ['drawing.name', 51, 7, 77],
  ['drawing.name', 51, 1.5, 77],
  ['drawing.checkedBy', 1, 1, 47],
  ['drawing.contact', 1, 8, 47],
  ['drawing.drawnBy', 1, 15, 47],
  ['project.number', 1, 22, 47],
];
const title = (name, mapping) => {
  const frame = read(name);
  frame.titleBlock = true;
  for (const [key, x, y, maxWidth] of mapping) {
    const e = frame.entities.find(
      (e) =>
        e.type === 'text' && Math.abs(e.point[0] - x) < 0.01 && Math.abs(e.point[1] - y) < 0.01,
    );
    if (!e) throw Error(`${name}: missing cell ${x}, ${y}`);
    e.type = 'attribute';
    e.key = key;
    delete e.text;
    e.size = Math.min(e.size, key === 'drawing.scale' ? 2.5 : 3.5);
    e.maxWidth = maxWidth;
    if (y === 1) e.point[1] = 2;
    if (x === 0.5) e.point[0] = 1;
  }
  // INNEHÅLL has three lines in the original template. Wrap a single value.
  const nameRows = frame.entities.filter((e) => e.key === 'drawing.name');
  nameRows.sort((a, b) => b.point[1] - a.point[1]);
  nameRows.forEach((e, i) => {
    e.row = i;
    e.rows = nameRows.length;
  });
  for (const e of frame.entities) if (e.type === 'text' && e.align === 'end') e.point[0] -= 1;
  frame.entities.push({
    id: `${frame.id}-responsible`,
    type: 'attribute',
    key: 'drawing.responsibleParty',
    point: [1, name.endsWith('A1') ? 55 : 32],
    size: 3.5,
    maxWidth: name.endsWith('A1') ? 96 : 47,
    font: 'Arial, sans-serif',
    align: 'start',
    color: '#000000',
    angle: 0,
  });
  return frame;
};
const blocks = [
  title('Rithuvud_A1', a1),
  title('Rithuvud_A3_A4', small),
  ...['A1', 'A3', 'A4'].map((id) => read(`Ritram_${id}`)),
];
const layouts = ['A1', 'A3', 'A4'].map((paper) => {
  const frame = blocks.find((b) => b.name === `Ritram_${paper}`);
  const head = blocks[paper === 'A1' ? 0 : 1];
  const margin = paper === 'A1' ? 20 : 10;
  return {
    id: `mall-layout-${paper.toLowerCase()}`,
    kind: 'layout',
    name: `${paper} · ritram och rithuvud`,
    width: frame.width,
    height: frame.height,
    paperFormat: paper,
    // Top-left paper coordinates; reserve the title strip when arranging views.
    contentArea: [
      paper === 'A1' ? 40 : 20,
      margin,
      frame.width - margin,
      frame.height - margin - head.height - 6,
    ],
    entities: [
      {
        id: `${paper}-frame`,
        type: 'block',
        blockId: frame.id,
        anchor: 'bottom-left',
        point: [0, 0],
        angle: 0,
      },
      {
        id: `${paper}-title`,
        type: 'block',
        blockId: head.id,
        anchor: 'bottom-right',
        point: [-margin - head.width, margin],
        angle: 0,
      },
    ],
  };
});
fs.writeFileSync(
  new URL('../src/bundled-drawing-templates.js', import.meta.url),
  await format(
    '// Generated by scripts/import-drawing-templates.mjs from assets/drawing-templates.\n' +
      'export default ' +
      JSON.stringify({ blocks, layouts }, null, 2) +
      ';\n',
    { parser: 'babel', singleQuote: true, printWidth: 100 },
  ),
);
