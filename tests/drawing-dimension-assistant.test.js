import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assistantDimensions,
  DrawingDimensionAssistant,
} from '../src/drawing-dimension-assistant.js';
import { referenceCandidates } from '../src/annotation-references.js';

const candidates = [
  ...referenceCandidates(
    [
      [0, 0],
      [100, 0],
      [100, 80],
      [0, 80],
    ],
    'a',
  ),
  ...referenceCandidates(
    [
      [40, 20],
      [60, 20],
      [60, 60],
      [40, 60],
    ],
    'b',
  ),
  ...[
    [20, 40],
    [50, 40],
    [80, 40],
  ].map((p, i) =>
    Object.assign(p, { reference: { kind: 'bore', source: 'a', featureId: String(i) } }),
  ),
  ...referenceCandidates(
    [
      [2000, 0],
      [2500, 80],
    ],
    'unselected',
  ),
];
const propose = (extra = {}) =>
  assistantDimensions({
    candidates,
    sources: ['a', 'b'],
    type: 'main',
    direction: 'auto',
    line: [120, 100],
    view: 'front',
    ...extra,
  });

test('placement click selects each side or either adjacent pair outside a corner', () => {
  for (const [line, expected] of [
    [[-20, 40], ['vertical']],
    [[120, 40], ['vertical']],
    [[50, 100], ['horizontal']],
    [[50, -20], ['horizontal']],
    [
      [-20, 100],
      ['horizontal', 'vertical'],
    ],
    [
      [120, 100],
      ['horizontal', 'vertical'],
    ],
    [
      [-20, -20],
      ['horizontal', 'vertical'],
    ],
    [
      [120, -20],
      ['horizontal', 'vertical'],
    ],
  ]) {
    const result = propose({ line });
    assert.deepEqual(
      result.map((p) => p.kind),
      expected,
    );
    for (const p of result) assert.deepEqual(p.line, line);
  }
});

test('main dimensions include selected extents only and a corner placement proposes both axes', () => {
  const proposals = propose();
  assert.deepEqual(
    proposals.map((p) => p.kind),
    ['horizontal', 'vertical'],
  );
  assert.deepEqual(
    proposals[0].points.map((p) => p[0]),
    [0, 100],
  );
  assert.deepEqual(
    proposals[1].points.map((p) => p[1]),
    [0, 80],
  );
  assert.equal(proposals[0].view, 'front');
  assert.equal(proposals[0].references[0].source, 'a');
  assert.throws(() => propose({ line: [50, 40] }), /utanför/);
});
test('part dimensions collect edges per selected part and deduplicate projected stations', () => {
  const [chain] = propose({ type: 'parts', direction: 'horizontal' });
  assert.deepEqual(
    chain.points.map((p) => p[0]),
    [0, 40, 60, 100],
  );
  assert.equal(chain.references[1].source, 'b');
});
test('hole dimensions use stable bore references and reject a direction with no spacing', () => {
  const [chain] = propose({ type: 'holes', direction: 'horizontal' });
  assert.deepEqual(
    chain.points.map((p) => p[0]),
    [20, 50, 80],
  );
  assert.equal(chain.references[1].featureId, '1');
  assert.throws(() => propose({ type: 'holes', direction: 'vertical' }), /hålcentrum/);
});
test('chains are committed and linked together with one undo checkpoint, keeping the tool active', () => {
  const assistant = Object.create(DrawingDimensionAssistant.prototype);
  let checkpoints = 0,
    refreshed = 0;
  assistant.editor = {
    items: [],
    checkpoint() {
      checkpoints++;
    },
    ui() {
      refreshed++;
    },
  };
  assistant.proposals = propose();
  const proposal = assistant.proposals[0];
  assistant.commit();
  assert.equal(checkpoints, 1);
  assert.equal(refreshed, 1);
  assert.equal(assistant.phase, 'select');
  assert.deepEqual(assistant.sources, []);
  assert.equal(assistant.editor.items.length, 2);
  assert.ok(assistant.editor.items[0].dimensionLinkId);
  assert.equal(
    assistant.editor.items[0].dimensionLinkId,
    assistant.editor.items[1].dimensionLinkId,
  );
  assert.equal('excluded' in assistant.editor.items[0], false);
  assert.notEqual(assistant.editor.items[0], proposal);
});

test('an outside placement click creates linked chains immediately without a confirmation phase', () => {
  const assistant = Object.create(DrawingDimensionAssistant.prototype);
  let point = [50, 40],
    picked = 'a',
    checkpoints = 0,
    message;
  assistant.editor = {
    items: [],
    location: () => ({ point, view: 'front' }),
    adapter: { pick: () => picked, candidates: () => candidates, redraw() {} },
    checkpoint() {
      checkpoints++;
    },
    ui() {},
  };
  Object.assign(assistant, {
    type: 'main',
    direction: 'auto',
    phase: 'select',
    sources: [],
    proposals: [],
    view: null,
    ui(text) {
      message = text;
    },
  });
  assistant.down({});
  assert.deepEqual(assistant.sources, ['a']);
  assert.equal(checkpoints, 0);
  picked = null;
  assistant.down({});
  assert.match(message, /utanför/);
  assert.equal(assistant.editor.items.length, 0);
  assert.deepEqual(assistant.sources, ['a']);
  point = [120, 100];
  // Single-part adapters return the part even for clicks outside its outline.
  picked = 'a';
  assistant.down({});
  assert.equal(checkpoints, 1);
  assert.equal(assistant.editor.items.length, 2);
  assert.equal(
    assistant.editor.items[0].dimensionLinkId,
    assistant.editor.items[1].dimensionLinkId,
  );
  assert.equal(assistant.phase, 'select');
});
