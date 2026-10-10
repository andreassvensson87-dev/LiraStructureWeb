// Minimal editable blocks for layout/revision tests; not bundled app templates.
import { blankFrame } from '../../src/frame-model.js';

export function titleExampleBlock() {
  const frame = {
    ...blankFrame(),
    name: 'Ritningshuvud',
    width: 180,
    height: 54,
    titleBlock: true,
  };
  const line = (points) =>
    frame.entities.push({
      id: crypto.randomUUID(),
      type: 'line',
      points,
      stroke: 0.25,
      color: '#233940',
    });
  const text = (value, point, size, attribute = false) =>
    frame.entities.push({
      id: crypto.randomUUID(),
      type: attribute ? 'attribute' : 'text',
      ...(attribute ? { key: value } : { text: value }),
      point,
      size,
      font: 'Arial, sans-serif',
      align: 'start',
      color: '#233940',
      angle: 0,
    });
  line([
    [0, 0],
    [180, 0],
    [180, 54],
    [0, 54],
    [0, 0],
  ]);
  for (const y of [12, 24, 40])
    line([
      [0, y],
      [180, y],
    ]);
  for (const x of [100, 145])
    line([
      [x, 0],
      [x, 24],
    ]);
  line([
    [120, 40],
    [120, 54],
  ]);
  for (const [label, key, x, bottom, top] of [
    ['PROJEKT', 'project.name', 0, 40, 54],
    ['PROJEKTNUMMER', 'project.number', 120, 40, 54],
    ['RITNINGSNAMN', 'drawing.name', 0, 24, 40],
    ['RITAD AV', 'drawing.drawnBy', 0, 12, 24],
    ['DATUM', 'drawing.date', 100, 12, 24],
    ['GRANSKAD AV', 'drawing.checkedBy', 145, 12, 24],
    ['RITNINGSNUMMER', 'drawing.number', 0, 0, 12],
    ['TYP', 'drawing.type', 100, 0, 12],
    ['REVISION', 'drawing.revision', 145, 0, 12],
  ]) {
    text(label, [x + 2, top - 4], 2);
    text(key, [x + 2, bottom + 3], 3, true);
  }
  return frame;
}

export function revisionExampleBlock() {
  const frame = {
    ...blankFrame(),
    name: 'Revisionsblock',
    width: 180,
    height: 20,
    revisionTable: { rowHeight: 10, headerPosition: 'bottom' },
  };
  const line = (points, revisionRole) =>
    frame.entities.push({
      id: crypto.randomUUID(),
      type: 'line',
      points,
      stroke: 0.25,
      color: '#233940',
      revisionRole,
    });
  const text = (value, point, revisionRole, attribute = false) =>
    frame.entities.push({
      id: crypto.randomUUID(),
      type: attribute ? 'attribute' : 'text',
      ...(attribute ? { key: value } : { text: value }),
      point,
      size: attribute ? 3 : 2.5,
      font: 'Arial, sans-serif',
      align: 'start',
      angle: 0,
      color: '#233940',
      revisionRole,
    });
  for (const [role, bottom] of [
    ['row', 10],
    ['header', 0],
  ]) {
    line(
      [
        [0, bottom],
        [180, bottom],
        [180, bottom + 10],
        [0, bottom + 10],
        [0, bottom],
      ],
      role,
    );
    for (const x of [16, 44, 80])
      line(
        [
          [x, bottom],
          [x, bottom + 10],
        ],
        role,
      );
  }
  for (const [label, key, x] of [
    ['REV.', 'drawing.revision', 0],
    ['DATUM', 'drawing.revisionDate', 16],
    ['SKAPAD AV', 'drawing.revisionCreatedBy', 44],
    ['KOMMENTAR', 'drawing.revisionComment', 80],
  ]) {
    text(label, [x + 2, 4], 'header');
    text(key, [x + 2, 13], 'row', true);
  }
  return frame;
}
