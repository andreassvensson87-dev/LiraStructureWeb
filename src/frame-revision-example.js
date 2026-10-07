import { blankFrame } from './frame-model.js';

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
