import { expression } from '../section-expression.js';
import { evaluateBlock } from './definition.js';
/** Direct parameter locks can drive grips; coupled expressions stay explicitly governed. */
export function blockGripValues(block, memberId, pointIndex, target) {
  const definition = block.definition,
    values = { ...block.values },
    result = evaluateBlock(definition, values),
    anchor = result.anchors.find((a) => a.id === block.anchorId),
    source = definition.members.find((m) => m.id === memberId);
  if (!anchor || !source?.points[pointIndex]) throw Error('Blockpunkten saknas.');
  const local = block.placement.axes.map((axis) =>
    target.reduce((sum, v, i) => sum + (v - block.placement.origin[i]) * axis[i], 0),
  );
  const affine = (id, index, axis, coordinate) => {
    const binding = definition.bindings.find(
      (b) =>
        b.memberId === id &&
        b.pointIndex === index &&
        definition.references.find((r) => r.id === b.referenceId)?.axis === axis,
    );
    if (!binding) return { constant: coordinate };
    const reference = definition.references.find((r) => r.id === binding.referenceId),
      parameter = definition.parameters.find((p) => p.name === String(reference.value).trim());
    try {
      const offset = expression(binding.offset);
      return parameter
        ? { parameter: parameter.name, constant: offset }
        : { constant: expression(reference.value) + offset };
    } catch {
      return null;
    }
  };
  const driven = new Map();
  let changed = false;
  for (let axis = 0; axis < definition.dimension; axis++) {
    const pointRule = affine(memberId, pointIndex, axis, source.points[pointIndex][axis]),
      anchorRule = affine(
        block.anchorId,
        0,
        axis,
        definition.anchors.find((a) => a.id === block.anchorId).point[axis],
      );
    if (
      !pointRule ||
      !anchorRule ||
      pointRule.parameter === anchorRule.parameter ||
      (pointRule.parameter && anchorRule.parameter)
    )
      continue;
    const parameter = pointRule.parameter || anchorRule.parameter,
      coefficient = pointRule.parameter ? 1 : -1,
      value =
        (local[axis] - anchor.point[axis] - pointRule.constant + anchorRule.constant) / coefficient;
    if (driven.has(parameter) && Math.abs(driven.get(parameter) - value) > 1e-7)
      throw Error('Greppet har kopplade riktningar. Ändra parametrarna i inspektorn.');
    driven.set(parameter, value);
    if (Math.abs(value - result.values[parameter]) > 1e-7) {
      values[parameter] = value;
      changed = true;
    }
  }
  if (!changed)
    throw Error(
      'Punkten styrs av fasta referenser eller ett uttryck. Ändra parametrarna i inspektorn.',
    );
  return values;
}
export function blockPropertyGripValues(block, memberId, key, value) {
  const property = block.definition.properties.find(
      (p) => p.memberId === memberId && p.key === key,
    ),
    parameter = block.definition.parameters.find((p) => p.name === String(property?.value).trim());
  if (!parameter)
    throw Error('Egenskapen styrs av ett uttryck. Ändra blockets parametrar i inspektorn.');
  return { ...block.values, [parameter.name]: value };
}
export function blockRadiusGripValues(block, memberId, center, edge, target) {
  const radius = Math.hypot(...target.map((v, i) => v - center[i])),
    length = Math.hypot(...edge.map((v, i) => v - center[i]));
  if (length < 1e-7) throw Error('Cirkeln behöver en giltig radie.');
  return blockGripValues(
    block,
    memberId,
    1,
    edge.map((v, i) => center[i] + ((v - center[i]) * radius) / length),
  );
}
