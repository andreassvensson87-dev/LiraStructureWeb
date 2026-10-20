import { validateObject } from '../model-object.js';
import { profileSnapshot } from '../section-profile.js';
import { latestMaterials, validateMaterial } from '../materials.js';
import { nextIdentity } from '../object-identity.js';

export const MODEL_IMPORT_LIMIT = 10 * 1024 * 1024;
const fail = (message) => {
  throw new Error(message);
};
const record = (v) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v, limit = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= limit;
const point = (v, size) => Array.isArray(v) && v.length === size && v.every(Number.isFinite);
function keys(value, allowed) {
  if (!record(value)) fail('Förväntade ett objekt.');
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) fail(`Okänt fält: ${unknown}.`);
}
const normalize = (v) => v.trim().toLocaleUpperCase('sv').replace(/\s+/g, '');
function latest(records) {
  const byId = new Map();
  for (const item of records)
    if (!byId.has(item.id) || byId.get(item.id).revision < item.revision) byId.set(item.id, item);
  return [...byId.values()];
}
function named(records, name, label) {
  if (!text(name, 120)) fail(`Ange ${label.toLowerCase()}.`);
  const matches = records.filter((item) => normalize(item.name) === normalize(name));
  if (matches.length !== 1)
    fail(
      matches.length
        ? `${label} ${name} är tvetydigt. Välj i biblioteket.`
        : `${label} ${name} saknas i biblioteket.`,
    );
  return matches[0];
}
export function parseModelImport(content) {
  if (typeof content !== 'string' || new TextEncoder().encode(content).length > MODEL_IMPORT_LIMIT)
    fail('Modellförslaget får vara högst 10 MB.');
  let data;
  try {
    data = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    fail('Filen innehåller inte giltig JSON.');
  }
  keys(data, ['format', 'version', 'units', 'coordinates', 'importId', 'objects']);
  if (data.format !== 'lira-model-import' || data.version !== 1)
    fail('Modellförslaget måste använda lira-model-import version 1.');
  if (data.units !== 'mm' || data.coordinates !== 'local-z-up')
    fail('Använd millimeter och lokala koordinater med Z uppåt.');
  if (!text(data.importId, 120)) fail('Ange en stabil importId (högst 120 tecken).');
  if (!Array.isArray(data.objects) || !data.objects.length || data.objects.length > 1000)
    fail('Modellförslaget behöver 1–1 000 objekt.');
  const ids = new Set();
  for (const item of data.objects) {
    if (!record(item) || !text(item.id, 120) || ids.has(item.id))
      fail('Alla förslagsobjekt behöver unika id (högst 120 tecken).');
    ids.add(item.id);
  }
  return data;
}
function validateEntry(item) {
  const common = ['id', 'type', 'name', 'material', 'source', 'assumptions', 'ifcClass'];
  keys(item, [
    ...common,
    ...(item.type === 'sweep'
      ? ['profile', 'start', 'end', 'rotation', 'profileUp']
      : ['frame', 'polygon', 'thickness', 'side']),
  ]);
  if (!['sweep', 'plate'].includes(item.type)) fail('Version 1 stöder endast sweep och plate.');
  if (!text(item.name, 120)) fail('Ange ett objektnamn (högst 120 tecken).');
  if (!text(item.material, 120)) fail('Ange materialets biblioteksnamn.');
  keys(item.source, ['file', 'page', 'detail', 'elementId']);
  if (!text(item.source.file, 240)) fail('Ange källfil.');
  if (
    item.source.page !== undefined &&
    (!Number.isSafeInteger(item.source.page) || item.source.page < 1)
  )
    fail('Källsidan måste vara ett positivt heltal.');
  for (const field of ['detail', 'elementId'])
    if (item.source[field] !== undefined && !text(item.source[field], 240))
      fail(`Ogiltig källhänvisning: ${field}.`);
  if (
    item.assumptions !== undefined &&
    (!Array.isArray(item.assumptions) ||
      item.assumptions.length > 20 ||
      !item.assumptions.every((v) => text(v, 500)))
  )
    fail('Antaganden ska vara högst 20 texter med högst 500 tecken vardera.');
  if (item.type === 'sweep') {
    if (!point(item.start, 3) || !point(item.end, 3))
      fail('Start och slut behöver tre giltiga koordinater vardera.');
    if (!text(item.profile, 120)) fail('Ange profilens biblioteksnamn.');
    if (item.rotation !== undefined && !Number.isFinite(item.rotation))
      fail('Ange giltig profilrotation i grader.');
    if (item.profileUp !== undefined && !point(item.profileUp, 3))
      fail('Profilriktningen behöver tre giltiga tal.');
  } else {
    keys(item.frame, ['origin', 'u', 'v']);
    if (!['origin', 'u', 'v'].every((key) => point(item.frame[key], 3)))
      fail('Plåtens arbetsplan behöver origin, u och v med tre tal vardera.');
    if (
      !Array.isArray(item.polygon) ||
      item.polygon.length < 3 ||
      item.polygon.length > 1000 ||
      !item.polygon.every((v) => point(v, 2))
    )
      fail('Plåtkonturen behöver 3–1 000 punkter med två koordinater vardera.');
    if (!Number.isFinite(item.thickness)) fail('Ange plåttjocklek i mm.');
    if (!['center', 'positive', 'negative'].includes(item.side))
      fail('Ange plåtens sida: center, positive eller negative.');
  }
}
export function isModelImportDuplicate(data, item, objects) {
  return objects.some(
    (o) => o.modelImport?.importId === data.importId && o.modelImport?.objectId === item.id,
  );
}
/** Detached rows. File identities never become internal model identities. */
export function planModelImport(
  data,
  { profiles, materials, objects = [] },
  overrides = new Map(),
) {
  const sections = latest(profiles),
    stock = latestMaterials(materials);
  return data.objects.map((input) => {
    const row = {
      id: input.id,
      input,
      object: null,
      error: '',
      assumptions: Array.isArray(input.assumptions)
        ? input.assumptions.filter((v) => typeof v === 'string')
        : [],
    };
    try {
      validateEntry(input);
      if (isModelImportDuplicate(data, input, objects)) fail('Redan importerad i projektet.');
      const choice = overrides.get(input.id) || {};
      const material = structuredClone(choice.material || named(stock, input.material, 'Material'));
      validateMaterial(material);
      const base = {
        ...(input.ifcClass === undefined ? {} : { ifcClass: input.ifcClass }),
        id: crypto.randomUUID(),
        type: input.type,
        name: input.name,
        material,
        modelImport: {
          importId: data.importId,
          objectId: input.id,
          source: structuredClone(input.source),
          assumptions: [...row.assumptions],
        },
      };
      if (input.type === 'sweep') {
        const definition = choice.profile || named(sections, input.profile, 'Profil');
        const section = Array.isArray(definition.parameters)
          ? profileSnapshot(definition)
          : structuredClone(definition);
        row.object = {
          ...base,
          profile: 'custom',
          section,
          start: [...input.start],
          end: [...input.end],
          rotation: input.rotation ?? 0,
          ...(input.profileUp ? { profileUp: [...input.profileUp] } : {}),
          width: section.properties.bounds.width,
          height: section.properties.bounds.height,
          thickness: 1,
        };
      } else
        row.object = {
          ...base,
          frame: structuredClone(input.frame),
          polygon: structuredClone(input.polygon),
          thickness: input.thickness,
          side: input.side,
        };
      const error = validateObject(row.object);
      if (error) fail(error);
    } catch (error) {
      row.object = null;
      row.error = error.message;
    }
    return row;
  });
}
/** Recheck duplicate protection and review decisions against the current project before commit. */
export function modelImportObjects(data, rows, selected, approved, objects) {
  const added = [];
  for (const row of rows.filter((r) => selected.has(r.id))) {
    if (row.error || !row.object)
      fail(`${row.input.name || row.id}: ${row.error || 'Ogiltigt objekt.'}`);
    if (row.assumptions.length && !approved.has(row.id))
      fail(`${row.input.name}: bekräfta antagandena först.`);
    if (isModelImportDuplicate(data, row.input, objects))
      fail(`${row.input.name}: redan importerad i projektet.`);
    const object = structuredClone(row.object);
    object.modelImport.assumptionsAccepted = row.assumptions.length > 0;
    Object.assign(object, nextIdentity(object, [...objects, ...added]));
    const error = validateObject(object);
    if (error) fail(error);
    added.push(object);
  }
  if (!added.length) fail('Välj minst ett giltigt objekt.');
  return added;
}
