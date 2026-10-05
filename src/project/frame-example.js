import { createProject } from './project-state.js';
import { automaticPlacement } from '../fasteners/placement.js';
import { transformObject } from '../transform.js';
import { rotateObject } from '../rotation.js';
import { cacheObjectGeometry, displayGeometry, edgesForModel } from '../model-object.js';
import * as THREE from 'three';

export const FRAME_EXAMPLE_SIZES = [
  { id: 'small', name: 'Liten stomme', x: 3, y: 2, floors: 2 },
  { id: 'medium', name: 'Stor stomme', x: 5, y: 4, floors: 3 },
  { id: 'large', name: 'Prestandamodell', x: 8, y: 6, floors: 4 },
  { id: 'extended', name: 'Utökad stomme', x: 8, y: 6, floors: 6, secondary: 1 },
  { id: 'stress', name: 'Stresstest', x: 10, y: 8, floors: 6, secondary: 1 },
];
const material = (id, name, category, density, color) => ({
  id,
  name,
  revision: 1,
  category,
  density,
  color,
});
const steel = material('frame-steel', 'Stomstål · exempel', 'steel', 7850, '#577987');
const concrete = material('frame-concrete', 'Betong · exempel', 'concrete', 2400, '#b5b8b3');
const wallMaterial = material('frame-wall', 'Väggpanel · exempel', 'other', 700, '#c3b49e');
const hardware = material('frame-hardware', 'Skruvförband · exempel', 'steel', 7850, '#bec8cf');
const spec = {
  id: 'frame-m20-360',
  revision: 1,
  kind: 'bolt',
  name: 'Exempel M20 × 360',
  diameter: 20,
  length: 360,
  head: { kind: 'hex', diameter: 30, height: 12 },
  nut: { acrossFlats: 30, thickness: 16 },
  washer: { innerDiameter: 22, outerDiameter: 40, thickness: 4 },
  holeDefaults: { kind: 'clearance', extent: 'profile', diameter: 22, depth: 300 },
};
const plate = (id, name, origin, u, v, width, height, thickness, mat) => ({
  id,
  name,
  type: 'plate',
  frame: { origin, u, v },
  polygon: [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ],
  thickness,
  side: 'positive',
  material: mat,
});

/** Resolve one real assembly, then repeat its geometry and relations without rescanning the building. */
function beamAssembly() {
  const beam = {
    id: 'beam',
    name: 'I-balk 220 × 300 × 12',
    type: 'sweep',
    profile: 'i',
    width: 220,
    height: 300,
    thickness: 12,
    rotation: 0,
    start: [0, 0, 0],
    end: [6000, 0, 0],
    material: steel,
  };
  const objects = [beam];
  for (const [side, from] of [
    ['start', 50],
    ['end', 5650],
  ]) {
    const cap = plate(
      `plate-${side}`,
      'Förbandsplåt 300 × 220 × 12',
      [from, -110, 150],
      [1, 0, 0],
      [0, 1, 0],
      300,
      220,
      12,
      hardware,
    );
    objects.push(cap);
    for (const dx of [100, 200])
      for (const y of [-65, 65]) {
        const id = `bolt-${side}-${dx}-${y}`;
        const holes = [cap, beam].map((target) => ({
          id: `${id}-bore-${target.id}`,
          type: 'bore',
          targetId: target.id,
          kind: 'clearance',
          extent: 'profile',
          diameter: 22,
          offset: 0,
          depth: 300,
        }));
        objects.push(
          automaticPlacement(
            {
              id,
              type: 'fastener',
              name: 'M20 · balkförband med två brickor',
              spec,
              holes,
              anchorId: cap.id,
              washers: { head: true, nut: true },
              material: hardware,
            },
            [from + dx, y, 600],
            [from + dx, y, -600],
            objects,
          ),
        );
      }
  }
  return objects;
}

