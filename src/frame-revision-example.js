import { blankFrame } from './frame-model.js';

export function revisionExampleBlock() {
  const frame = { ...blankFrame(), name: 'Ritningsblock med revision', width: 180, height: 74 };
  const line = (points) =>
    frame.entities.push({
      id: crypto.randomUUID(),
      type: 'line',
      points,
      stroke: 0.25,
      color: '#233940',
    });
  const text = (value, point, size = 2.5, attribute = false) =>
    frame.entities.push({
      id: crypto.randomUUID(),
      type: attribute ? 'attribute' : 'text',
      ...(attribute ? { key: value } : { text: value }),
      point,
      size,
      font: 'Arial',
      align: 'start',
      angle: 0,
      color: '#233940',
    });
  const field = (label, key, x, bottom, top, size = 3.5) => {
    text(label, [x + 2, top - 4], 2);
    text(key, [x + 2, bottom + 3], size, true);
  };
  line([
    [0, 0],
    [180, 0],
    [180, 74],
    [0, 74],
    [0, 0],
  ]);
  for (const y of [12, 24, 40, 54, 64])
    line([
      [0, y],
      [180, y],
    ]);
  for (const x of [16, 44, 80])
    line([
      [x, 54],
      [x, 74],
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
  field('PROJEKT', 'project.name', 0, 40, 54);
  field('PROJEKTNUMMER', 'project.number', 120, 40, 54);
  field('RITNINGSNAMN', 'drawing.name', 0, 24, 40, 4);
  field('RITAD AV', 'drawing.drawnBy', 0, 12, 24, 3);
  field('DATUM', 'drawing.date', 100, 12, 24, 3);
  field('GRANSKAD AV', 'drawing.checkedBy', 145, 12, 24, 3);
  field('RITNINGSNUMMER', 'drawing.number', 0, 0, 12, 3.5);
  field('TYP', 'drawing.type', 100, 0, 12, 3);
  field('REVISION', 'drawing.revision', 145, 0, 12, 3.5);
  for (const [label, key, x] of [
    ['REV.', 'drawing.revision', 0],
    ['DATUM', 'drawing.revisionDate', 16],
    ['SKAPAD AV', 'drawing.revisionCreatedBy', 44],
    ['KOMMENTAR', 'drawing.revisionComment', 80],
  ]) {
    text(label, [x + 2, 68], 2.5);
    text(key, [x + 2, 57], 3, true);
  }
  return frame;
}
