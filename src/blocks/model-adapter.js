import * as THREE from 'three';
import { plateVertices, planeFrame, plateLocal, validatePlate } from '../plate.js';
import { validateSweep } from '../sweep.js';
import { sweepType } from '../model/object-types/sweep-type.js';
import { evaluateBlock, createBlockDefinition } from './definition.js';
import { blockPoint, identityPlacement, instanceMetadata, anchoredPlacement } from './placement.js';
const vector = (p) => new THREE.Vector3(...p);
export function modelBlockDefinition(objects, name = 'Nytt 3D-block') {
  if (
    !objects.length ||
    objects.some(
      (o) => !['sweep', 'plate'].includes(o.type || 'sweep') || o.generatedBy || o.parametricBlock,
    )
  )
    throw Error('Välj fristående profiler och plåtar. Frigör befintliga block först.');
  const definition = createBlockDefinition({
    name,
    dimension: 3,
    members: objects.map((o) => ({
      id: o.id,
      name: o.name || o.id,
      points: structuredClone(o.type === 'plate' ? plateVertices(o) : [o.start, o.end]),
      source: structuredClone(o),
    })),
  });
  const origin = definition.anchors[0].point;
  definition.members.forEach(
    (member) => (member.points = member.points.map((p) => p.map((v, i) => v - origin[i]))),
  );
  definition.references.forEach(
    (reference) =>
      (reference.value = reference.id.startsWith('base')
        ? '0'
        : definition.parameters[reference.axis].name),
  );
  definition.anchors[0].point = [0, 0, 0];
  // Geometry authors remain the native model tools; a block stores their exact source objects.
  definition.members.forEach((member) => {
    delete member.source.parametricBlock;
    if (member.source.type === 'plate')
      member.source.frame.origin = member.source.frame.origin.map((v, i) => v - origin[i]);
    else {
      member.source.start = member.points[0];
      member.source.end = member.points[1];
    }
  });
  return { definition, placement: identityPlacement(3, origin) };
}
export function modelBlockMembers(
  definition,
  values = {},
  placement = identityPlacement(3),
  instanceId = crypto.randomUUID(),
  existing = [],
  anchorId = existing[0]?.parametricBlock.anchorId || definition.anchors[0].id,
) {
  if (definition.dimension !== 3) throw Error('Välj ett 3D-block.');
  const result = evaluateBlock(definition, values);
  const snapshot = structuredClone(definition);
  return result.members.map((member) => {
    if (!member.source || !['sweep', 'plate'].includes(member.source.type || 'sweep'))
      throw Error('Blocket innehåller en objekttyp som inte stöds.');
    const current = existing.find((o) => o.parametricBlock?.memberId === member.id),
      source = structuredClone(member.source),
      points = member.points.map((p) => blockPoint(placement, p));
    let object;
    if (source.type === 'plate') {
      if (points.length < 3) throw Error('Plåten behöver minst tre hörn.');
      const third = points.slice(2).find(
        (p) =>
          vector(points[1])
            .sub(vector(points[0]))
            .cross(vector(p).sub(vector(points[0])))
            .length() > 1e-6,
      );
      if (!third) throw Error('Plåten behöver en giltig yta.');
      const frame = planeFrame('three', [points[0], points[1], third]),
        normal = vector(frame.u).cross(vector(frame.v));
      if (points.some((p) => Math.abs(vector(p).sub(vector(frame.origin)).dot(normal)) > 0.001))
        throw Error('Blockets plåthörn måste ligga i samma plan.');
      const sourceNormal = vector(source.frame.u).cross(vector(source.frame.v)),
        transformedNormal = placement.axes.reduce(
          (sum, axis, i) => sum.addScaledVector(vector(axis), sourceNormal.getComponent(i)),
          new THREE.Vector3(),
        );
      // Contour winding must not reverse the native plate's positive/negative side.
      if (normal.dot(transformedNormal) < 0) frame.v = frame.v.map((v) => -v);
      object = { ...source, frame, polygon: points.map((p) => plateLocal({ frame }, p)) };
      Object.assign(object, member.properties);
    } else {
      if (points.length !== 2) throw Error('Profilen behöver start och slut.');
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(...placement.axes.map(vector)),
      );
      object = sweepType.rotate(
        { ...source, start: member.points[0], end: member.points[1] },
        { turn: (p) => blockPoint(placement, p), quaternion },
      );
      if (member.properties && Object.keys(member.properties).length)
        throw Error('Profilens tvärsnitt ändras genom profilbiblioteket.');
    }
    // Material and numbering belong to real parts, and survive parameter updates.
    if (current)
      for (const key of Object.keys(current))
        if (
          ![
            'start',
            'end',
            'frame',
            'polygon',
            'rotation',
            'profileUp',
            'thickness',
            'parametricBlock',
          ].includes(key)
        )
          object[key] = structuredClone(current[key]);
    object.id = current?.id || crypto.randomUUID();
    object.parametricBlock = instanceMetadata(
      snapshot,
      values,
      placement,
      instanceId,
      member.id,
      anchorId,
    );
    const error = object.type === 'plate' ? validatePlate(object) : validateSweep(object);
    if (error) throw Error(error);
    return object;
  });
}
export function updateModelBlock(
  members,
  values,
  definition = members[0]?.parametricBlock.definition,
) {
  if (!members.length) throw Error('Välj ett block.');
  const block = members[0].parametricBlock;
  const placement = anchoredPlacement(
    block,
    evaluateBlock(block.definition, block.values),
    evaluateBlock(definition, values),
  );
  return modelBlockMembers(definition, values, placement, block.instanceId, members);
}
