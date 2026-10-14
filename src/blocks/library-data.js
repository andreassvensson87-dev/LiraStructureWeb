import { evaluateBlock } from './definition.js';
export function validateBlockLibrary(data) {
  if (data?.schema !== 1 || !Array.isArray(data.definitions) || data.definitions.length > 1000)
    throw Error('Ogiltigt blockbibliotek.');
  const ids = new Set();
  for (const definition of data.definitions) {
    evaluateBlock(definition);
    const key = `${definition.id}:${definition.revision}`;
    if (ids.has(key)) throw Error('Duplicerad blockversion.');
    ids.add(key);
  }
  return data;
}
export function nextBlockVersion(library, definition) {
  validateBlockLibrary(library);
  evaluateBlock(definition);
  const revision =
    1 +
    Math.max(
      0,
      ...library.definitions.filter((d) => d.id === definition.id).map((d) => d.revision),
    );
  const next = { ...structuredClone(definition), revision };
  return {
    library: validateBlockLibrary({ schema: 1, definitions: [...library.definitions, next] }),
    definition: next,
  };
}
export function mergeBlockLibrary(library, imported) {
  validateBlockLibrary(library);
  validateBlockLibrary(imported);
  const definitions = [...library.definitions];
  for (const definition of imported.definitions) {
    const existing = definitions.find(
      (d) => d.id === definition.id && d.revision === definition.revision,
    );
    if (existing && JSON.stringify(existing) !== JSON.stringify(definition))
      throw Error('En blockversion med samma identitet har annat innehåll.');
    if (!existing) definitions.push(structuredClone(definition));
  }
  return validateBlockLibrary({ schema: 1, definitions });
}
