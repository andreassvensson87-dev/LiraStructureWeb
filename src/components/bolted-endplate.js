import { resolveFit } from './fit.js';
import { resolveBaseplate } from './baseplate.js';
import { validateAccessories } from '../fasteners/accessories.js';
import * as THREE from 'three';
import { contours, profileAnchor, sweepFrame } from '../sweep.js';
import { validatePlate } from '../plate.js';
import { validateFastenerSpec } from '../fasteners/library.js';
import { selectFastenerLength, fittedAssembly } from '../fasteners/assembly.js';
import { validateFastener } from '../fasteners/object-type.js';
import { axisPlacement } from '../fasteners/geometry.js';
import { lineCutFrame } from '../line-cut.js';

import { boltedEndplateDefaults } from './bolted-parameters.js';
export { boltedEndplateDefaults };
const vec = (p) => new THREE.Vector3(...p);
export function flangeProfile(member) {
  return (
    member &&
    !member.generatedBy &&
    (member.type ?? 'sweep') === 'sweep' &&
    ['h', 'i'].includes(member.profile === 'custom' ? member.section?.profileType : member.profile)
  );
}
export function validateBoltedEndplate(s) {
  try {
    if (
      s.kind !== 'boltedEndplate' ||
      !Array.isArray(s.references) ||
      s.references.length !== 2 ||
      s.references.some((id) => typeof id !== 'string' || !id || id === s.id) ||
      s.references[0] === s.references[1]
    )
      throw new Error('Välj två olika objekt: pelare och balk.');
    if (!['start', 'end'].includes(s.endB) || !['outstand', 'manual'].includes(s.sizeMode))
      throw new Error('Välj balkände och plåtmått.');
    for (const [key, min, max] of [
      ['width', 1, 10000],
      ['length', 1, 10000],
      ['thickness', 1, 1000],
      ['gap', 0, 1000],
      ['outstandX', 0, 10000],
      ['outstandY', 0, 10000],
      ['spacingX', 0, 10000],
      ['spacingY', 0, 10000],
      ['offsetX', -10000, 10000],
      ['offsetY', -10000, 10000],
      ['edgeDistance', 1, 1000],
      ['clearance', 0, 1000],
      ['extraLength', 0, 1000],
    ])
      if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
        throw new Error('Ange giltiga mått för kopplingen.');
    if (
      !Number.isInteger(s.rows) ||
      !Number.isInteger(s.columns) ||
      s.rows < 1 ||
      s.columns < 1 ||
      s.rows * s.columns > 100
    )
      throw new Error('Skruvmönstret måste ha 1–100 skruvar.');
    if ((s.columns > 1 && s.spacingX <= 0) || (s.rows > 1 && s.spacingY <= 0))
      throw new Error('Ange positiva skruvavstånd.');
    if (!s.boltSpec) throw new Error('Välj skruv med mutter ur skruvbiblioteket.');
    validateFastenerSpec(s.boltSpec);
    if (s.boltSpec.kind !== 'bolt' || s.boltSpec.head.kind !== 'hex')
      throw new Error('Välj skruv med sexkantshuvud och mutter.');
    if (!['manual', 'auto'].includes(s.lengthMode))
      throw new Error('Välj giltigt skruvlängdsläge.');
    if (!Array.isArray(s.lengthOptions) || s.lengthOptions.length > 1000)
      throw new Error('Ogiltig skruvlängdserie.');
    s.lengthOptions.forEach(validateFastenerSpec);
    if (![s.nearWasher, s.farWasher].every((v) => typeof v === 'boolean'))
      throw new Error('Ogiltiga brickval.');
    if ((s.nearWasher || s.farWasher) && !s.boltSpec.washer)
      throw new Error('Vald skruv saknar brickmått.');
    if (
      !Number.isFinite(s.holeDiameter) ||
      s.holeDiameter < s.boltSpec.diameter ||
      s.holeDiameter > 1000
    )
      throw new Error('Hålet måste rymma skruven.');
    return '';
  } catch (error) {
    return error.message;
  }
}
export function localContours(member) {
  const [ax, ay] = profileAnchor(member);
  return contours(member).map((loop) => loop.map(([x, y]) => [x - ax, y - ay]));
}
export function inside(point, loops) {
  let result = false;
  for (const loop of loops)
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i],
        b = loop[j];
      if (
        a[1] > point[1] !== b[1] > point[1] &&
        point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        result = !result;
    }
  return result;
}
export function distance(point, loops) {
  return Math.min(
    ...loops.flatMap((loop) =>
      loop.map((a, i) => {
        const b = loop[(i + 1) % loop.length],
          dx = b[0] - a[0],
          dy = b[1] - a[1];
        const t = Math.max(
          0,
          Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)),
        );
        return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
      }),
    ),
  );
}
/** Ordered material spans across the actual flange, including web and root radii. */
function flangeSpan(loops, x, sign) {
  const ys = loops
    .flatMap((loop) =>
      loop.flatMap((a, i) => {
        const b = loop[(i + 1) % loop.length];
        if (a[0] > x === b[0] > x) return [];
        return [sign * (a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]))];
      }),
    )
    .sort((a, b) => b - a);
  if (ys.length < 2) throw new Error('Skruven ligger utanför pelarflänsen.');
  return {
    outer: ys[0],
    inner: ys[1],
    depth: ys[0] - ys[1],
    pocketDepth: ys.length > 2 ? ys[1] - ys[2] : 0,
  };
}
function clearCuts(model, targetId, points) {
  for (const object of model)
    for (const cut of object.type === 'component'
      ? object.cuts || []
      : object.type === 'linecut'
        ? [object]
        : []) {
      if (!cut.targets.includes(targetId)) continue;
      const { origin, n } = lineCutFrame(cut),
        sign = cut.side === 'positive' ? 1 : -1;
      if (points.some((p) => vec(p).sub(origin).dot(n) * sign > 0.001))
        throw new Error(
          'Kopplingen ligger vid en befintlig kapning. Flytta anslutningen eller ändra kapningen.',
        );
    }
}
export function resolveBoltedEndplate(s, model) {
  const error = validateBoltedEndplate(s);
  if (error) throw new Error(error);
  const [column, beam] = s.references.map((id) => model.find((o) => o.id === id));
  if (!flangeProfile(column) || !flangeProfile(beam))
    throw new Error('Första versionen kräver H- eller I-profiler för pelare och balk.');
  const cf = sweepFrame(column),
    bf = sweepFrame(beam),
    outward = bf.axis.clone().multiplyScalar(s.endB === 'end' ? 1 : -1);
  if (Math.abs(outward.dot(cf.y)) < 1 - 1e-6)
    throw new Error(
      'Balken måste ansluta vinkelrätt mot pelarflänsen. Kontrollera pelarens profilrotation.',
    );
  const sign = outward.dot(cf.y) > 0 ? -1 : 1,
    normal = cf.y.clone().multiplyScalar(sign);
  const u = cf.x.clone(),
    v = normal.clone().cross(u).normalize();
  const columnLoops = localContours(column),
    columnPoints = columnLoops.flat();
  const face = Math.max(...columnPoints.map((p) => sign * p[1]));
  const endpoint = vec(beam[s.endB]),
    keep = vec(beam[s.endB === 'start' ? 'end' : 'start']);
  const planeOrigin = cf.start.clone().addScaledVector(normal, face + s.gap);
  const beamFace = endpoint
    .clone()
    .addScaledVector(normal, planeOrigin.clone().sub(endpoint).dot(normal) + s.thickness);
  if (keep.clone().sub(beamFace).dot(normal) < 1)
    throw new Error('Kopplingen får inte kapa bort hela balken. Välj balkänden mot pelaren.');
  const other = model.find(
    (o) =>
      o.type === 'component' &&
      o.id !== s.id &&
      o.references?.includes(beam.id) &&
      ((o.kind === 'boltedEndplate' && o.references[1] === beam.id && o.endB === s.endB) ||
        (['endplate', 'baseplate'].includes(o.kind) &&
          o.references[0] === beam.id &&
          o.endA === s.endB) ||
        (o.kind === 'fit' &&
          (o.mode === 'miter' || o.references[1] === beam.id) &&
          (o.references[0] === beam.id ? o.endA : o.endB) === s.endB)),
  );
  if (other)
    throw new Error(
      'Balkänden har redan en kapande koppling eller ändplåt. Modifiera den befintliga kopplingen.',
    );
  const beamLoops = localContours(beam);
  const footprint = beamLoops.flat().map(([x, y]) => {
    const q = bf.x.clone().multiplyScalar(x).addScaledVector(bf.y, y);
    return [q.dot(u), q.dot(v)];
  });
  const minX = Math.min(...footprint.map((p) => p[0])),
    maxX = Math.max(...footprint.map((p) => p[0]));
  const minY = Math.min(...footprint.map((p) => p[1])),
    maxY = Math.max(...footprint.map((p) => p[1]));
  const plateWidth = s.sizeMode === 'manual' ? s.width : maxX - minX + 2 * s.outstandX;
  const plateLength = s.sizeMode === 'manual' ? s.length : maxY - minY + 2 * s.outstandY;
  if (plateWidth < maxX - minX - 0.001 || plateLength < maxY - minY - 0.001)
    throw new Error('Plåten måste täcka balkens tvärsnitt.');
  const origin = beamFace
    .clone()
    .addScaledVector(normal, -s.thickness)
    .addScaledVector(u, (minX + maxX) / 2)
    .addScaledVector(v, (minY + maxY) / 2);
  const cutU = u.clone(),
    cutV = normal.clone(); // u × plateNormal(u,v) = -normal: remove the end towards the column.
  const result = {
    ...s,
    targets: [beam.id],
    position: origin.toArray(),
    normal: normal.toArray(),
    frame: { origin: origin.toArray(), u: u.toArray(), v: v.toArray() },
    plateWidth,
    plateLength,
    cuts: [
      {
        type: 'linecut',
        targets: [beam.id],
        frame: { origin: beamFace.toArray(), u: cutU.toArray(), v: cutV.toArray() },
        polygon: [
          [-150, 0],
          [150, 0],
        ],
        side: 'positive',
      },
    ],
    boltLayout: [],
  };
  const radius = Math.max(
    s.holeDiameter / 2,
    s.boltSpec.head.diameter / Math.sqrt(3),
    s.boltSpec.nut.acrossFlats / Math.sqrt(3),
    s.nearWasher || s.farWasher ? s.boltSpec.washer.outerDiameter / 2 : 0,
  );
  if (
    (s.columns > 1 && s.spacingX < 2 * radius + s.clearance) ||
    (s.rows > 1 && s.spacingY < 2 * radius + s.clearance)
  )
    throw new Error('Skruvarnas hål eller tillbehör överlappar. Öka skruvavstånden.');
  const edge = Math.max(s.edgeDistance, radius + s.clearance),
    colMinX = Math.min(...columnPoints.map((p) => p[0])),
    colMaxX = Math.max(...columnPoints.map((p) => p[0]));
  const columnLength = cf.start.distanceTo(cf.end);
  // Recompute reference cuts from the proposed parameters, including newly created or copied components.
  const columnCuts = model
    .filter((object) => object.id !== s.id)
    .map((object) => {
      if (object.type !== 'component' || !object.references?.includes(column.id)) return object;
      if (object.kind === 'fit') return resolveFit(object, model);
      if (object.kind === 'baseplate') return resolveBaseplate(object, model);
      return object;
    });
  // Flat bearing surfaces are required; tapered inner flanges need a separate wedge-washer component.
  for (let row = 0; row < s.rows; row++)
    for (let col = 0; col < s.columns; col++) {
      const x = s.offsetX + (col - (s.columns - 1) / 2) * s.spacingX,
        y = s.offsetY + (row - (s.rows - 1) / 2) * s.spacingY;
      const label = `Rad ${row + 1}, kolumn ${col + 1}: `;
      if (
        Math.abs(x) + edge > plateWidth / 2 + 0.001 ||
        Math.abs(y) + edge > plateLength / 2 + 0.001
      )
        throw new Error(label + 'kantavståndet på plåten är för litet.');
      const point = origin.clone().addScaledVector(u, x).addScaledVector(v, y);
      const delta = point.clone().sub(cf.start),
        cx = delta.dot(cf.x),
        station = delta.dot(cf.axis);
      if (
        cx - edge < colMinX ||
        cx + edge > colMaxX ||
        station - edge < 0 ||
        station + edge > columnLength
      )
        throw new Error(label + 'kantavståndet på pelarflänsen är för litet.');
      const spans = [-radius - s.clearance, 0, radius + s.clearance].map((dx) =>
        flangeSpan(columnLoops, cx + dx, sign),
      );
      const span = spans[1];
      if (
        spans.some((p) => Math.abs(p.outer - face) > 0.001 || Math.abs(p.inner - span.inner) > 0.05)
      )
        throw new Error(
          label + 'mutter och bricka behöver en plan flänsyta fri från liv och radier.',
        );
      const boltBeamPoint = point.clone().addScaledVector(normal, s.thickness).sub(beamFace);
      const bp = [boltBeamPoint.dot(bf.x), boltBeamPoint.dot(bf.y)];
      if (inside(bp, beamLoops) || distance(bp, beamLoops) < radius + s.clearance - 0.001)
        throw new Error(label + 'skruvhuvudet ligger för nära balkens liv eller fläns.');
      // Ensure the nut and the shaft end fit inside the column pocket without reaching the opposite flange.
      const grip = s.thickness + s.gap + span.depth;
      const assembly = {
        nearWasher: s.nearWasher,
        farWasher: s.farWasher,
        nut: true,
        nearNut: false,
        extraNut: false,
      };
      const fitted = selectFastenerLength(
        {
          spec: s.boltSpec,
          lengthMode: s.lengthMode,
          lengthOptions: s.lengthOptions,
          extraLength: s.extraLength,
          assembly,
        },
        grip,
      );
      const hardware = fittedAssembly({ ...fitted, assembly }, grip);
      validateAccessories(hardware);
      const required =
        Math.max(
          ...hardware.accessories.map((item) => item.offset + hardware.spec[item.kind].thickness),
        ) + s.extraLength;
      if (fitted.spec.length < required - 0.001)
        throw new Error('Skruven är för kort för plåt, fläns, mutter och extra längd.');
      const washer = s.nearWasher ? fitted.spec.washer.thickness : 0;
      if (
        fitted.spec.length - washer - s.thickness - s.gap >
        span.depth + span.pocketDepth - fitted.spec.diameter / 2 + 0.001
      )
        throw new Error(label + 'skruven är för lång för utrymmet inne i pelaren.');
      const start = point.clone().addScaledVector(normal, s.thickness + washer);
      const shaftFar = start.clone().addScaledVector(normal, -fitted.spec.length).sub(cf.start);
      const endLocal = [shaftFar.dot(cf.x), shaftFar.dot(cf.y)];
      if (
        inside(endLocal, columnLoops) ||
        distance(endLocal, columnLoops) < fitted.spec.diameter / 2 - 0.001
      )
        throw new Error(label + 'skruven är för lång för utrymmet inne i pelaren.');
      const boreCorners = [-s.holeDiameter / 2, s.holeDiameter / 2].flatMap((dx) =>
        [-s.holeDiameter / 2, s.holeDiameter / 2].flatMap((dz) =>
          [0, span.depth].map((depth) =>
            cf.start
              .clone()
              .addScaledVector(cf.x, cx + dx)
              .addScaledVector(cf.axis, station + dz)
              .addScaledVector(normal, face - depth)
              .toArray(),
          ),
        ),
      );
      clearCuts(columnCuts, column.id, boreCorners);
      result.boltLayout.push({
        row,
        column: col,
        point: point.toArray(),
        spec: fitted.spec,
        grip,
        flangeThickness: span.depth,
        assembly,
      });
    }
  boltedEndplateMembers(result, model);
  return JSON.stringify(result) === JSON.stringify(s) ? s : result;
}
export function boltedEndplateMembers(s, model) {
  const old = new Map(model.filter((o) => o.generatedBy === s.id).map((o) => [o.id, o]));
  const beam = model.find((o) => o.id === s.references[1]);
  const own = (object, role) => {
    const previous = old.get(object.id),
      result = { ...object, generatedBy: s.id, componentRole: role };
    for (const key of ['name', 'prefix', 'number'])
      if (
        previous?.[key] != null &&
        !(key === 'name' && previous.type === 'fastener' && previous.name === previous.spec.name)
      )
        result[key] = previous[key];
    return previous && JSON.stringify(previous) === JSON.stringify(result) ? previous : result;
  };
  const plate = own(
    {
      id: `${s.id}:plate`,
      type: 'plate',
      name: 'Ändplåt',
      frame: structuredClone(s.frame),
      side: 'positive',
      thickness: s.thickness,
      polygon: [
        [-s.plateWidth / 2, -s.plateLength / 2],
        [s.plateWidth / 2, -s.plateLength / 2],
        [s.plateWidth / 2, s.plateLength / 2],
        [-s.plateWidth / 2, s.plateLength / 2],
      ],
      ...(beam.material ? { material: structuredClone(beam.material) } : {}),
    },
    'plate',
  );
  const plateError = validatePlate(plate);
  if (plateError) throw new Error(plateError);
  const normal = vec(s.normal),
    members = [plate];
  for (const bolt of s.boltLayout) {
    const washer = s.nearWasher ? bolt.spec.washer.thickness : 0;
    const start = vec(bolt.point).addScaledVector(normal, s.thickness + washer);
    const screw = own(
      fittedAssembly(
        {
          id: `${s.id}:bolt:${bolt.row}:${bolt.column}`,
          type: 'fastener',
          name: bolt.spec.name,
          spec: structuredClone(bolt.spec),
          ...axisPlacement(bolt.spec, start.toArray(), start.clone().sub(normal).toArray()),
          radial: [...s.frame.u],
          anchorId: plate.id,
          assembly: bolt.assembly,
          lengthMode: 'manual',
          extraLength: s.extraLength,
          holes: [
            {
              id: `${s.id}:hole:plate:${bolt.row}:${bolt.column}`,
              type: 'bore',
              targetId: plate.id,
              kind: 'clearance',
              extent: 'manual',
              offset: washer,
              depth: s.thickness,
              diameter: s.holeDiameter,
            },
            {
              id: `${s.id}:hole:column:${bolt.row}:${bolt.column}`,
              type: 'bore',
              targetId: s.references[0],
              kind: 'clearance',
              extent: 'manual',
              offset: washer + s.thickness + s.gap,
              depth: bolt.flangeThickness,
              diameter: s.holeDiameter,
            },
          ],
        },
        bolt.grip,
      ),
      'bolt',
    );
    const error = validateFastener(screw);
    if (error) throw new Error(error);
    const far = Math.max(
      ...screw.accessories.map((item) => item.offset + screw.spec[item.kind].thickness),
    );
    if (screw.spec.length < far + s.extraLength - 0.001)
      throw new Error('Skruven är för kort för plåt, fläns, mutter och extra längd.');
    members.push(screw);
  }
  return members;
}
