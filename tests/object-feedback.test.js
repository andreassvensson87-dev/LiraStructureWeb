import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ObjectFeedback,
  objectFeedbackStyle,
  FEEDBACK_COLORS,
} from '../src/model/object-feedback.js';
const a = {
  id: 'a',
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 100,
  thickness: 0,
  rotation: 0,
  start: [0, 0, 0],
  end: [1000, 0, 0],
};
const b = { ...a, id: 'b', start: [0, 100, 0], end: [1000, 100, 0] };
test('hover gives feedback without replacing reference or selected colors', () => {
  assert.equal(objectFeedbackStyle({ hovered: true }).color, FEEDBACK_COLORS.hover);
  assert.equal(
    objectFeedbackStyle({ hovered: true, selected: true }).color,
    FEEDBACK_COLORS.selected,
  );
  assert.equal(
    objectFeedbackStyle({ hovered: true, referenceIndex: 0, candidateIndex: 1 }).color,
    FEEDBACK_COLORS.first,
  );
  assert.equal(
    objectFeedbackStyle({ hovered: true, candidateIndex: 1 }).color,
    FEEDBACK_COLORS.second,
  );
  assert.ok(
    objectFeedbackStyle({ hovered: true, referenceIndex: 0 }).fillOpacity >
      objectFeedbackStyle({ referenceIndex: 0 }).fillOpacity,
  );
});
test('moving away clears hover while retaining picked references and their geometry', () => {
  const before = structuredClone([a, b]);
  const feedback = new ObjectFeedback(new THREE.Scene());
  feedback.setModel([a, b]);
  feedback.setReferences(['a']);
  feedback.setHover(['b'], 'canvas', 1);
  feedback.refresh();
  assert.equal(feedback.entries.size, 2);
  const first = feedback.entries.get('a').mesh.geometry;
  feedback.refresh();
  assert.equal(feedback.entries.get('a').mesh.geometry, first);
  feedback.setHover([], 'canvas');
  feedback.refresh();
  assert.equal(feedback.entries.size, 1);
  assert.equal(feedback.entries.get('a').mesh.geometry, first);
  assert.deepEqual([a, b], before);
  feedback.dispose();
  assert.equal(feedback.group.parent, null);
});
test('inspector focus takes precedence and restores neutral canvas hover on exit', () => {
  const feedback = new ObjectFeedback(new THREE.Scene());
  feedback.setModel([a, b]);
  feedback.setReferences(['a', 'b']);
  feedback.setHover(['a'], 'inspector');
  feedback.setHover(['b'], 'canvas');
  feedback.refresh();
  assert.equal(feedback.entries.get('a').mesh.material.opacity, 0.28);
  assert.equal(feedback.entries.get('b').mesh.material.opacity, 0.14);
  feedback.setHover([], 'inspector');
  feedback.refresh();
  assert.equal(feedback.entries.get('b').mesh.material.opacity, 0.28);
  feedback.clearHover();
  feedback.setReferences([]);
  feedback.refresh();
  assert.equal(feedback.entries.size, 0);
  feedback.dispose();
});
test('feedback follows changed preview geometry and never displays a hidden object', () => {
  let visible = true;
  const feedback = new ObjectFeedback(new THREE.Scene(), { visible: () => visible });
  feedback.setReferences(['a']);
  feedback.setModel([a]);
  feedback.refresh();
  const original = feedback.entries.get('a').mesh.geometry;
  feedback.setModel([{ ...a, width: 200 }]);
  feedback.refresh();
  const updated = feedback.entries.get('a').mesh.geometry;
  assert.notEqual(original, updated);
  updated.computeBoundingBox();
  assert.equal(updated.boundingBox.max.y - updated.boundingBox.min.y, 200);
  visible = false;
  feedback.refresh();
  assert.equal(feedback.entries.size, 0);
  feedback.dispose();
});
