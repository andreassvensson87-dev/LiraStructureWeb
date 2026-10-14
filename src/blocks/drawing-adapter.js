import { createBlockDefinition, evaluateBlock } from './definition.js';
import { identityPlacement, blockPoint, instanceMetadata, anchoredPlacement } from './placement.js';
import { validateShape, shapeNames, shapeSnapPoints } from '../drawing-shapes.js';
export function drawingBlockDefinition(items, name = 'Nytt 2D-block') {
  if (
    !items.length ||
    items.some(
      (item) => item.type !== 'shape' || item.view !== items[0].view || item.parametricBlock,
    )
  )
    throw Error('Välj fristående ritformer i samma vy.');
  const definition = createBlockDefinition({
    name,
    dimension: 2,
    members: items.map((item) => ({
      id: item.id,
      name: shapeNames[item.shape],
      points: structuredClone(item.shape === 'rectangle' ? shapeSnapPoints(item) : item.points),
      source: structuredClone(item),
    })),
  });
  definition.units = items[0].view === 'paper' ? 'paper' : 'model';
  const origin = definition.anchors[0].point;
  definition.members.forEach((member) => {
    member.points = member.points.map((p) => p.map((v, i) => v - origin[i]));
    member.source.points = member.points;
    if (member.source.shape === 'rectangle')
      Object.assign(member.source, { shape: 'polyline', closed: true });
    delete member.source.view;
  });
  definition.references.forEach(
    (reference) =>
      (reference.value = reference.id.startsWith('base')
        ? '0'
        : definition.parameters[reference.axis].name),
  );
  definition.anchors[0].point = [0, 0];
  return { definition, placement: identityPlacement(2, origin), view: items[0].view };
}
export function drawingBlockMembers(
  definition,
  values = {},
  placement = identityPlacement(2),
  view,
  instanceId = crypto.randomUUID(),
  existing = [],
  anchorId = existing[0]?.parametricBlock.anchorId || definition.anchors[0].id,
) {
  if (definition.dimension !== 2 || !['paper', 'model'].includes(definition.units))
    throw Error('Välj ett 2D-block med giltig måttenhet.');
  if ((view === 'paper') !== (definition.units === 'paper'))
    throw Error('Pappersblock placeras på bladet och modellblock i en vy.');
  const snapshot = structuredClone(definition);
  return evaluateBlock(definition, values).members.map((member) => {
    if (member.source?.type !== 'shape' || !Object.hasOwn(shapeNames, member.source.shape))
      throw Error('Blocket innehåller en ritform som inte stöds.');
    const current = existing.find((o) => o.parametricBlock?.memberId === member.id);
    if (member.properties && member.source.shape !== 'insulation')
      throw Error(
        'Tjockleksparametrar stöds för isolering. Övriga former styrs av punktlåsningar.',
      );
    const object = {
      ...structuredClone(member.source),
      ...member.properties,
      points: member.points.map((p) => blockPoint(placement, p)),
      view,
      id: current?.id || crypto.randomUUID(),
      parametricBlock: instanceMetadata(
        snapshot,
        values,
        placement,
        instanceId,
        member.id,
        anchorId,
      ),
    };
    validateShape(object.shape, object.points, object.closed);
    if (object.shape === 'insulation' && (!(object.thickness > 0) || object.thickness > 1e7))
      throw Error('Ange positiv isoleringstjocklek.');
    return object;
  });
}
export function updateDrawingBlock(
  members,
  values,
  definition = members[0]?.parametricBlock.definition,
) {
  if (!members.length) throw Error('Välj ett block.');
  const block = members[0].parametricBlock;
  return drawingBlockMembers(
    definition,
    values,
    anchoredPlacement(
      block,
      evaluateBlock(block.definition, block.values),
      evaluateBlock(definition, values),
    ),
    members[0].view,
    block.instanceId,
    members,
  );
}
