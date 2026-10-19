import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingSelectionScope } from '../src/drawing-selection-scope.js';
import { translateDrawingSelection } from '../src/drawing-mixed-transform.js';

function fixture() {
  const annotations = [
    {
      id: 'line',
      type: 'shape',
      shape: 'line',
      view: 'v',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'dim',
      type: 'dimension',
      kind: 'horizontal',
      view: 'v',
      points: [
        [0, 0],
        [10, 0],
      ],
      line: [0, 20],
      references: [null, null],
    },
    { id: 'text', type: 'richtext', view: 'paper', points: [[20, 30]], width: 40 },
  ];
  const views = [
    {
      id: 'v',
      name: 'Vy',
      position: [10, 10],
      size: [100, 80],
      scale: 10,
      camera: { center: [0, 0] },
    },
  ];
  const scope = new DrawingSelectionScope();
  const ids = { annotationIds: annotations.map((item) => item.id), viewIds: ['v'] };
  scope.capture(ids);
  return { annotations, views, scope, ids };
}

test('drawing scope uses the shared type grouping and restores every identity through Alla', () => {
  const { annotations, views, scope, ids } = fixture();
  scope.active(annotations, views);
  assert.deepEqual(
    scope.scope.groups(scope.objects(annotations, views)).map((g) => g.label),
    ['Linjer', 'Mått', 'Text', 'Vyer'],
  );
  for (const [type, expected] of [
    ['dimension', 'dim'],
    ['richtext', 'text'],
    ['line', 'line'],
  ]) {
    assert.deepEqual(scope.choose(type, annotations, views), {
      annotationIds: [expected],
      viewIds: [],
    });
    assert.deepEqual(scope.choose('', annotations, views), ids);
  }
  assert.deepEqual(scope.choose('view', annotations, views), { annotationIds: [], viewIds: ['v'] });
  assert.deepEqual(scope.choose('', annotations, views), ids);
});

test('scoped move changes only dimensions; Alla restores original membership using current objects', () => {
  const { annotations, views, scope, ids } = fixture();
  const chosen = scope.choose('dimension', annotations, views);
  const moved = translateDrawingSelection(
    views,
    annotations,
    chosen.viewIds,
    chosen.annotationIds,
    [5, 3],
  );
  assert.deepEqual(moved.annotations[0], annotations[0]);
  assert.deepEqual(moved.annotations[2], annotations[2]);
  assert.deepEqual(moved.views, views);
  assert.deepEqual(moved.annotations[1].points[0], [50, -30]);
  assert.deepEqual(scope.choose('', moved.annotations, moved.views), ids);
  assert.equal(scope.objects(moved.annotations, moved.views)[1].object, moved.annotations[1]);
});

test('scope snapshot restores the complete mixed selection and new selection forgets old identities', () => {
  const { annotations, views, scope, ids } = fixture();
  scope.choose('dimension', annotations, views);
  const before = scope.snapshot();
  scope.capture({ annotationIds: ['text'], viewIds: [] });
  scope.restore(before, annotations, views);
  assert.deepEqual(scope.active(annotations, views), { annotationIds: ['dim'], viewIds: [] });
  assert.deepEqual(scope.choose('', annotations, views), ids);
  const remaining = annotations.filter((item) => item.id !== 'dim');
  scope.choose('dimension', annotations, views);
  assert.deepEqual(scope.choose('', remaining, views), {
    annotationIds: ['line', 'text'],
    viewIds: ['v'],
  });
  scope.clear();
  assert.deepEqual(scope.active(annotations, views), { annotationIds: [], viewIds: [] });
});
