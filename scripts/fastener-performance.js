import { defaultFasteners } from '../src/fasteners/default-catalog.js';
import { defaultHoleForSpec } from '../src/fasteners/library.js';
import { preparePickedFasteners } from '../src/fasteners/placement-draft.js';
import { transformObject } from '../src/transform.js';

/** Repeated real joints: 100 bolts through two plates per tile, including linked bore markers. */
export function fastenerPerformanceModel(count = 10000) {
  if (!Number.isInteger(count) || count < 100 || count > 20000 || count % 100)
    throw Error('Use 100–20000 screws in steps of 100.');
  const frame = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] };
  const plates = [
    {
      id: 'lower',
      type: 'plate',
      name: 'Undre plåt',
      frame,
      thickness: 12,
      side: 'positive',
      polygon: [
        [-200, -200],
        [200, -200],
        [200, 200],
        [-200, 200],
      ],
    },
    {
      id: 'upper',
      type: 'plate',
      name: 'Övre plåt',
      frame: { ...frame, origin: [0, 0, 12] },
      thickness: 10,
      side: 'positive',
      polygon: [
        [-180, -180],
        [180, -180],
        [180, 180],
        [-180, 180],
      ],
    },
  ];
  const spec = defaultFasteners().find((s) => s.standard === 'ISO 4017' && s.diameter === 12);
  const source = preparePickedFasteners(
    {
      type: 'fastener',
      spec,
      anchorId: 'lower',
      assembly: { bolt: true, nearWasher: true, farWasher: true, nut: true },
      holes: plates.map((p) => defaultHoleForSpec(spec, p.id)),
      group: {
        id: 'joint',
        shape: 'array',
        rows: 10,
        columns: 10,
        distancesX: Array(9).fill(30),
        distancesY: Array(9).fill(30),
        rotation: 0,
      },
    },
    { start: [-135, -135, 22], xPoint: [135, -135, 22], frame, model: plates },
  );
  const model = [];
  for (let tile = 0, remaining = count; remaining > 0; tile++) {
    const delta = [(tile % 10) * 500, Math.floor(tile / 10) * 500, 0];
    for (const p of plates)
      model.push({ ...transformObject(p, 'move', [0, 0, 0], delta), id: `${p.id}-${tile}` });
    for (const [i, s] of source.slice(0, Math.min(100, remaining)).entries()) {
      const moved = transformObject(s, 'move', [0, 0, 0], delta);
      model.push({
        ...moved,
        id: `screw-${tile}-${i}`,
        prefix: 'SK',
        number: tile * 100 + i + 1,
        name: `Skruv ${tile * 100 + i + 1}`,
        group: { ...moved.group, id: `joint-${tile}` },
        anchorId: `lower-${tile}`,
        holes: moved.holes.map((h, j) => ({
          ...h,
          id: `hole-${tile}-${i}-${j}`,
          targetId: `${h.targetId}-${tile}`,
        })),
      });
    }
    remaining -= Math.min(100, remaining);
  }
  return model;
}
