/** Item definitions are immutable library snapshots. Placement never changes their geometry. */
export const ITEM_FILE_LIMIT = 50 * 1024 * 1024;
export const ITEM_VERTEX_LIMIT = 1000000;
export const itemKey = (item) => `${item.id}:${item.revision}`;
export const pointValid = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const nameValid = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
export function validateItemDefinition(item) {
  if (
    !item ||
    !nameValid(item.id) ||
    !nameValid(item.name) ||
    !nameValid(item.geometryId) ||
    !Number.isInteger(item.revision) ||
    item.revision < 1 ||
    !pointValid(item.start) ||
    !pointValid(item.end) ||
    Math.hypot(...item.end.map((v, i) => v - item.start[i])) < 0.001
  )
    throw Error('Item behöver ett namn och två olika start- och slutpunkter.');
  for (const key of ['article', 'supplier', 'sourceName'])
    if (typeof item[key] !== 'string' || item[key].length > 300)
      throw Error('Ogiltiga item-egenskaper.');
  if (!['anchors', 'box'].includes(item.snap)) throw Error('Ogiltiga snapreferenser.');
  const mesh = item.mesh;
  if (
    !mesh ||
    !Array.isArray(mesh.positions) ||
    mesh.positions.length < 9 ||
    mesh.positions.length % 3 ||
    mesh.positions.length > ITEM_VERTEX_LIMIT * 3 ||
    !mesh.positions.every(Number.isFinite) ||
    !Array.isArray(mesh.indices) ||
    !mesh.indices.length ||
    mesh.indices.length % 3 ||
    mesh.indices.length > ITEM_VERTEX_LIMIT * 12 ||
    !mesh.indices.every((n) => Number.isInteger(n) && n >= 0 && n < mesh.positions.length / 3) ||
    (mesh.normals &&
      (!Array.isArray(mesh.normals) ||
        mesh.normals.length !== mesh.positions.length ||
        !mesh.normals.every(Number.isFinite)))
  )
    throw Error('Ogiltig item-geometri.');
  return item;
}
export function meshBounds(mesh) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i++) {
    const axis = i % 3,
      n = mesh.positions[i];
    min[axis] = Math.min(min[axis], n);
    max[axis] = Math.max(max[axis], n);
  }
  return { min, max };
}
export function defaultItemPoints(mesh) {
  const { min, max } = meshBounds(mesh);
  const axis = max.map((v, i) => v - min[i]).indexOf(Math.max(...max.map((v, i) => v - min[i])));
  const start = min.map((v, i) => Math.round((i === axis ? v : (v + max[i]) / 2) * 1000) / 1000);
  const end = [...start];
  end[axis] = Math.round(max[axis] * 1000) / 1000;
  return { start, end };
}
export function combineStepMeshes(result) {
  if (!result?.success || !result.meshes?.length)
    throw Error('STEP-filen innehåller ingen läsbar geometri.');
  const positions = [],
    normals = [],
    indices = [];
  let completeNormals = true;
  for (const mesh of result.meshes) {
    const offset = positions.length / 3,
      p = mesh.attributes?.position?.array,
      n = mesh.attributes?.normal?.array;
    if (!p || !mesh.index?.array) throw Error('STEP-geometrin saknar trianglar.');
    if (offset + p.length / 3 > ITEM_VERTEX_LIMIT) throw Error('STEP-geometrin är för stor.');
    for (const v of p) positions.push(v);
    if (!n || n.length !== p.length) completeNormals = false;
    else for (const v of n) normals.push(v);
    for (const v of mesh.index.array) indices.push(v + offset);
  }
  return { positions, ...(completeNormals ? { normals } : {}), indices };
}
export function itemRevision(source, values) {
  return validateItemDefinition({ ...source, ...values, revision: source.revision + 1 });
}
export function packItems(objects) {
  const definitions = new Map();
  const packed = objects.map((object) => {
    if (object.type !== 'item') return object;
    const key = itemKey(object.item),
      known = definitions.get(key);
    if (known && known !== object.item && JSON.stringify(known) !== JSON.stringify(object.item))
      throw Error('Två olika item-definitioner har samma identitet och version.');
    definitions.set(key, object.item);
    const { item, ...rest } = object;
    return { ...rest, itemRef: key };
  });
  return { objects: packed, itemDefinitions: [...definitions.values()] };
}
export function unpackItems(project) {
  if (!project || typeof project !== 'object') throw Error('Ogiltig projektfil.');
  if (project.itemDefinitions === undefined) return project;
  if (
    !Array.isArray(project.itemDefinitions) ||
    project.itemDefinitions.length > 10000 ||
    !Array.isArray(project.objects)
  )
    throw Error('Ogiltigt item-bibliotek i projektfilen.');
  const definitions = new Map();
  for (const item of project.itemDefinitions) {
    validateItemDefinition(item);
    const key = itemKey(item);
    if (definitions.has(key)) throw Error('Duplicerad item-version i projektfilen.');
    definitions.set(key, item);
  }
  project.objects = project.objects.map((object) => {
    if (object.type !== 'item') return object;
    if (object.item || !definitions.has(object.itemRef))
      throw Error('Item-definitionen saknas i projektfilen.');
    const { itemRef, ...rest } = object;
    return { ...rest, item: definitions.get(itemRef) };
  });
  delete project.itemDefinitions;
  return project;
}
