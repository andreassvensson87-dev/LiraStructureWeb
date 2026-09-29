import test from 'node:test';
import assert from 'node:assert/strict';
import { commonFields, patchFrameProperties } from '../src/frame-properties.js';
test('mixed text and lines only offer color and do not overwrite other properties', () => {
  const text = { type: 'text', text: 'Title', size: 4, font: 'Georgia, serif', color: '#111111' },
    line = { type: 'line', stroke: 0.5, color: '#222222' };
  assert.deepEqual(commonFields([text, line]), ['color']);
  assert.deepEqual(patchFrameProperties(text, { color: '#ff0000' }), { ...text, color: '#ff0000' });
  assert.deepEqual(patchFrameProperties(line, { color: '#ff0000', text: 'bad' }), {
    ...line,
    color: '#ff0000',
  });
});
test('image size preserves per-object proportions and can be unlocked', () => {
  const image = { type: 'image', width: 100, height: 50, angle: 0 };
  assert.equal(patchFrameProperties(image, { imageWidth: '40' }).height, 20);
  assert.equal(patchFrameProperties(image, { imageHeight: '40' }).width, 80);
  assert.equal(patchFrameProperties(image, { imageWidth: '40' }, false).height, 50);
  assert.throws(() => patchFrameProperties(image, { imageWidth: '0' }));
});
