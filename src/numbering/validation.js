/** Stored ownership must be coherent even while geometry awaits renumbering. */
export function validateNumberingOwnership(state) {
  for (const options of [state.parts.options, state.assemblyNumbering?.options]) {
    if (options === undefined) continue;
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw Error('Ogiltiga sparade numreringsregler.');
    for (const field of ['tolerance', 'assemblyTolerance'])
      if (options[field] !== undefined && (!Number.isFinite(options[field]) || options[field] < 0))
        throw Error('Numreringens toleranser måste vara noll eller positiva tal.');
    for (const field of ['newParts', 'modifiedParts'])
      if (options[field] !== undefined && !['compare', 'new'].includes(options[field]))
        throw Error('Ogiltig sparad numreringsregel.');
    for (const field of [
      'parts',
      'assemblies',
      'objectSeries',
      'renumberAll',
      'reuseOldNumbers',
      'compareHoles',
      'compareNames',
    ])
      if (options[field] !== undefined && typeof options[field] !== 'boolean')
        throw Error('Ogiltigt sparat numreringsval.');
  }
  const validateRegistry = (records, label) => {
    const keys = new Map(),
      marks = new Set();
    for (const record of records || []) {
      if (
        !record ||
        typeof record.key !== 'string' ||
        !record.key ||
        typeof record.mark !== 'string' ||
        !record.mark.trim() ||
        keys.has(record.key) ||
        marks.has(record.mark.toLowerCase())
      )
        throw Error(`${label}: en typ och en mark måste ha ett entydigt ägarskap.`);
      keys.set(record.key, record.mark);
      marks.add(record.mark.toLowerCase());
    }
    return keys;
  };
  const parts = validateRegistry(state.parts.registry, 'Partnumrering');
  for (const record of Object.values(state.parts.assignments))
    if (!record || parts.get(record.key) !== record.mark)
      throw Error('Parttilldelningen stämmer inte med numreringsregistret.');
  const assemblies = validateRegistry(state.assemblyNumbering?.registry, 'Assemblynumrering');
  for (const assembly of state.assemblies || [])
    if (assembly.typeKey && assemblies.get(assembly.typeKey) !== assembly.mark)
      throw Error('Assemblytilldelningen stämmer inte med numreringsregistret.');
}
