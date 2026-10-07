import { isComponent, resolveComponent, updateComponents } from '../components/fit.js';
import { captureProject, PROJECT_SCHEMA_VERSION } from './project-state.js';
import { validateObject, isCut, isPhysical } from '../model-object.js';
import { isFastener } from '../fasteners/object-type.js';
import { validateFastenerTargets } from '../fasteners/relations.js';
import { validateFastenerGroups } from '../fasteners/group-data.js';
import { validateLevels } from '../levels.js';
import { parsePositions } from '../grid-lines.js';
import { validateGridLabels } from '../grid-labels.js';
import { syncAssemblyDrawingIdentity } from './assemblies.js';
import { validateProjectReports } from '../report-record.js';

export const PROJECT_FILE_LIMIT = 100 * 1024 * 1024;
const record = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const fail = (message) => {
  throw new Error(message);
};
const identity = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
function finiteData(value) {
  if (typeof value === 'number' && !Number.isFinite(value))
    fail('Projektfilen innehåller ogiltiga tal.');
  if (value && typeof value === 'object') for (const item of Object.values(value)) finiteData(item);
}
/** Validate a detached file before replacing any live project state. Geometry stays a derived cache. */
export function validateProjectFile(project) {
  if (!record(project) || project.schemaVersion !== PROJECT_SCHEMA_VERSION)
    fail('Projektversionen stöds inte av det här programmet.');
  finiteData(project);
  project.reports = validateProjectReports(project.reports);
  if (!Array.isArray(project.objects) || project.objects.length > 100000)
    fail('Ogiltig objektlista.');
  const objects = new Map();
  for (const object of project.objects) {
    if (!record(object) || !identity(object.id) || objects.has(object.id))
      fail('Objekten behöver unika identiteter.');
    const error = validateObject(object);
    if (error) fail(`${object.name || object.id}: ${error}`);
    objects.set(object.id, object);
  }
  for (const object of project.objects) {
    if (isComponent(object)) resolveComponent(object, project.objects);
    if (
      object.generatedBy &&
      !['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(
        objects.get(object.generatedBy)?.kind,
      )
    )
      fail('En genererad del saknar sin koppling.');
  }
  project.objects = updateComponents([], project.objects);
  objects.clear();
  for (const object of project.objects) {
    if (!identity(object.id) || objects.has(object.id)) fail('Objekten behöver unika identiteter.');
    objects.set(object.id, object);
  }
  validateFastenerGroups(project.objects);
  for (const object of project.objects) {
    if (isFastener(object)) {
      const targets = object.holes.map((h) => objects.get(h.targetId));
      validateFastenerTargets(object, targets);
      if (object.anchorId && !targets.some((s) => s?.id === object.anchorId))
        fail('Skruvens referensdel saknas i förbandet.');
    }
    if (
      isCut(object) &&
      object.targets.some((id) => !isPhysical(objects.get(id)) || isFastener(objects.get(id)))
    )
      fail('En skärning saknar ett giltigt målobjekt.');
  }
  if (
    !record(project.grid) ||
    !['x', 'y'].every(
      (k) => Array.isArray(project.grid[k]) && project.grid[k].every(Number.isFinite),
    )
  )
    fail('Ogiltiga stomlinjer.');
  for (const axis of ['x', 'y']) parsePositions(project.grid[axis].join(' '));
  validateGridLabels(project.grid);
  if (!record(project.levels) || !Array.isArray(project.levels.items)) fail('Ogiltiga nivåer.');
  validateLevels(project.levels);
  if (
    !record(project.info) ||
    !['name', 'number', 'client'].every((k) => typeof project.info[k] === 'string')
  )
    fail('Ogiltiga projektuppgifter.');
  if (
    !record(project.parts) ||
    !Array.isArray(project.parts.registry) ||
    !record(project.parts.assignments)
  )
    fail('Ogiltig detaljnumrering.');
  for (const item of [...project.parts.registry, ...Object.values(project.parts.assignments)])
    if (!record(item) || typeof item.key !== 'string' || typeof item.mark !== 'string')
      fail('Ogiltig detaljnumrering.');
  if (!Array.isArray(project.drawings) || project.drawings.length > 10000)
    fail('Ogiltig ritningslista.');
  project.assemblies ??= [];
  if (!Array.isArray(project.assemblies) || project.assemblies.length > 10000)
    fail('Ogiltig assemblylista.');
  const assemblyIds = new Set(),
    assemblyMarks = new Map(),
    members = new Set();
  for (const assembly of project.assemblies) {
    if (
      !record(assembly) ||
      !identity(assembly.id) ||
      assemblyIds.has(assembly.id) ||
      !identity(assembly.mark) ||
      (assembly.typeKey !== undefined &&
        (typeof assembly.typeKey !== 'string' || !assembly.typeKey)) ||
      (assemblyMarks.has(assembly.mark) &&
        (!assembly.typeKey || assemblyMarks.get(assembly.mark) !== assembly.typeKey)) ||
      typeof assembly.name !== 'string' ||
      !identity(assembly.mainId) ||
      !Array.isArray(assembly.memberIds) ||
      assembly.memberIds.length < 2 ||
      assembly.memberIds.length > 100000 ||
      !assembly.memberIds.every(identity) ||
      !assembly.memberIds.includes(assembly.mainId) ||
      new Set(assembly.memberIds).size !== assembly.memberIds.length ||
      assembly.memberIds.some(
        (id) => members.has(id) || (objects.has(id) && !isPhysical(objects.get(id))),
      )
    )
      fail('Ogiltig assembly eller överlappande delar.');
    assemblyIds.add(assembly.id);
    assemblyMarks.set(assembly.mark, assembly.typeKey);
    assembly.memberIds.forEach((id) => members.add(id));
  }
  project.assemblyNumbering ??= { registry: [] };
  if (!record(project.assemblyNumbering) || !Array.isArray(project.assemblyNumbering.registry))
    fail('Ogiltig assemblynumrering.');
  const typeKeys = new Set(),
    typeMarks = new Set();
  for (const item of project.assemblyNumbering.registry) {
    if (
      !record(item) ||
      typeof item.key !== 'string' ||
      !item.key ||
      !identity(item.mark) ||
      typeof item.name !== 'string' ||
      typeKeys.has(item.key) ||
      typeMarks.has(item.mark)
    )
      fail('Ogiltig assemblynumrering.');
    typeKeys.add(item.key);
    typeMarks.add(item.mark);
  }
  for (const assembly of project.assemblies)
    if (
      assembly.typeKey &&
      !project.assemblyNumbering.registry.some(
        (r) => r.key === assembly.typeKey && r.mark === assembly.mark,
      )
    )
      fail('Assemblyn saknar giltig typnumrering.');
  const drawingIds = new Set();
  const drawnAssemblies = new Set();
  for (const drawing of project.drawings) {
    if (
      !record(drawing) ||
      !identity(drawing.id) ||
      drawingIds.has(drawing.id) ||
      !['SP', 'GA', 'AS'].includes(drawing.type) ||
      typeof drawing.number !== 'string'
    )
      fail('Ogiltig ritning eller duplicerad ritningsidentitet.');
    drawingIds.add(drawing.id);
    if (drawing.type === 'AS' && !assemblyIds.has(drawing.assemblyId))
      fail('Assemblyritningen saknar en assembly.');
    if (drawing.type === 'AS') {
      const assembly = project.assemblies.find((a) => a.id === drawing.assemblyId);
      const type = drawing.assemblyKey || assembly.id;
      if (
        drawing.sourceId !== assembly.mainId ||
        drawnAssemblies.has(type) ||
        (drawing.assemblyKey !== undefined && drawing.assemblyKey !== assembly.typeKey)
      )
        fail('Ogiltig eller duplicerad assemblyritning.');
      drawnAssemblies.add(type);
    }
  }
  if (
    !record(project.snap) ||
    ![
      'endpoints',
      'corners',
      'quadrants',
      'midpoints',
      'perpendicular',
      'gridLines',
      'gridIntersections',
      'gridStepEnabled',
      'axes',
    ].every((k) => typeof project.snap[k] === 'boolean') ||
    !Number.isFinite(project.snap.gridStep) ||
    project.snap.gridStep <= 0 ||
    project.snap.gridStep > 100000 ||
    ![project.snap.polar, project.snap.rotation].every((v) =>
      [0, 5, 15, 30, 45, 90].includes(Number(v)),
    )
  )
    fail('Ogiltiga snapinställningar.');
  project.drawings = syncAssemblyDrawingIdentity(project);
  return project;
}
export function serializeProject(project) {
  const snapshot = captureProject(project);
  validateProjectFile(snapshot);
  return JSON.stringify({ format: 'LiraStructure', fileVersion: 1, project: snapshot });
}
export function parseProjectFile(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > PROJECT_FILE_LIMIT)
    fail('Projektfilen är för stor (högst 100 MB).');
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    fail('Projektfilen kunde inte läsas. Välj en .lira.json-fil.');
  }
  if (file?.format !== 'LiraStructure' || file.fileVersion !== 1)
    fail('Filen är inte en projektfil från LiraStructure med en version som stöds.');
  return validateProjectFile(file.project);
}
export function projectFilename(project) {
  const name = project.info.name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .slice(0, 100)
    .replace(/[. ]+$/g, '');
  return `${name || 'LiraStructure'}.lira.json`;
}
