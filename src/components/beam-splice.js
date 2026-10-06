import { boltedEndplateDefaults } from './bolted-parameters.js';
import * as THREE from 'three';
import { sweepFrame } from '../sweep.js';
import { validatePlate } from '../plate.js';
import { lineCutFrame } from '../line-cut.js';
import { selectFastenerLength, fittedAssembly } from '../fasteners/assembly.js';
import { validateAccessories } from '../fasteners/accessories.js';
import { validateFastener } from '../fasteners/object-type.js';
import { axisPlacement } from '../fasteners/geometry.js';
import {
  validateBoltedEndplate,
  flangeProfile,
  localContours,
  inside,
  distance,
} from './bolted-endplate.js';

export const beamSpliceDefaults = { ...boltedEndplateDefaults, endA: 'end', endB: 'start' };
const vec = (p) => new THREE.Vector3(...p);
export function validateBeamSplice(s) {
  if (s.kind !== 'beamSplice' || !['start', 'end'].includes(s.endA))
    return 'Välj giltiga balkändar för balkskarven.';
  if (
    !Array.isArray(s.references) ||
    s.references.length !== 2 ||
    s.references.some((id) => typeof id !== 'string' || !id || id === s.id) ||
    s.references[0] === s.references[1]
  )
    return 'Välj två olika balkar för balkskarven.';
  return validateBoltedEndplate({ ...s, kind: 'boltedEndplate' });
}
/** The selected nominal endpoints define the joint station; neither reference is rewritten. */
export function resolveBeamSplice(s, model) {
  const error = validateBeamSplice(s);
  if (error) throw new Error(error);
  const beams = s.references.map((id) => model.find((o) => o.id === id));
  if (!beams.every(flangeProfile)) throw new Error('Balkskarven kräver två H- eller I-profiler.');
  const frames = beams.map(sweepFrame),
    ends = [s.endA, s.endB];
  const normal = frames[0].axis.clone().multiplyScalar(s.endA === 'end' ? 1 : -1);
  const otherOutward = frames[1].axis.clone().multiplyScalar(s.endB === 'end' ? 1 : -1);
  if (normal.dot(otherOutward) > -1 + 1e-6)
    throw new Error(
      'Välj mötande ändar på två parallella balkar. Vinklade skarvar stöds ännu inte.',
    );
  const endpoints = beams.map((b, i) => vec(b[ends[i]]));
  const delta = endpoints[1].clone().sub(endpoints[0]);
  if (delta.clone().addScaledVector(normal, -delta.dot(normal)).length() > 0.1)
    throw new Error('Balkarnas referenslinjer måste ligga på samma raka linje.');
  const center = endpoints[0].clone().add(endpoints[1]).multiplyScalar(0.5);
  const u = frames[0].x.clone(),
    v = normal.clone().cross(u).normalize();
  const loops = beams.map((b, i) =>
    localContours(b).map((loop) =>
      loop.map(([x, y]) => {
        const p = frames[i].x.clone().multiplyScalar(x).addScaledVector(frames[i].y, y);
        return [p.dot(u), p.dot(v)];
      }),
    ),
  );
  const points = loops.flat(2);
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const plateWidth = s.sizeMode === 'manual' ? s.width : maxX - minX + 2 * s.outstandX;
  const plateLength = s.sizeMode === 'manual' ? s.length : maxY - minY + 2 * s.outstandY;
  if (plateWidth < maxX - minX - 0.001 || plateLength < maxY - minY - 0.001)
    throw new Error('Båda plåtarna måste täcka båda balkarnas tvärsnitt.');
  const origin = center
    .clone()
    .addScaledVector(u, (minX + maxX) / 2)
    .addScaledVector(v, (minY + maxY) / 2);
  const cuts = beams.map((beam, i) => {
    const sign = i === 0 ? -1 : 1;
    const face = center.clone().addScaledVector(normal, sign * (s.gap / 2 + s.thickness));
    const keep = vec(beam[ends[i] === 'start' ? 'end' : 'start']);
    if (keep.clone().sub(face).dot(normal) * sign < 1)
      throw new Error('Skarven får inte kapa bort hela balken. Välj ändarna mot varandra.');
    for (const other of model.filter((o) => o.type === 'component' && o.id !== s.id)) {
      const index = other.references?.indexOf(beam.id);
      if (index == null || index < 0) continue;
      const affects =
        ['endplate', 'baseplate', 'beamSplice'].includes(other.kind) ||
        (other.kind === 'boltedEndplate' && index === 1) ||
        (other.kind === 'fit' && (other.mode === 'miter' || index === 1));
      if (affects && (index === 0 ? other.endA : other.endB) === ends[i])
        throw new Error('Balkänden har redan en koppling. Modifiera den befintliga kopplingen.');
    }
    // Reject independent cuts that remove the welding face at the proposed station.
    for (const cut of model.filter((o) => o.type === 'linecut' && o.targets?.includes(beam.id))) {
      const f = lineCutFrame(cut),
        cutSign = cut.side === 'positive' ? 1 : -1;
      if (
        loops[i]
          .flat()
          .some(
            ([x, y]) =>
              face.clone().addScaledVector(u, x).addScaledVector(v, y).sub(f.origin).dot(f.n) *
                cutSign >
              0.001,
          )
      )
        throw new Error(
          'Skarven ligger vid en befintlig kapning. Ändra kapningen eller skarvens läge.',
        );
    }
    return {
      type: 'linecut',
      targets: [beam.id],
      frame: {
        origin: face.toArray(),
        u: u.toArray(),
        v: normal.clone().multiplyScalar(sign).toArray(),
      },
      polygon: [
        [-150, 0],
        [150, 0],
      ],
      side: 'positive',
    };
  });
  const assembly = {
    nearWasher: s.nearWasher,
    farWasher: s.farWasher,
    nut: true,
    nearNut: false,
    extraNut: false,
  };
  const grip = 2 * s.thickness + s.gap;
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
    Math.max(...hardware.accessories.map((a) => a.offset + fitted.spec[a.kind].thickness)) +
    s.extraLength;
  if (fitted.spec.length < required - 0.001)
    throw new Error('Skruven är för kort för två plåtar, spalt och mutter.');
  const radius = Math.max(
    s.holeDiameter / 2,
    fitted.spec.head.diameter / Math.sqrt(3),
    fitted.spec.nut.acrossFlats / Math.sqrt(3),
    s.nearWasher || s.farWasher ? fitted.spec.washer.outerDiameter / 2 : 0,
  );
  if (
    (s.columns > 1 && s.spacingX < 2 * radius + s.clearance) ||
    (s.rows > 1 && s.spacingY < 2 * radius + s.clearance)
  )
    throw new Error('Skruvarnas hål eller tillbehör överlappar. Öka skruvavstånden.');
  const edge = Math.max(s.edgeDistance, radius + s.clearance),
    boltLayout = [];
  for (let row = 0; row < s.rows; row++)
    for (let column = 0; column < s.columns; column++) {
      const x = s.offsetX + (column - (s.columns - 1) / 2) * s.spacingX,
        y = s.offsetY + (row - (s.rows - 1) / 2) * s.spacingY;
      const label = `Rad ${row + 1}, kolumn ${column + 1}: `;
      if (
        Math.abs(x) + edge > plateWidth / 2 + 0.001 ||
        Math.abs(y) + edge > plateLength / 2 + 0.001
      )
        throw new Error(label + 'kantavståndet på plåtarna är för litet.');
      const profilePoint = [x + (minX + maxX) / 2, y + (minY + maxY) / 2];
      if (
        loops.some(
          (loop) =>
            inside(profilePoint, loop) ||
            distance(profilePoint, loop) < radius + s.clearance - 0.001,
        )
      )
        throw new Error(
          label + 'skruvhuvud eller mutter ligger för nära balkarnas liv eller flänsar.',
        );
      boltLayout.push({
        row,
        column,
        point: origin.clone().addScaledVector(u, x).addScaledVector(v, y).toArray(),
        spec: fitted.spec,
        grip,
        assembly,
      });
    }
  const result = {
    ...s,
    position: origin.toArray(),
    normal: normal.toArray(),
    frame: { origin: origin.toArray(), u: u.toArray(), v: v.toArray() },
    plateWidth,
    plateLength,
    targets: [...s.references],
    cuts,
    boltLayout,
  };
  beamSpliceMembers(result, model);
  return JSON.stringify(result) === JSON.stringify(s) ? s : result;
}
export function beamSpliceMembers(s, model) {
  const old = new Map(model.filter((o) => o.generatedBy === s.id).map((o) => [o.id, o]));
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
  const normal = vec(s.normal),
    origin = vec(s.position);
  const members = s.references.map((id, i) => {
    const beam = model.find((o) => o.id === id),
      sign = i === 0 ? -1 : 1;
    const plate = own(
      {
        id: `${s.id}:plate:${i}`,
        type: 'plate',
        name: `Ändplåt ${i + 1}`,
        frame: {
          ...structuredClone(s.frame),
          origin: origin
            .clone()
            .addScaledVector(normal, (sign * s.gap) / 2)
            .toArray(),
        },
        side: i === 0 ? 'negative' : 'positive',
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
    const error = validatePlate(plate);
    if (error) throw new Error(error);
    return plate;
  });
  for (const bolt of s.boltLayout) {
    const washer = s.nearWasher ? bolt.spec.washer.thickness : 0;
    const start = vec(bolt.point).addScaledVector(normal, s.gap / 2 + s.thickness + washer);
    const screw = own(
      fittedAssembly(
        {
          id: `${s.id}:bolt:${bolt.row}:${bolt.column}`,
          type: 'fastener',
          name: bolt.spec.name,
          spec: structuredClone(bolt.spec),
          ...axisPlacement(bolt.spec, start.toArray(), start.clone().sub(normal).toArray()),
          radial: [...s.frame.u],
          anchorId: members[1].id,
          assembly: bolt.assembly,
          lengthMode: 'manual',
          extraLength: s.extraLength,
          holes: [1, 0].map((i) => ({
            id: `${s.id}:hole:${i}:${bolt.row}:${bolt.column}`,
            type: 'bore',
            targetId: members[i].id,
            kind: 'clearance',
            extent: 'manual',
            offset: washer + (i === 0 ? s.thickness + s.gap : 0),
            depth: s.thickness,
            diameter: s.holeDiameter,
          })),
        },
        bolt.grip,
      ),
      'bolt',
    );
    const error = validateFastener(screw);
    if (error) throw new Error(error);
    members.push(screw);
  }
  return members;
}
