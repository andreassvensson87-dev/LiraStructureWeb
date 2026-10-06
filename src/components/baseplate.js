import * as THREE from 'three';
import { sweepFrame, sweepCorners } from '../sweep.js';
import { validatePlate } from '../plate.js';
import { axisPlacement } from '../fasteners/geometry.js';
import { validateFastener } from '../fasteners/object-type.js';
import { validateFastenerSpec } from '../fasteners/library.js';

export const baseplateDefaults = {
  endA: 'start',
  sizeMode: 'outstand',
  outstandX: 75,
  outstandY: 75,
  width: 300,
  length: 300,
  thickness: 20,
  elevationOffset: 0,
  plateRotation: 0,
  anchorKind: 'none',
  anchorSpec: null,
  rows: 2,
  columns: 2,
  spacingX: 200,
  spacingY: 200,
  anchorRotation: 0,
  holeDiameter: 22,
  embedment: 150,
  useWasher: true,
  doubleNut: false,
};
const vec = (p) => new THREE.Vector3(...p);
export function validateBaseplate(s) {
  try {
    if (
      s.kind !== 'baseplate' ||
      !Array.isArray(s.references) ||
      s.references.length !== 1 ||
      typeof s.references[0] !== 'string' ||
      !s.references[0] ||
      s.references[0] === s.id
    )
      throw new Error('Fotplåt behöver en refererad pelare.');
    if (!['start', 'end'].includes(s.endA) || !['outstand', 'manual'].includes(s.sizeMode))
      throw new Error('Välj pelarände och plåtmått.');
    for (const key of ['width', 'length', 'thickness'])
      if (!Number.isFinite(s[key]) || s[key] < 1 || s[key] > 10000)
        throw new Error('Plåtmått måste vara 1–10 000 mm.');
    for (const key of ['outstandX', 'outstandY'])
      if (!Number.isFinite(s[key]) || s[key] < 0 || s[key] > 10000)
        throw new Error('Utstick måste vara 0–10 000 mm.');
    if (!Number.isFinite(s.elevationOffset) || Math.abs(s.elevationOffset) > 10000)
      throw new Error('Nivåjusteringen måste vara inom ±10 000 mm.');
    for (const key of ['plateRotation', 'anchorRotation'])
      if (!Number.isFinite(s[key]) || Math.abs(s[key]) > 36000)
        throw new Error('Ange en giltig rotation.');
    if (!['none', 'rod', 'concrete'].includes(s.anchorKind))
      throw new Error('Välj gängstång eller betongskruv.');
    if (![s.useWasher, s.doubleNut].every((v) => typeof v === 'boolean'))
      throw new Error('Ogiltiga tillbehörsval.');
    if (s.anchorKind !== 'none') {
      validateFastenerSpec(s.anchorSpec);
      if (s.anchorSpec.kind !== s.anchorKind)
        throw new Error('Skruvtypen måste motsvara vald förankring.');
      if (s.useWasher && !s.anchorSpec.washer)
        throw new Error(
          'Vald skruv saknar brickmått. Välj utan bricka eller komplettera biblioteket.',
        );
      if (
        !Number.isInteger(s.rows) ||
        !Number.isInteger(s.columns) ||
        s.rows < 1 ||
        s.columns < 1 ||
        s.rows * s.columns > 100
      )
        throw new Error('Ankarmönstret måste ha 1–100 skruvar.');
      for (const [count, spacing] of [
        [s.rows, s.spacingY],
        [s.columns, s.spacingX],
      ])
        if (
          !Number.isFinite(spacing) ||
          spacing < 0 ||
          spacing > 10000 ||
          (count > 1 && spacing <= 0)
        )
          throw new Error('Ange positiva skruvavstånd.');
      if (
        !Number.isFinite(s.holeDiameter) ||
        s.holeDiameter < s.anchorSpec.diameter ||
        s.holeDiameter > 1000
      )
        throw new Error('Hålet måste rymma skruven och vara högst 1 000 mm.');
      if (
        s.anchorKind === 'rod' &&
        (!Number.isFinite(s.embedment) || s.embedment <= 0 || s.embedment > 10000)
      )
        throw new Error('Ange ett positivt förankringsdjup för gängstången.');
    }
    return '';
  } catch (error) {
    return error.message;
  }
}
/** A horizontal bearing plane follows the column's foot and profile rotation. */
export function resolveBaseplate(source, model) {
  const s = { ...source };
  const error = validateBaseplate(s);
  if (error) throw new Error(error);
  const column = model.find((o) => o.id === s.references[0]);
  if (!column || (column.type ?? 'sweep') !== 'sweep' || column.generatedBy)
    throw new Error('Fotplåten saknar en giltig pelare.');
  const foot = vec(column[s.endA]),
    other = vec(column[s.endA === 'start' ? 'end' : 'start']);
  if (other.z - foot.z < 1)
    throw new Error('Välj pelarens nedre ände. Pelaren måste ha en uppåtgående riktning.');
  if (
    model.some(
      (o) =>
        o.id !== s.id &&
        ['baseplate', 'endplate'].includes(o.kind) &&
        o.references?.[0] === column.id &&
        o.endA === s.endA,
    )
  )
    throw new Error(
      'Pelaränden har redan en fotplåt eller ändplåt. Modifiera den befintliga kopplingen.',
    );
  const z = foot.z + s.elevationOffset;
  if (z >= other.z - 1) throw new Error('Fotplåten får inte kapa bort hela pelaren.');
  const frame = sweepFrame(column);
  let u = frame.x.clone().setZ(0);
  if (u.length() < 1e-6) u.set(1, 0, 0);
  u.normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), (s.plateRotation * Math.PI) / 180);
  const v = new THREE.Vector3(0, 0, 1).cross(u).normalize();
  const points = sweepCorners(column).map((p) => {
    const q = vec(p);
    q.addScaledVector(frame.axis, (z - q.z) / frame.axis.z);
    return [q.dot(u), q.dot(v)];
  });
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const profileWidth = maxX - minX,
    profileLength = maxY - minY;
  const plateWidth = s.sizeMode === 'outstand' ? profileWidth + 2 * s.outstandX : s.width;
  const plateLength = s.sizeMode === 'outstand' ? profileLength + 2 * s.outstandY : s.length;
  if (plateWidth < profileWidth - 0.001 || plateLength < profileLength - 0.001)
    throw new Error('Plåten måste rymma pelarens tvärsnitt. Öka måtten eller utsticket.');
  const origin = u
    .clone()
    .multiplyScalar((minX + maxX) / 2)
    .addScaledVector(v, (minY + maxY) / 2)
    .setZ(z);
  const cuts = [
    {
      type: 'linecut',
      targets: [column.id],
      frame: { origin: origin.toArray(), u: [1, 0, 0], v: [0, 0, 1] },
      polygon: [
        [-150, 0],
        [150, 0],
      ],
      side: 'positive',
    },
  ];
  const result = {
    ...s,
    targets: [column.id],
    cuts,
    position: origin.toArray(),
    frame: { origin: origin.toArray(), u: u.toArray(), v: v.toArray() },
    plateWidth,
    plateLength,
    profileWidth,
    profileLength,
  };
  // Generate once here to reject impossible geometry before a preview or transaction is accepted.
  baseplateMembers(result, model);
  return result;
}
export function baseplateMembers(s, model) {
  if (!s.id) throw new Error('Fotplåten behöver en identitet.');
  const previous = new Map(model.filter((o) => o.generatedBy === s.id).map((o) => [o.id, o]));
  const column = model.find((o) => o.id === s.references[0]);
  const own = (value, role) => {
    const old = previous.get(value.id);
    const result = { ...value, generatedBy: s.id, componentRole: role };
    for (const key of ['name', 'prefix', 'number']) if (old?.[key] != null) result[key] = old[key];
    return old && JSON.stringify(old) === JSON.stringify(result) ? old : result;
  };
  const plate = own(
    {
      id: `${s.id}:plate`,
      type: 'plate',
      name: 'Fotplåt',
      frame: structuredClone(s.frame),
      polygon: [
        [-s.plateWidth / 2, -s.plateLength / 2],
        [s.plateWidth / 2, -s.plateLength / 2],
        [s.plateWidth / 2, s.plateLength / 2],
        [-s.plateWidth / 2, s.plateLength / 2],
      ],
      thickness: s.thickness,
      side: 'negative',
      ...(column?.material ? { material: structuredClone(column.material) } : {}),
    },
    'plate',
  );
  const plateError = validatePlate(plate);
  if (plateError) throw new Error(plateError);
  const members = [plate];
  if (s.anchorKind === 'none') return members;
  const spec = s.anchorSpec,
    washer = s.useWasher ? spec.washer.thickness : 0;
  if (s.anchorKind === 'concrete' && s.useWasher && spec.head.kind === 'countersunk')
    throw new Error('Plan bricka passar inte under försänkt huvud.');
  const top = s.anchorKind === 'rod' ? spec.length - s.embedment - s.thickness : washer;
  const nutStack = s.anchorKind === 'rod' ? spec.nut.thickness * (s.doubleNut ? 2 : 1) : 0;
  if (s.anchorKind === 'rod' && top < washer + nutStack + 5 - 0.001)
    throw new Error(
      `Gängstången är för kort. Förbandet kräver minst ${(s.embedment + s.thickness + washer + nutStack + 5).toFixed(1)} mm.`,
    );
  if (
    s.anchorKind === 'concrete' &&
    spec.length - s.thickness - washer < spec.anchor.embedment - 0.001
  )
    throw new Error(
      'Betongskruven är för kort för plåten, brickan och produktens förankringsdjup.',
    );
  const u = vec(s.frame.u),
    v = vec(s.frame.v),
    origin = vec(s.frame.origin);
  const angle = (s.anchorRotation * Math.PI) / 180;
  const x = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle));
  const y = v.clone().multiplyScalar(-Math.cos(angle)).addScaledVector(u, Math.sin(angle));
  const radius =
    Math.max(
      s.holeDiameter,
      s.useWasher ? spec.washer.outerDiameter : 0,
      s.anchorKind === 'rod'
        ? (spec.nut.acrossFlats * 2) / Math.sqrt(3)
        : spec.head.diameter * (spec.head.kind === 'hex' ? 2 / Math.sqrt(3) : 1),
    ) / 2;
  if ((s.columns > 1 && s.spacingX < 2 * radius) || (s.rows > 1 && s.spacingY < 2 * radius))
    throw new Error('Skruvarnas hål eller tillbehör överlappar. Öka skruvavståndet.');
  const first = origin
    .clone()
    .addScaledVector(x, (-(s.columns - 1) * s.spacingX) / 2)
    .addScaledVector(y, (-(s.rows - 1) * s.spacingY) / 2)
    .add(new THREE.Vector3(0, 0, top));
  const group = {
    id: `${s.id}:anchors`,
    rows: s.rows,
    columns: s.columns,
    spacingX: s.spacingX,
    spacingY: s.spacingY,
    rotation: 0,
    origin: first.toArray(),
    direction: first
      .clone()
      .add(new THREE.Vector3(0, 0, -spec.length))
      .toArray(),
    u: x.toArray(),
  };
  for (let row = 0; row < s.rows; row++)
    for (let columnIndex = 0; columnIndex < s.columns; columnIndex++) {
      const start = first
        .clone()
        .addScaledVector(x, columnIndex * s.spacingX)
        .addScaledVector(y, row * s.spacingY);
      const delta = start.clone().sub(origin),
        px = delta.dot(u),
        py = delta.dot(v);
      if (
        Math.abs(px) + radius > s.plateWidth / 2 + 0.001 ||
        Math.abs(py) + radius > s.plateLength / 2 + 0.001
      )
        throw new Error(
          `Rad ${row + 1}, kolumn ${columnIndex + 1}: hål eller tillbehör hamnar utanför plåten.`,
        );
      if (Math.abs(px) < s.profileWidth / 2 + radius && Math.abs(py) < s.profileLength / 2 + radius)
        throw new Error(
          `Rad ${row + 1}, kolumn ${columnIndex + 1}: skruven eller dess tillbehör ligger för nära pelaren.`,
        );
      const accessories = [];
      if (s.anchorKind === 'rod') {
        if (s.doubleNut)
          accessories.push({ kind: 'nut', offset: top - washer - 2 * spec.nut.thickness });
        accessories.push({ kind: 'nut', offset: top - washer - spec.nut.thickness });
        if (s.useWasher) accessories.push({ kind: 'washer', offset: top - washer });
      } else if (s.useWasher) accessories.push({ kind: 'washer', offset: 0 });
      const screw = own(
        {
          id: `${s.id}:anchor:${row}:${columnIndex}`,
          type: 'fastener',
          name: spec.name,
          spec: structuredClone(spec),
          ...axisPlacement(
            spec,
            start.toArray(),
            start
              .clone()
              .add(new THREE.Vector3(0, 0, -1))
              .toArray(),
          ),
          radial: x.toArray(),
          anchorId: plate.id,
          accessories,
          lengthMode: 'manual',
          holes: [
            {
              id: `${s.id}:hole:${row}:${columnIndex}`,
              type: 'bore',
              targetId: plate.id,
              kind: 'clearance',
              extent: 'manual',
              offset: top,
              depth: s.thickness,
              diameter: s.holeDiameter,
            },
          ],
          group: { ...structuredClone(group), row, column: columnIndex },
          ...(s.anchorKind === 'rod' ? { startAllowance: top } : {}),
        },
        'anchor',
      );
      const error = validateFastener(screw);
      if (error) throw new Error(error);
      members.push(screw);
    }
  return members;
}
