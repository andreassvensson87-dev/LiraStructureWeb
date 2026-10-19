import test from 'node:test';
import assert from 'node:assert/strict';
import { closeDrawingEditors } from '../src/app/drawing-navigation.js';

test('switching drawings waits for save and resource release before reusing an editor', async () => {
  const events = [];
  const dialog = new EventTarget();
  dialog.open = true;
  dialog.close = () => {
    dialog.open = false;
    queueMicrotask(() => dialog.dispatchEvent(new Event('close')));
  };
  dialog.addEventListener('close', () => events.push('save', 'release'));
  const closed = { dialog: { open: false, close: () => assert.fail('Closed editor reopened') } };
  const pending = closeDrawingEditors([{ dialog }, closed]).then(() => events.push('open next'));
  assert.deepEqual(events, []);
  await pending;
  assert.deepEqual(events, ['save', 'release', 'open next']);
});
