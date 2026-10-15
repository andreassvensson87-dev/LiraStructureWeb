import { localToMap } from '../coordinates/coordinates.js';
import { materialProfile } from '../report-material-list.js';
import { StepWriter, stepString as str, stepNumber as num, stepList as list } from './step.js';
import { ifcGuid } from './identity.js';
import { writeRepresentation, writeMappedRepresentation } from './representation.js';
import { property, propertySet, colorStyle, material } from './properties.js';
/** Read-only serialization of a checked plan. No project edits or new object identities. */
export async function writeIFC(
  plan,
  { filename = 'Modell.ifc', date = new Date().toISOString() } = {},
  progress = () => {},
) {
  if (plan.issues.some((i) => i.severity === 'error'))
    throw Error('Rätta exportens fel innan filen skapas.');
  const { project, options } = plan,
    w = new StepWriter();
  if (!project.id)
    throw Error('Projektet saknar en stabil identitet. Spara och öppna projektet igen.');
  const guid = (key) => ifcGuid(`LiraStructure:${project.id}:${key}`);
  const rootPlacement = w.add('IFCLOCALPLACEMENT', '$', w.axis());
  const context = w.add(
    'IFCGEOMETRICREPRESENTATIONCONTEXT',
    '$',
    str('Model'),
    '3',
    '0.00001',
    w.axis(),
    '$',
  );
  const mm = w.add('IFCSIUNIT', '*', '.LENGTHUNIT.', '.MILLI.', '.METRE.');
  const kg = w.add('IFCSIUNIT', '*', '.MASSUNIT.', '.KILO.', '.GRAM.');
  const units = w.add('IFCUNITASSIGNMENT', list([mm, kg]));
  const projectRef = w.add(
    'IFCPROJECT',
    str(await guid('project')),
    '$',
    str(project.info.name || 'LiraStructure'),
    '$',
    '$',
    str(project.info.number || ''),
    '$',
    list([context]),
    units,
  );
  const site = w.add(
    'IFCSITE',
    str(await guid('site')),
    '$',
    str('Projektområde'),
    '$',
    '$',
    rootPlacement,
    '$',
    '$',
    '.ELEMENT.',
    '$',
    '$',
    '$',
    '$',
    '$',
  );
  const building = w.add(
    'IFCBUILDING',
    str(await guid('building')),
    '$',
    str(project.info.name || 'Byggnad'),
    '$',
    '$',
    rootPlacement,
    '$',
    '$',
    '.ELEMENT.',
    '$',
    '$',
    '$',
  );
  async function aggregate(key, parent, children) {
    if (children.length)
      w.add(
        'IFCRELAGGREGATES',
        str(await guid('aggregate:' + key)),
        '$',
        '$',
        '$',
        parent,
        list(children),
      );
  }
  await aggregate('project', projectRef, [site]);
  await aggregate('site', site, [building]);
  if (options.coordinates === 'map') {
    const base = plan.base,
      origin = localToMap([0, 0, 0], base),
      a = (base.rotation * Math.PI) / 180;
    const metres = w.add('IFCSIUNIT', '*', '.LENGTHUNIT.', '$', '.METRE.');
    const crs = w.add(
      'IFCPROJECTEDCRS',
      str(plan.coordinates.crs || 'Ej angivet'),
      '$',
      '$',
      plan.coordinates.verticalDatum ? str(plan.coordinates.verticalDatum) : '$',
      '$',
      '$',
      metres,
    );
    w.add(
      'IFCMAPCONVERSION',
      context,
      crs,
      ...origin.map(num),
      num(Math.cos(a)),
      num(Math.sin(a)),
      '0.001',
    );
  }
  const refs = new Map(),
    materials = new Map(),
    colors = new Map(),
    templates = new WeakMap();
  for (let i = 0; i < plan.parts.length; i++) {
    const part = plan.parts[i],
      { object, geometry, ifcClass } = part;
    progress(i, plan.parts.length, object.name);
    const placement = w.add(
      'IFCLOCALPLACEMENT',
      rootPlacement,
      w.axis(geometry.origin, geometry.z, geometry.x),
    );
    const representation = geometry.reuse
      ? writeMappedRepresentation(w, context, geometry, materialProfile(object), templates)
      : writeRepresentation(w, context, geometry, materialProfile(object));
    const args = [
      str(await guid('part:' + object.id)),
      '$',
      str(object.name || part.mark || object.id),
      '$',
      '$',
      placement,
      representation.definition,
      part.mark ? str(part.mark) : '$',
    ];
    if (ifcClass === 'IfcMechanicalFastener')
      args.push(
        object.spec?.diameter ? num(object.spec.diameter) : '$',
        object.spec?.length ? num(object.spec.length) : '$',
        object.spec?.kind === 'bolt'
          ? '.BOLT.'
          : object.spec?.kind === 'rod'
            ? '.NOTDEFINED.'
            : '.SCREW.',
      );
    else args.push('.NOTDEFINED.');
    const ref = w.add(ifcClass.toUpperCase(), ...args);
    refs.set(object.id, ref);
    if (options.materials) {
      colorStyle(w, colors, object, representation.item);
      await material(w, materials, guid, object, ref);
    }
    if (options.properties) {
      const group = part.assembly;
      await propertySet(w, guid, ref, 'Part:' + object.id, [
        property(w, 'SourceId', object.id),
        property(w, 'PartMark', part.mark),
        property(w, 'PartPrefix', part.series.prefix),
        property(w, 'PartStartNumber', part.series.start, 'IfcInteger'),
        property(w, 'NumberingCurrent', !!part.mark, 'IfcBoolean'),
        property(w, 'Profile', materialProfile(object)),
        property(w, 'AssemblyMark', group?.mark),
        property(w, 'AssemblyPrefix', group?.series.prefix),
        property(w, 'AssemblyStartNumber', group?.series.start, 'IfcInteger'),
        property(w, 'MainPart', group?.mainId === object.id, 'IfcBoolean'),
        property(w, 'BlockInstance', object.parametricBlock?.instanceId),
        property(w, 'ConnectionId', object.generatedBy),
      ]);
    }
  }
  const contained = [];
  if (options.assemblies) {
    for (const group of plan.groups) {
      const ref = w.add(
        'IFCELEMENTASSEMBLY',
        str(await guid('assembly:' + group.id)),
        '$',
        str(group.mark || group.name),
        '$',
        '$',
        rootPlacement,
        '$',
        group.mark ? str(group.mark) : '$',
        '.NOTDEFINED.',
        '.NOTDEFINED.',
      );
      await aggregate(
        'assembly:' + group.id,
        ref,
        group.included.map((id) => refs.get(id)),
      );
      contained.push(ref);
      if (options.properties)
        await propertySet(w, guid, ref, 'Assembly:' + group.id, [
          property(w, 'AssemblyMark', group.mark),
          property(w, 'AssemblyPrefix', group.series.prefix),
          property(w, 'AssemblyStartNumber', group.series.start, 'IfcInteger'),
          property(w, 'NumberingCurrent', group.valid, 'IfcBoolean'),
          property(w, 'MainPartId', group.mainId),
          property(w, 'Partial', group.included.length !== group.memberIds.length, 'IfcBoolean'),
        ]);
    }
  } else contained.push(...refs.values());
  w.add(
    'IFCRELCONTAINEDINSPATIALSTRUCTURE',
    str(await guid('containment')),
    '$',
    '$',
    '$',
    list(contained),
    building,
  );
  return w.finish(filename, date);
}
