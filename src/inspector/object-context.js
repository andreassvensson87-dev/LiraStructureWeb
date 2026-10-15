/** A single mode/type decision for shared create/edit fields. No DOM or project changes. */
export function objectInspectorContext({ selected = [], drawing, operation }) {
  const types = {
    itemCreate: 'item',
    polysweepCreate: 'polysweep',
    plateCreate: 'plate',
    fastenerCreate: 'fastener',
    ...(operation?.kind ? { fit: 'component' } : {}),
  };
  const type = drawing && (!operation ? 'sweep' : types[operation.mode]);
  if (type && !operation?.cutTargets && !operation?.lineCut)
    return { mode: 'create', type, object: { type }, locked: false };
  if (selected.length === 1)
    return {
      mode: 'edit',
      type: selected[0].type || 'sweep',
      object: selected[0],
      locked: !!operation,
    };
  return {
    mode: selected.length ? 'multiple' : 'empty',
    type: null,
    object: null,
    locked: !!operation,
  };
}
