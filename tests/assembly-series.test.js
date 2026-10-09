import test from 'node:test';
import assert from 'node:assert/strict';
import { modelAssemblies, assemblySeries } from '../src/assembly-series.js';
import { createAssembly, updateAssembly } from '../src/project/assemblies.js';
import { planNumbering, applyNumbering } from '../src/numbering/plan.js';
import { assemblyNumberStatus } from '../src/assembly-numbering.js';
import { createProject } from '../src/project/project-state.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
const beam = (id) => ({
  id,
  type: 'sweep',
  name: id,
  prefix: 'B',
  number: id === 'a' ? 1 : 2,
  profile: 'rect',
  width: 100,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [0, 0, 0],
  end: [1000, 0, 0],
});
function state() {
  const value = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan 1', elevation: 0 }] },
  });
  value.objects = [beam('a'), beam('b')];
  return value;
}
test('ungrouped parts are singleton assemblies and preview does not mutate the model', () => {
  const project = state(),
    before = structuredClone(project);
  const assemblies = modelAssemblies(project);
  assert.deepEqual(
    assemblies.map((a) => [a.mainId, a.memberIds]),
    [
      ['a', ['a']],
      ['b', ['b']],
    ],
  );
  const plan = planNumbering(project);
  assert.deepEqual(project, before);
  Object.assign(project, applyNumbering(plan, project));
  assert.equal(project.assemblies.length, 2);
  assert.ok(project.assemblies.every((a) => assemblyNumberStatus(a, project).valid));
  assert.equal(project.assemblies[0].mark, project.assemblies[1].mark);
});
test('explicit assembly series overrides the main part and invalidates numbering', () => {
  const project = state();
  project.objects[0].assemblySeries = { prefix: 'OLD', start: 100 };
  project.assemblies = [createAssembly(project, ['a', 'b'], 'a', 'Group', () => 'group')];
  Object.assign(project, applyNumbering(planNumbering(project), project));
  assert.equal(project.assemblies[0].mark, 'OLD100');
  Object.assign(
    project,
    updateAssembly(project, 'group', {
      ...project.assemblies[0],
      series: { prefix: 'A', start: 3000 },
    }),
  );
  assert.equal(assemblyNumberStatus(project.assemblies[0], project).valid, false);
  Object.assign(project, applyNumbering(planNumbering(project), project));
  assert.equal(project.assemblies[0].mark, 'A3000');
  const saved = parseProjectFile(serializeProject(project));
  assert.deepEqual(assemblySeries(saved.assemblies[0], saved.objects), {
    prefix: 'A',
    start: 3000,
  });
});
test('removing a secondary retains the part and gives it its own assembly', () => {
  const project = state();
  project.assemblies = [createAssembly(project, ['a', 'b'], 'a', 'Group', () => 'group')];
  assert.throws(
    () => updateAssembly(project, 'group', { ...project.assemblies[0], memberIds: ['b'] }),
    /Huvuddelen/,
  );
  Object.assign(
    project,
    updateAssembly(project, 'group', { ...project.assemblies[0], memberIds: ['a'] }),
  );
  assert.equal(project.objects.length, 2);
  assert.deepEqual(
    modelAssemblies(project).map((a) => a.memberIds),
    [['a'], ['b']],
  );
});
