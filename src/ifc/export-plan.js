import { isPhysical, validateObject } from '../model-object.js';
import { objectType } from '../model/object-types/index.js';
import { isFastener } from '../fasteners/object-type.js';
import { modelAssemblies, assemblySeries } from '../assembly-series.js';
import { assemblyNumberStatus } from '../assembly-numbering.js';
import { partStatus } from '../part-marks.js';
import { validateMaterial } from '../materials.js';
import { objectSeries, validateSeries } from '../numbering/rules.js';
import {
  validateCoordinates,
  defaultCoordinates,
  activeBasePoint,
} from '../coordinates/coordinates.js';
import { validateIFCClass } from './classes.js';
import { exportGeometry } from './geometry.js';
export const defaultIFCOptions = () => ({
  scope: 'all',
  coordinates: 'local',
  geometry: 'auto',
  materials: true,
  properties: true,
  assemblies: true,
  fasteners: false,
});
export function prepareIFCExport(project, options, progress = () => {}) {
  if (
    !['all', 'visible', 'selected'].includes(options.scope) ||
    !['local', 'map'].includes(options.coordinates) ||
    !['auto', 'final'].includes(options.geometry || 'auto')
  )
    throw Error('Ogiltiga IFC-exportval.');
  const coordinates = validateCoordinates(project.coordinates || defaultCoordinates()),
    base = activeBasePoint(coordinates);
  if (options.coordinates === 'map' && !base)
    throw Error('Välj en aktiv baspunkt i Inställningar → Koordinater.');
  const ids = new Set(options.ids || []),
    issues = [],
    parts = [],
    groups = [];
  const issue = (severity, code, id, name, message) =>
    issues.push({ severity, code, id, name, message });
  const all = project.objects.filter(isPhysical),
    selected = all.filter(
      (o) => (options.scope === 'all' || ids.has(o.id)) && (options.fasteners || !isFastener(o)),
    );
  if (!selected.length)
    issue('error', 'empty', null, 'Export', 'Inga fysiska objekt ingår i urvalet.');
  const templates = new WeakMap();
  const memberships = new Map(),
    selectedIds = new Set(selected.map((o) => o.id));
  for (const assembly of modelAssemblies(project)) {
    const included = assembly.memberIds.filter((id) => selectedIds.has(id));
    if (!included.length) continue;
    const valid = assemblyNumberStatus(assembly, project).valid;
    const group = {
      ...assembly,
      series: assemblySeries(assembly, project.objects),
      mark: valid ? assembly.mark : '',
      included,
      valid,
    };
    groups.push(group);
    included.forEach((id) => memberships.set(id, group));
    if (options.properties && !valid)
      issue(
        'warning',
        'assembly-number',
        assembly.id,
        assembly.name,
        'Assemblyn saknar aktuell numrering.',
      );
    if (options.assemblies && included.length !== assembly.memberIds.length)
      issue(
        'warning',
        'partial-assembly',
        assembly.id,
        assembly.name,
        'Endast delar av assemblyn ingår i urvalet.',
      );
  }
  if (options.coordinates === 'map' && !coordinates.crs)
    issue(
      'warning',
      'crs',
      null,
      'Koordinatsystem',
      'Plansystem saknas; kartplacering exporteras utan namngivet CRS.',
    );
  const idsSeen = new Set();
  selected.forEach((object, i) => {
    progress(i, selected.length, object.name);
    try {
      if (!object.id || idsSeen.has(object.id)) throw Error('Objekten behöver unika identiteter.');
      idsSeen.add(object.id);
      const error = validateObject(object);
      if (error) throw Error(error);
      if (options.materials && object.material) validateMaterial(object.material);
      if (
        options.materials &&
        object.colorOverride &&
        !/^#[0-9a-f]{6}$/i.test(object.colorOverride)
      )
        throw Error('Ogiltig objektfärg.');
      const ifcClass = validateIFCClass(object.ifcClass || objectType(object).ifcClass);
      const status = partStatus(object, project.objects, project.parts);
      if (options.properties && !status.valid)
        issue('warning', 'part-number', object.id, object.name, 'Delen saknar aktuell numrering.');
      if (options.materials && !object.material)
        issue('warning', 'material', object.id, object.name, 'Material saknas.');
      const geometry = exportGeometry(object, project.objects, options.geometry, templates);
      if (geometry.kind === 'mesh' && !geometry.closed)
        issue(
          'warning',
          'mesh',
          object.id,
          object.name,
          'Geometrins täthet kunde inte verifieras.',
        );
      parts.push({
        object,
        ifcClass,
        mark: status?.valid ? status.mark : '',
        series: validateSeries(objectSeries(object)),
        assembly: memberships.get(object.id),
        geometry,
      });
    } catch (error) {
      issue('error', 'object', object.id, object.name, error.message);
    }
  });
  return { parts, groups, issues, coordinates, base, project, options };
}
