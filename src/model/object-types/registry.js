/** Definitions contain domain behavior only; editors and DOM belong in UI adapters. */
export function createObjectRegistry(definitions) {
  const types = new Map();
  for (const definition of definitions) {
    if (!definition.id || types.has(definition.id))
      throw new Error(`Ogiltig eller duplicerad objekttyp: ${definition.id}`);
    for (const method of [
      'geometry',
      'validate',
      'anchors',
      'corners',
      'snapSegments',
      'translate',
      'rotate',
    ])
      if (typeof definition[method] !== 'function')
        throw new Error(`Objekttyp ${definition.id} saknar ${method}.`);
    if (
      !definition.cut &&
      definition.physical !== false &&
      ['partFrame', 'partShape'].some((key) => typeof definition[key] !== 'function')
    )
      throw new Error(`Objekttyp ${definition.id} saknar ritnings- eller numreringsstöd.`);
    if (definition.cut && typeof definition.cutGeometry !== 'function')
      throw new Error(`Skärobjekt ${definition.id} saknar cutGeometry.`);
    types.set(definition.id, Object.freeze({ ...definition }));
  }
  function find(object) {
    // Sweeps created before explicit object types were introduced have no type field.
    if (!object) return undefined;
    return types.get(object?.type ?? 'sweep');
  }
  return Object.freeze({
    find,
    get(object) {
      const definition = find(object);
      if (!definition) throw new Error(`Okänd objekttyp: ${object?.type}`);
      return definition;
    },
    list: () => [...types.values()],
  });
}
