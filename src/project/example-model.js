import { createProject } from './project-state.js';
import { automaticPlacement } from '../fasteners/placement.js';
import { defaultHoleForSpec } from '../fasteners/library.js';
import { validateObject } from '../model-object.js';
import { validateFastenerTargets } from '../fasteners/relations.js';
import { nextIdentity } from '../object-identity.js';
import { numberParts } from '../part-marks.js';

/** Self-contained demonstration: material and fastener snapshots need no library import. */
export function createFastenerExample() {
  const project = createProject({
    grid: { x: [0, 1200, 2400, 3600], y: [-400, 400] },
    levels: { active: 'example', items: [{ id: 'example', name: 'Förband', elevation: 200 }] },
  });
  project.info = { name: 'Skruvexempel · trä, plåt och rör', number: 'EX-001', client: '' };
  const woodMaterial = {
    id: 'example-wood',
    revision: 1,
    category: 'wood',
    name: 'Exempelträ',
    density: 450,
    color: '#bb925e',
  };
  const steelMaterial = {
    id: 'example-steel',
    revision: 1,
    category: 'steel',
    name: 'Exempelstål',
    density: 7850,
    color: '#658396',
  };
  const boltMaterial = {
    ...steelMaterial,
    id: 'example-hardware',
    name: 'Förband',
    color: '#b9c4cb',
  };
  const woodSpec = {
    id: 'example-wood-6-100',
    revision: 1,
    kind: 'wood',
    name: 'Exempel träskruv 6 × 100',
    diameter: 6,
    length: 100,
    head: { kind: 'countersunk', diameter: 12, height: 4 },
    holeDefaults: { kind: 'pilot', extent: 'blind', diameter: 4, depth: 60 },
  };
  const boltSpec = (length) => ({
    id: `example-bolt-12-${length}`,
    revision: 1,
    kind: 'bolt',
    name: `Exempel M12 × ${length}`,
    diameter: 12,
    length,
    head: { kind: 'hex', diameter: 19, height: 8 },
    nut: { acrossFlats: 19, thickness: 10 },
    washer: { innerDiameter: 13, outerDiameter: 26, thickness: 3 },
    holeDefaults: { kind: 'clearance', extent: 'profile', diameter: 14, depth: 50 },
  });
  function add(object) {
    const result = { ...object, ...nextIdentity(object, project.objects) };
    project.objects.push(result);
    return result;
  }
  function plate(id, name, origin, width, height, thickness, material) {
    return add({
      id,
      name,
      type: 'plate',
      frame: { origin, u: [1, 0, 0], v: [0, 1, 0] },
      polygon: [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ],
      side: 'positive',
      thickness,
      material,
    });
  }
  const timber = add({
    id: 'example-timber',
    name: '01 · Träregel 180 × 90',
    type: 'sweep',
    profile: 'rect',
    width: 180,
    height: 90,
    thickness: 0,
    rotation: 0,
    start: [0, 0, 200],
    end: [1000, 0, 200],
    material: woodMaterial,
  });
  const board = plate(
    'example-board',
    '01 · Träplatta 28 mm',
    [100, -140, 245],
    800,
    280,
    28,
    woodMaterial,
  );
  const lower = plate(
    'example-lower',
    '02 · Undre plåt 12 mm',
    [1300, -150, 200],
    700,
    300,
    12,
    steelMaterial,
  );
  const upper = plate('example-upper', '02 · Övre plåt 10 mm', [1500, -100, 212], 300, 200, 10, {
    ...steelMaterial,
    color: '#8aa0ad',
  });
  const tube = add({
    id: 'example-tube',
    name: '03 · RHS 160 × 120 × 8',
    type: 'sweep',
    profile: 'rhs',
    width: 160,
    height: 120,
    thickness: 8,
    rotation: 0,
    start: [2600, 0, 200],
    end: [3400, 0, 200],
    material: steelMaterial,
  });
  const cap = plate('example-cap', '03 · Anslutningsplåt 10 mm', [2600, -100, 260], 800, 200, 10, {
    ...steelMaterial,
    color: '#8aa0ad',
  });
  let sequence = 0;
  function fastener(spec, name, x, y, parts, adjust = (h) => h) {
    const id = `example-fastener-${++sequence}`;
    const holes = parts.map((part) => ({
      ...adjust(defaultHoleForSpec(spec, part.id), part),
      id: `${id}-bore-${part.id}`,
      type: 'bore',
    }));
    const draft = {
      id,
      type: 'fastener',
      name,
      spec,
      holes,
      anchorId: parts[0].id,
      washers: { head: spec.kind === 'bolt', nut: spec.kind === 'bolt' },
      material: boltMaterial,
    };
    add(automaticPlacement(draft, [x, y, 600], [x, y, 0], project.objects));
  }
  for (const x of [250, 750])
    for (const y of [-50, 50])
      fastener(
        woodSpec,
        '01 · Träskruv, frigång + förborrning',
        x,
        y,
        [board, timber],
        (h, part) =>
          part.id === board.id
            ? {
                ...h,
                kind: 'clearance',
                extent: 'profile',
                diameter: 6.5,
                countersink: { diameter: 12, depth: 4 },
              }
            : h,
      );
  for (const x of [1550, 1750])
    for (const y of [-60, 60])
      fastener(boltSpec(60), '02 · M12, brickor på båda sidor', x, y, [upper, lower]);
  for (const x of [2750, 3250])
    fastener(boltSpec(160), '03 · M12 genom båda rörväggarna', x, 0, [cap, tube]);
  fastener(
    boltSpec(40),
    '03 · M12 genom endast övre rörväggen',
    3000,
    45,
    [cap, tube],
    (h, part) => (part.id === tube.id ? { ...h, extent: 'wall' } : h),
  );
  for (const object of project.objects) {
    const error = validateObject(object);
    if (error) throw new Error(`${object.name}: ${error}`);
    if (object.type === 'fastener') validateFastenerTargets(object, project.objects);
  }
  project.parts = numberParts(project.objects, project.parts);
  return project;
}
