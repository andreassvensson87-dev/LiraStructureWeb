import { importFastener } from './model-import-fastener.js';
import { validateObject } from '../model-object.js';
import { resolveFit } from '../components/fit.js';
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
export function latestImportProfiles(records) {
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
  if (data.format !== 'lira-model-import' || ![1, 2, 3].includes(data.version))
    fail('Modellförslaget måste använda lira-model-import version 1, 2 eller 3.');
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
export function modelImportDependencies(item) {
  const refs =
    item.type === 'fit'
      ? item.references
      : item.type === 'fastener'
        ? Array.isArray(item.holes)
          ? item.holes.map((hole) => hole?.target)
          : []
        : ['linecut', 'polygoncut'].includes(item.type)
          ? item.targets
          : [];
  return Array.isArray(refs) ? refs : [];
}
export function modelImportSelectionIssues(rows, selected) {
  const issues = new Map();
  for (const row of rows.filter((r) => selected.has(r.id))) {
    const missing = modelImportDependencies(row.input).filter((id) => !selected.has(id));
    if (missing.length)
      issues.set(row.id, `Välj även ${missing.join(', ')} eller välj bort bearbetningen.`);
  }
  return issues;
}
function validateEntry(item, version) {
  const physical = ['sweep', 'plate'].includes(item.type);
  const fields = {
    fastener: ['spec', 'length', 'start', 'direction', 'holes', 'assembly'],
    sweep: ['material', 'ifcClass', 'profile', 'start', 'end', 'rotation', 'profileUp'],
    plate: ['material', 'ifcClass', 'frame', 'polygon', 'thickness', 'side'],
    fit: ['references', 'mode', 'endA', 'endB', 'gap'],
    linecut: ['targets', 'frame', 'polygon', 'side'],
    polygoncut: ['targets', 'frame', 'polygon', 'thickness', 'side'],
  };
  if (!fields[item.type] || (version === 1 && !physical))
    fail('Objekttypen stöds inte av filversionen. Fit och skärningar kräver version 2.');
  if (item.type === 'fastener' && version < 3) fail('Skruvar och hål kräver version 3.');
  keys(item, ['id', 'type', 'name', 'source', 'assumptions', ...fields[item.type]]);
  if (!text(item.name, 120)) fail('Ange ett objektnamn (högst 120 tecken).');
  if (physical && !text(item.material, 120)) fail('Ange materialets biblioteksnamn.');
  if (!physical) {
    const refs = modelImportDependencies(item);
    if (
      !Array.isArray(refs) ||
      !refs.length ||
      refs.length > 1000 ||
      !refs.every((id) => text(id, 120) && id !== item.id) ||
      new Set(refs).size !== refs.length
    )
      fail('Bearbetningen behöver unika referenser till andra delar i samma fil.');
    if (item.type === 'fastener' && refs.length > 100)
      fail('Ett förband får ha högst 100 måldelar.');
    if (item.type === 'fit' && refs.length !== 2) fail('Fit behöver två olika sweeps.');
  }
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
  } else if (item.type === 'fastener') {
    if (
      ![item.start, item.direction].every((p) => point(p, 3) && p.every((v) => Math.abs(v) <= 1e7))
    )
      fail('Skruvens start och riktningspunkt behöver tre giltiga koordinater vardera.');
  } else if (item.type !== 'fit') {
    keys(item.frame, ['origin', 'u', 'v']);
    if (!['origin', 'u', 'v'].every((key) => point(item.frame[key], 3)))
      fail('Plåtens arbetsplan behöver origin, u och v med tre tal vardera.');
    if (
      !Array.isArray(item.polygon) ||
      item.polygon.length < (item.type === 'linecut' ? 2 : 3) ||
      item.polygon.length > (item.type === 'linecut' ? 2 : 1000) ||
      !item.polygon.every((v) => point(v, 2))
    )
      fail('Plåtkonturen behöver 3–1 000 punkter med två koordinater vardera.');
    if (item.type !== 'linecut' && !Number.isFinite(item.thickness))
      fail('Ange plåttjocklek i mm.');
    if (
      !(
        item.type === 'linecut' ? ['positive', 'negative'] : ['center', 'positive', 'negative']
      ).includes(item.side)
    )
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
  { profiles, materials, fasteners = [], objects = [], included = null },
  overrides = new Map(),
) {
  const sections = latestImportProfiles(profiles),
    stock = latestMaterials(materials);
  const rows = data.objects.map((input) => {
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
      validateEntry(input, data.version);
      if (isModelImportDuplicate(data, input, objects)) fail('Redan importerad i projektet.');
      if (!['sweep', 'plate'].includes(input.type)) return row;
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
      if (input.type === 'fit' && !row.object.profileOverlap) {
        row.assumptions.push(
          'Fit har ingen tvärgående profilöverlappning. Kontrollera delarnas läge innan import.',
        );
        row.object.modelImport.assumptions = [...row.assumptions];
      }
      const error = validateObject(row.object);
      if (error) fail(error);
    } catch (error) {
      row.object = null;
      row.error = error.message;
    }
    return row;
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const row of rows
    .filter((r) => !r.error && !['sweep', 'plate'].includes(r.input.type))
    .sort((a, b) => Number(a.input.type === 'fastener') - Number(b.input.type === 'fastener'))) {
    try {
      const input = row.input;
      const references = modelImportDependencies(input).map((id) => {
        const target = byId.get(id);
        if (!target?.object || !['sweep', 'plate'].includes(target.input.type))
          fail(`Referensen ${id} saknas eller är inte en giltig del i denna import.`);
        if (input.type === 'fit' && target.object.type !== 'sweep')
          fail('Fit behöver två raka sweeps.');
        return target.object.id;
      });
      const base = {
        id: crypto.randomUUID(),
        name: input.name,
        modelImport: {
          importId: data.importId,
          objectId: input.id,
          source: structuredClone(input.source),
          assumptions: [...row.assumptions],
        },
      };
      row.object =
        input.type === 'fastener'
          ? importFastener(
              input,
              base,
              references,
              fasteners,
              rows
                .filter(
                  (r) =>
                    r.object &&
                    (['sweep', 'plate'].includes(r.input.type) || !included || included.has(r.id)),
                )
                .map((r) => r.object),
              named,
            )
          : input.type === 'fit'
            ? resolveFit(
                {
                  ...base,
                  type: 'component',
                  kind: 'fit',
                  references,
                  mode: input.mode,
                  endA: input.endA,
                  endB: input.endB,
                  gap: input.gap,
                },
                rows.flatMap((r) => (r.object ? [r.object] : [])),
              )
            : {
                ...base,
                type: input.type,
                targets: references,
                frame: structuredClone(input.frame),
                polygon: structuredClone(input.polygon),
                side: input.side,
                ...(input.type === 'polygoncut' ? { thickness: input.thickness } : {}),
              };
      const error = validateObject(row.object);
      if (error) fail(error);
    } catch (error) {
      row.object = null;
      row.error = error.message;
    }
  }
  return rows;
}
/** Recheck duplicate protection and review decisions against the current project before commit. */
export function modelImportObjects(data, rows, selected, approved, objects) {
  const issues = modelImportSelectionIssues(rows, selected);
  if (issues.size) fail(issues.values().next().value);
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
