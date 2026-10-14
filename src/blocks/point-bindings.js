import { evaluateBlock } from './definition.js';
/** Point identities and batch constraints, independent of editor and rendering. */
export function blockPoints(definition) {
  return [
    ...definition.members,
    ...definition.anchors.map((a) => ({ ...a, points: [a.point] })),
  ].flatMap((member) =>
    member.points.map((point, index) => ({
      key: `${member.id}:${index}`,
      memberId: member.id,
      pointIndex: index,
      name: `${member.name} · punkt ${index + 1}`,
      point,
    })),
  );
}
function selectedPoints(definition, keys) {
  const byKey = new Map(blockPoints(definition).map((p) => [p.key, p]));
  const points = [...new Set(keys)].map((key) => byKey.get(key));
  if (!points.length || points.some((p) => !p)) throw Error('Välj giltiga blockpunkter.');
  return points;
}
export function pointBindingStates(definition, keys) {
  const points = selectedPoints(definition, keys);
  return Array.from({ length: definition.dimension }, (_, axis) => {
    const entries = points.map((p) =>
      definition.bindings.find(
        (b) =>
          b.memberId === p.memberId &&
          b.pointIndex === p.pointIndex &&
          definition.references.find((r) => r.id === b.referenceId)?.axis === axis,
      ),
    );
    const first = entries[0];
    const mixed = entries.some(
      (b) =>
        b?.referenceId !== first?.referenceId ||
        String(b?.offset ?? '') !== String(first?.offset ?? ''),
    );
    return {
      axis,
      mixed,
      referenceId: mixed ? null : first?.referenceId || '',
      offset: mixed ? null : String(first?.offset ?? '0'),
    };
  });
}
export function withPointBindings(
  definition,
  keys,
  { referenceId, offset = '0', axis },
  values = {},
) {
  const points = selectedPoints(definition, keys),
    next = structuredClone(definition);
  const reference = referenceId ? definition.references.find((r) => r.id === referenceId) : null;
  if (referenceId && !reference) throw Error('Välj ett giltigt referensplan.');
  axis = reference ? reference.axis : axis;
  if (!Number.isInteger(axis) || axis < 0 || axis >= definition.dimension)
    throw Error('Välj en giltig riktning.');
  const selected = new Set(points.map((p) => p.key));
  next.bindings = next.bindings.filter(
    (b) =>
      !(
        selected.has(`${b.memberId}:${b.pointIndex}`) &&
        definition.references.find((r) => r.id === b.referenceId)?.axis === axis
      ),
  );
  if (reference)
    next.bindings.push(
      ...points.map((p) => ({
        memberId: p.memberId,
        pointIndex: p.pointIndex,
        referenceId,
        offset: String(offset),
      })),
    );
  else {
    // Releasing a constraint freezes its evaluated coordinate, rather than jumping
    // back to the original authoring geometry. Other axes keep their constraints.
    const evaluated = new Map(
      blockPoints(evaluateBlock(definition, values)).map((p) => [p.key, p]),
    );
    for (const p of blockPoints(next))
      if (selected.has(p.key)) p.point[axis] = evaluated.get(p.key).point[axis];
  }
  evaluateBlock(next, values);
  return next;
}
export function pointBindingGuides(definition, result, keys, referenceId) {
  const selected = new Set(keys),
    points = new Map(blockPoints(result).map((p) => [p.key, p]));
  return definition.bindings
    .filter(
      (b) =>
        selected.has(`${b.memberId}:${b.pointIndex}`) &&
        (!referenceId || b.referenceId === referenceId),
    )
    .map((b) => {
      const reference = result.references.find((r) => r.id === b.referenceId),
        from = points.get(`${b.memberId}:${b.pointIndex}`).point,
        to = [...from];
      to[reference.axis] = reference.coordinate;
      return {
        from,
        to,
        reference,
        offset: from[reference.axis] - reference.coordinate,
        expression: String(b.offset),
      };
    });
}
