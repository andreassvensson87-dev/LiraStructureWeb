import test from 'node:test';
import assert from 'node:assert/strict';
import { startApplication } from '../src/app/application-startup.js';

test('startup keeps the workspace covered until restoration, UI adoption and first paint finish', async () => {
  let finishCreation, finishPaint;
  const order = [],
    workspace = {};
  const run = startApplication({
    load: async () => ({
      recoverWorkspace: async () => {
        order.push('restore');
        return workspace;
      },
      createApplication: async (value) => {
        assert.equal(value, workspace);
        order.push('create');
        await new Promise((resolve) => {
          finishCreation = resolve;
        });
      },
    }),
    painted: async () => {
      order.push('paint');
      await new Promise((resolve) => {
        finishPaint = resolve;
      });
    },
    view: {
      ready: () => order.push('ready'),
      failed: () => assert.fail('unexpected startup failure'),
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['restore', 'create']);
  finishCreation();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['restore', 'create', 'paint']);
  finishPaint();
  assert.equal(await run, true);
  assert.deepEqual(order, ['restore', 'create', 'paint', 'ready']);
});

test('failed module loading, recovery or UI initialization reports failure without revealing old controls', async () => {
  for (const stage of ['load', 'restore', 'create']) {
    const error = new Error(stage),
      reported = [];
    const fail = (name) => {
      if (stage === name) throw error;
    };
    const result = await startApplication({
      load: async () => {
        fail('load');
        return {
          recoverWorkspace: async () => {
            fail('restore');
            return {};
          },
          createApplication: async () => {
            fail('create');
          },
        };
      },
      painted: () => assert.fail('cannot paint failed startup'),
      view: {
        ready: () => assert.fail('must not reveal failed workspace'),
        failed: (e) => reported.push(e),
      },
    });
    assert.equal(result, false);
    assert.deepEqual(reported, [error]);
  }
});
