import test from 'node:test';
import assert from 'node:assert/strict';
import { nextIdentity, identityError, designation } from '../src/object-identity.js';
test('numbering finds next free number within prefix and supports copy batches', () => {
  const objects = [
    { prefix: 'B', number: 1 },
    { prefix: 'B', number: 3 },
    { prefix: 'P', number: 2 },
  ];
  const a = nextIdentity({}, objects);
  assert.deepEqual(a, { prefix: 'B', number: 2 });
  assert.deepEqual(nextIdentity(a, [...objects, a]), { prefix: 'B', number: 4 });
  assert.deepEqual(nextIdentity({ type: 'plate' }, objects), { prefix: 'P', number: 1 });
  assert.equal(designation(a), 'B-002');
});
test('identity rejects collisions and invalid numbers but permits own identity', () => {
  const a = { id: 'a', prefix: 'B', number: 1 };
  assert.equal(identityError(a, [a]), '');
  assert.ok(identityError({ ...a, id: 'b' }, [a]));
  for (const number of [0, -1, 1.2, NaN]) assert.ok(identityError({ ...a, number }, []));
  assert.ok(identityError({ ...a, prefix: ' ' }, []));
});
