import test from 'node:test';
import assert from 'node:assert/strict';
import { createFastenerExample } from '../src/project/example-model.js';
import { validateObject, geometryForModel } from '../src/model-object.js';
import { identityError } from '../src/object-identity.js';
import { holesForPart, validateFastenerTargets } from '../src/fasteners/relations.js';
import { partStatus } from '../src/part-marks.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';

test('self-contained example has valid numbered objects, linked bores and evaluable geometry', () => {
  const project = createFastenerExample();
  assert.equal(project.objects.length, 17);
  assert.equal(project.objects.filter((o) => o.type === 'fastener').length, 11);
  for (const object of project.objects) {
    assert.equal(validateObject(object), '', object.name);
    assert.equal(identityError(object, project.objects), '', object.name);
    assert.equal(partStatus(object, project.objects, project.parts).valid, true);
    if (object.type === 'fastener') validateFastenerTargets(object, project.objects);
    const geometry = geometryForModel(object, project.objects);
    assert.ok(geometry.attributes.position.count > 0);
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    geometry.dispose();
  }
  const tube = project.objects.find((o) => o.id === 'example-tube');
  assert.deepEqual(
    holesForPart(tube, project.objects).map((h) => h.depth),
    [120, 120, 8],
  );
  const wood = project.objects.find((o) => o.id === 'example-timber');
  assert.deepEqual(
    holesForPart(wood, project.objects).map((h) => h.depth),
    [60, 60, 60, 60],
  );
  assert.equal(project.drawings.length, 0);
});

test('example import can be undone and repeated without sharing mutable model data', () => {
  const old = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'a', items: [{ id: 'a', name: 'Plan', elevation: 0 }] },
  });
  old.info.name = 'Min modell';
  const history = new ProjectHistory();
  history.checkpoint(old);
  const example = createFastenerExample();
  assert.equal(history.undo(example).info.name, 'Min modell');
  assert.equal(history.redo(old).objects.length, 17);
  const next = createFastenerExample();
  example.objects[0].start[0] = 999;
  assert.equal(next.objects[0].start[0], 0);
  assert.equal(JSON.parse(JSON.stringify(next)).objects.length, 17);
});
