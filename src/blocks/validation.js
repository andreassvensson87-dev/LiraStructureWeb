import { modelBlockMembers } from './model-adapter.js';
import { drawingBlockMembers } from './drawing-adapter.js';
import { evaluateBlock } from './definition.js';
import { validateBlockPlacement } from './placement.js';
/** Validates complete instance membership and identical snapshots before a transaction. */
export function validateBlockInstances(objects, dimension, generate) {
  const groups = new Map();
  for (const object of objects) {
    const block = object.parametricBlock;
    if (!block) continue;
    if (
      typeof block.instanceId !== 'string' ||
      !block.instanceId ||
      typeof block.memberId !== 'string' ||
      !block.values ||
      block.definition?.dimension !== dimension
    )
      throw Error('Ogiltig blockinstans.');
    validateBlockPlacement(block.placement, dimension);
    if (!groups.has(block.instanceId)) groups.set(block.instanceId, []);
    groups.get(block.instanceId).push(object);
  }
  for (const members of groups.values()) {
    const first = members[0].parametricBlock,
      signature = (b) => JSON.stringify([b.definition, b.values, b.placement, b.anchorId]);
    const evaluated = evaluateBlock(first.definition, first.values);
    if (!evaluated.anchors.some((a) => a.id === first.anchorId))
      throw Error('Blockets insättningspunkt saknas.');
    if (
      members.length !== evaluated.members.length ||
      new Set(members.map((o) => o.parametricBlock.memberId)).size !== members.length ||
      (dimension === 2 && members.some((o) => o.view !== members[0].view)) ||
      members.some((o) => signature(o.parametricBlock) !== signature(first))
    )
      throw Error('Blocket saknar delar eller har motstridiga parametrar.');
    if (generate) {
      const expected = generate(members, first.values);
      const close = (a, b) =>
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((v, i) =>
          Array.isArray(v)
            ? close(v, b[i])
            : typeof v === 'number' && typeof b[i] === 'number'
              ? Math.abs(v - b[i]) < 1e-5
              : v === b[i],
        );
      for (const object of members) {
        const candidate = expected.find((o) => o.id === object.id);
        if (
          !candidate ||
          object.type !== candidate.type ||
          ['start', 'end', 'points', 'polygon'].some(
            (key) => candidate[key] && !close(object[key], candidate[key]),
          ) ||
          (candidate.frame &&
            ['origin', 'u', 'v'].some(
              (key) => !close(object.frame?.[key], candidate.frame[key]),
            )) ||
          ['thickness', 'rotation', 'shape', 'closed'].some((key) =>
            typeof candidate[key] === 'number' && typeof object[key] === 'number'
              ? Math.abs(candidate[key] - object[key]) > 1e-5
              : candidate[key] !== object[key],
          )
        )
          throw Error(
            'Blockets geometri styrs av parametrar. Ändra blocket eller frigör det först.',
          );
      }
    }
  }
}

export function validateBlockGeometry(result, definition) {
  if (definition.dimension === 3) modelBlockMembers(definition, result.values);
  else
    drawingBlockMembers(
      definition,
      result.values,
      undefined,
      definition.units === 'paper' ? 'paper' : 'preview',
    );
}
