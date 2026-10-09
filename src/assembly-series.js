import { objectSeries, validateSeries } from './numbering/rules.js';
import { isPhysical } from './model-object.js';

export function assemblySeries(assembly, objects) {
  return validateSeries(
    assembly.series ||
      objectSeries(
        objects.find((o) => o.id === assembly.mainId),
        true,
      ),
  );
}
/** Ungrouped parts are assemblies with themselves as the main part. */
export function modelAssemblies(state) {
  const assemblies = [...(state.assemblies || [])];
  const members = new Set(assemblies.flatMap((a) => a.memberIds));
  const usedIds = new Set(assemblies.map((a) => a.id));
  const usedMarks = new Set(
    [...assemblies, ...(state.assemblyNumbering?.registry || [])].map((a) => a.mark),
  );
  let number = 1;
  for (const object of state.objects.filter(isPhysical)) {
    if (members.has(object.id)) continue;
    while (usedMarks.has(`A-${String(number).padStart(3, '0')}`)) number++;
    const mark = `A-${String(number++).padStart(3, '0')}`;
    let id = `single-assembly:${object.id}`;
    while (usedIds.has(id)) id += ':';
    usedIds.add(id);
    usedMarks.add(mark);
    assemblies.push({
      id,
      mark,
      name: object.name || mark,
      mainId: object.id,
      memberIds: [object.id],
    });
  }
  return assemblies;
}
