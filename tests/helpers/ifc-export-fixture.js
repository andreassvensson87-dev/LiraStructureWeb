import * as THREE from 'three';
import { createProject } from '../../src/project/project-state.js';
import { planeFrame } from '../../src/plate.js';
import { placeItem } from '../../src/items/geometry.js';
import {
  planNumbering,
  applyNumbering,
  defaultNumberingSettings,
} from '../../src/numbering/plan.js';
import { createAssembly } from '../../src/project/assemblies.js';
const steel = {
  id: 'steel',
  revision: 1,
  name: 'Stål S355',
  category: 'steel',
  density: 7850,
  color: '#688391',
};
export function ifcExportFixture() {
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan 1', elevation: 0 }] },
  });
  project.id = '85a67286-367a-41d7-baa3-f4650ff53055';
  project.info = { name: "Hus Å · O'Brien \\", number: 'IFC-test', client: 'Test' };
  const beam = (id, start, end) => ({
    id,
    type: 'sweep',
    name: id,
    prefix: 'B',
    number: 1,
    profile: 'rect',
    width: 200,
    height: 300,
    thickness: 10,
    rotation: 0,
    start,
    end,
    material: steel,
    partSeries: { prefix: 'P', start: 100 },
    assemblySeries: { prefix: 'A', start: 200 },
  });
  const a = beam('cut-beam', [0, 0, 0], [3000, 0, 0]);
  const b = {
    ...beam('round-column', [4000, 0, 0], [4000, 0, 3000]),
    number: 2,
    profile: 'chs',
    width: 200,
    height: 200,
    thickness: 10,
    ifcClass: 'IfcColumn',
    rotation: 30,
    placement: { horizontalAlignment: 'left', verticalAlignment: 'top' },
  };
  const c = {
    id: 'plate',
    type: 'plate',
    name: 'Plåt',
    prefix: 'P',
    number: 1,
    frame: planeFrame('XY', [[0, 1000, 0]]),
    polygon: [
      [0, 0],
      [800, 0],
      [800, 600],
      [0, 600],
    ],
    thickness: 20,
    side: 'positive',
    material: steel,
    radii: [30, 30, 30, 30],
  };
  const d = {
    ...beam('poly', [0, 0, 0], [1, 0, 0]),
    number: 3,
    type: 'polysweep',
    profile: 'rhs',
    width: 100,
    height: 100,
    thickness: 5,
    points: [
      [0, 3000, 0],
      [2000, 3000, 0],
      [2000, 4500, 0],
    ],
    radii: [0, 150, 0],
  };
  delete d.start;
  delete d.end;
  const cut = {
    id: 'cut',
    type: 'polygoncut',
    name: 'Skärning',
    prefix: 'PC',
    number: 1,
    targets: [a.id],
    frame: planeFrame('XY', [[1000, -500, 0]]),
    polygon: [
      [0, 0],
      [1000, 0],
      [1000, 1000],
      [0, 1000],
    ],
    thickness: 1000,
    side: 'center',
  };
  const hole = {
    ...cut,
    id: 'hole',
    number: 2,
    targets: [c.id],
    frame: planeFrame('XY', [[200, 1200, 0]]),
    polygon: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    thickness: 200,
  };
  const box = new THREE.BoxGeometry(20, 30, 100);
  const item = {
    id: 'item-definition',
    revision: 1,
    name: 'Item',
    article: '1',
    supplier: 'Test',
    sourceName: 'Test.step',
    geometryId: 'box',
    start: [0, 0, -50],
    end: [0, 0, 50],
    snap: 'anchors',
    mesh: {
      positions: Array.from(box.attributes.position.array),
      indices: Array.from(box.index.array),
    },
  };
  box.dispose();
  const placed = placeItem(item, [5000, 3000, 0], [6000, 3500, 200], 20);
  const e = { ...placed, id: 'item-a', prefix: 'IT', number: 1, name: 'Item Å', material: steel };
  const f = {
    ...placeItem(item, [6000, 3000, 0], [6000, 3000, 1000]),
    id: 'item-b',
    prefix: 'IT',
    number: 2,
    name: 'Item B',
    colorOverride: '#cc6633',
    material: steel,
  };
  const bolt = {
    id: 'bolt',
    type: 'fastener',
    name: 'Skruv',
    prefix: 'SK',
    number: 1,
    start: [0, 0, 500],
    end: [0, 0, 620],
    holes: [],
    nutOffset: 70,
    material: steel,
    spec: {
      id: 'bolt-spec',
      revision: 1,
      name: 'M12',
      kind: 'bolt',
      diameter: 12,
      length: 120,
      head: { kind: 'hex', diameter: 18, height: 7.5 },
      nut: { acrossFlats: 18, thickness: 10 },
    },
  };
  project.objects = [a, b, c, d, e, f, bolt, cut, hole];
  project.assemblies = [
    createAssembly(project, [a.id, b.id, c.id], a.id, 'Stomme', () => 'assembly-a'),
  ];
  Object.assign(
    project,
    applyNumbering(planNumbering(project, defaultNumberingSettings()), project),
  );
  project.coordinates = {
    crs: 'EPSG:3006',
    verticalDatum: 'RH2000',
    activeId: 'base',
    basePoints: [
      {
        id: 'base',
        name: 'Hus A',
        local: [1000, 2000, 3000],
        map: [674250, 6580120, 32.5],
        rotation: 15,
      },
    ],
  };
  return project;
}