export function frameExampleCounts(size) {
  const secondaryBeams = size.floors * size.x * size.y * (size.secondary || 0);
  const beams = size.floors * (size.x * (size.y + 1) + size.y * (size.x + 1)) + secondaryBeams;
  const columns = (size.x + 1) * (size.y + 1) * size.floors;
  const foundations = (size.x + 1) * (size.y + 1) * 2;
  const floors = size.x * size.y * size.floors * ((size.secondary || 0) + 1);
  const walls = 2 * (size.x + size.y) * size.floors;
  const braces = size.secondary ? walls : 0;
  return {
    objects: beams * 11 + columns + foundations + floors + walls + braces,
    screws: beams * 8,
    holes: beams * 16,
    beams,
    secondaryBeams,
    braces,
    columns,
    floors,
    walls,
  };
}

export function createFrameExample(sizeId = 'medium', { prepareGeometry = false } = {}) {
  const size = FRAME_EXAMPLE_SIZES.find((s) => s.id === sizeId);
  if (!size) throw new Error('Välj en giltig storlek på exempelstommen.');
  const positions = (n) => Array.from({ length: n + 1 }, (_, i) => i * 6000);
  const project = createProject({
    grid: { x: positions(size.x), y: positions(size.y) },
    levels: {
      active: 'frame-0',
      items: Array.from({ length: size.floors + 1 }, (_, i) => ({
        id: `frame-${i}`,
        name: i ? `Plan ${i}` : 'Grund',
        elevation: i * 3500,
      })),
    },
  });
  project.info = {
    name: `${size.name} · ${size.x * 6} × ${size.y * 6} m · ${size.floors} plan`,
    number: `STOM-${size.id.toUpperCase()}`,
    client: '',
  };
  const counters = {};
  function add(object) {
    const prefix = object.type === 'fastener' ? 'SK' : object.type === 'plate' ? 'P' : 'B';
    counters[prefix] = (counters[prefix] || 0) + 1;
    const result = { ...object, prefix, number: counters[prefix] };
    project.objects.push(result);
    return result;
  }
  const xTemplate = beamAssembly();
  const yTemplate = xTemplate.map((o) => rotateObject(o, [0, 0, 0], 'Z', 90));
  const repeated = [];
  let assembly = 0;
  function addBeam(template, point, name) {
    const prefix = `frame-joint-${++assembly}`;
    for (const original of template) {
      const object = transformObject(structuredClone(original), 'move', [0, 0, 0], point);
      object.id = `${prefix}-${original.id}`;
      object.name = `${name} · ${original.name}`;
      if (object.anchorId) object.anchorId = `${prefix}-${object.anchorId}`;
      if (object.holes)
        object.holes = object.holes.map((h) => ({
          ...h,
          id: `${prefix}-${h.id}`,
          targetId: `${prefix}-${h.targetId}`,
        }));
      const result = add(object);
      if (prepareGeometry && object.type !== 'fastener')
        repeated.push({
          object: result,
          originalId: original.id,
          point,
          rotated: template === yTemplate,
        });
    }
  }
  for (let x = 0; x <= size.x; x++)
    for (let y = 0; y <= size.y; y++) {
      const position = [x * 6000, y * 6000];
      add(
        plate(
          `frame-foundation-${x}-${y}`,
          'Grundplint 900 × 900',
          [...position.map((v) => v - 450), -500],
          [1, 0, 0],
          [0, 1, 0],
          900,
          900,
          500,
          concrete,
        ),
      );
      add(
        plate(
          `frame-base-${x}-${y}`,
          'Pelarens fotplåt 400 × 400',
          [...position.map((v) => v - 200), 0],
          [1, 0, 0],
          [0, 1, 0],
          400,
          400,
          20,
          hardware,
        ),
      );
      for (let floor = 1; floor <= size.floors; floor++)
        add({
          id: `frame-column-${x}-${y}-${floor}`,
          name: `Plan ${floor} · Pelare RHS 250 × 250 × 12`,
          type: 'sweep',
          profile: 'rhs',
          width: 250,
          height: 250,
          thickness: 12,
          rotation: 0,
          start: [...position, floor === 1 ? 20 : (floor - 1) * 3500 + 150],
          end: [...position, floor * 3500 + 150],
          material: steel,
        });
    }
  for (let floor = 1; floor <= size.floors; floor++) {
    const z = floor * 3500;
    for (let x = 0; x < size.x; x++)
      for (let y = 0; y <= size.y; y++)
        addBeam(xTemplate, [x * 6000, y * 6000, z], `Plan ${floor} · X-balk`);
    for (let x = 0; x <= size.x; x++)
      for (let y = 0; y < size.y; y++)
        addBeam(yTemplate, [x * 6000, y * 6000, z], `Plan ${floor} · Y-balk`);
    const strips = (size.secondary || 0) + 1;
    for (let x = 0; x < size.x; x++)
      for (let y = 0; y < size.y; y++) {
        for (let i = 1; i < strips; i++)
          addBeam(
            xTemplate,
            [x * 6000, y * 6000 + (i * 6000) / strips, z],
            `Plan ${floor} · Sekundärbalk`,
          );
        for (let strip = 0; strip < strips; strip++)
          add(
            plate(
              `frame-floor-${floor}-${x}-${y}-${strip}`,
              `Plan ${floor} · Bjälklag${strips > 1 ? ' · element ' + (strip + 1) : ''}`,
              [x * 6000 + 250, y * 6000 + (strip * 6000) / strips + 250, z + 190],
              [1, 0, 0],
              [0, 1, 0],
              5500,
              6000 / strips - 500,
              120,
              concrete,
            ),
          );
      }
    function addBrace(id, start, end) {
      add({
        id,
        name: `Plan ${floor} · Fasadstag RHS 100 × 100 × 6`,
        type: 'sweep',
        profile: 'rhs',
        width: 100,
        height: 100,
        thickness: 6,
        rotation: 0,
        start,
        end,
        material: steel,
      });
    }
    for (let side = 0; side < 2; side++) {
      if (size.secondary) {
        for (let x = 0; x < size.x; x++)
          addBrace(
            `frame-brace-x-${floor}-${side}-${x}`,
            [x * 6000 + 250, side * size.y * 6000, z - 3200],
            [(x + 1) * 6000 - 250, side * size.y * 6000, z - 200],
          );
        for (let y = 0; y < size.y; y++)
          addBrace(
            `frame-brace-y-${floor}-${side}-${y}`,
            [side * size.x * 6000, y * 6000 + 250, z - 3200],
            [side * size.x * 6000, (y + 1) * 6000 - 250, z - 200],
          );
      }
      for (let x = 0; x < size.x; x++)
        add(
          plate(
            `frame-wall-x-${floor}-${side}-${x}`,
            `Plan ${floor} · Långsidans väggpanel`,
            [x * 6000 + 250, side * size.y * 6000 + (side ? 130 : -250), z - 3000],
            [1, 0, 0],
            [0, 0, 1],
            5500,
            2200,
            120,
            wallMaterial,
          ),
        );
      for (let y = 0; y < size.y; y++)
        add(
          plate(
            `frame-wall-y-${floor}-${side}-${y}`,
            `Plan ${floor} · Gavelns väggpanel`,
            [side * size.x * 6000 + (side ? 250 : -130), y * 6000 + 250, z - 3000],
            [0, 1, 0],
            [0, 0, 1],
            5500,
            2200,
            120,
            wallMaterial,
          ),
        );
    }
  }
  if (prepareGeometry) {
    const templates = new Map();
    try {
      for (const original of xTemplate.filter((o) => o.type !== 'fastener'))
        templates.set(original.id, {
          geometry: displayGeometry(original, xTemplate),
          edges: edgesForModel(original, xTemplate, 1, true),
        });
      for (const item of repeated) {
        const source = templates.get(item.originalId);
        const matrix = new THREE.Matrix4().makeRotationZ(item.rotated ? Math.PI / 2 : 0);
        matrix.setPosition(...item.point);
        cacheObjectGeometry(
          item.object,
          project.objects,
          source.geometry.clone().applyMatrix4(matrix),
          source.edges.clone().applyMatrix4(matrix),
          [],
          {
            key: source.geometry,
            geometry: source.geometry,
            edges: source.edges,
            matrix,
            local: true,
          },
          true,
        );
      }
    } finally {
      for (const source of templates.values()) {
        source.geometry.dispose();
        source.edges.dispose();
      }
    }
  }
  return project;
}
