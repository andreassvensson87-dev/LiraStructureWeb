import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attributeChoiceParts,
  attributeDrawingValue,
  attributeValue,
  drawingAttributeContext,
  drawingAttributes,
} from '../src/drawing-attributes.js';
import { appendDrawingLayout } from '../src/drawing-layout.js';

test('one saved choice provides the full drawing text and its independent read-only schedule code', () => {
  const record = {
    type: 'GA',
    issueStatus: 'GRANSKNING | R-',
    documentType: 'BYGGHANDLING | BH',
    category: 'SEKTION, SEKTIONSVY, SNITT, SNITTVY',
  };
  const context = drawingAttributeContext(record);
  assert.equal(attributeValue('drawing.issueStatus', context), 'GRANSKNING | R-');
  assert.equal(attributeDrawingValue('drawing.issueStatus', context), 'GRANSKNING');
  assert.equal(attributeDrawingValue('drawing.documentType', context), 'BYGGHANDLING');
  assert.equal(attributeValue('drawing.issueStatusCode', context), 'R-');
  assert.equal(attributeValue('drawing.documentTypeCode', context), 'BH');
  assert.equal(attributeDrawingValue('drawing.category', context), record.category);
  for (const key of ['drawing.issueStatusCode', 'drawing.documentTypeCode'])
    assert.equal(drawingAttributes().find((a) => a.key === key).editable, false);
});
test('plain, empty and multi choices work, while ordinary text keeps literal pipes', () => {
  assert.deepEqual(attributeChoiceParts(' FÖR INFORMATION | FI '), {
    text: 'FÖR INFORMATION',
    code: 'FI',
  });
  const context = drawingAttributeContext({
    type: 'SP',
    issueStatus: 'Tidigare status',
    documentType: ['BYGGHANDLING | BH', 'RELATIONSHANDLING | RH'],
    name: 'Balk | detalj',
  });
  assert.equal(attributeDrawingValue('drawing.issueStatus', context), 'Tidigare status');
  assert.equal(attributeValue('drawing.issueStatusCode', context), '');
  assert.equal(
    attributeDrawingValue('drawing.documentType', context),
    'BYGGHANDLING, RELATIONSHANDLING',
  );
  assert.equal(attributeValue('drawing.documentTypeCode', context), 'BH, RH');
  assert.equal(attributeDrawingValue('drawing.name', context), 'Balk | detalj');
  assert.equal(attributeDrawingValue('drawing.issueStatus', drawingAttributeContext({})), '');
});
test('the drawing SVG used by PDF export renders text without abbreviations', () => {
  const previousDocument = globalThis.document;
  const node = () => ({
    attrs: {},
    children: [],
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    append(e) {
      this.children.push(e);
    },
  });
  globalThis.document = { createElementNS: node };
  try {
    const svg = node();
    appendDrawingLayout(
      svg,
      {
        id: 'layout',
        width: 420,
        height: 297,
        entities: [{ id: 'title', blockId: 'title', point: [10, 10] }],
      },
      drawingAttributeContext({ issueStatus: 'GODKÄND | G1', documentType: 'SYSTEMHANDLING | SH' }),
      [
        {
          id: 'title',
          origin: [0, 0],
          entities: ['drawing.issueStatus', 'drawing.documentType'].map((key) => ({
            type: 'attribute',
            key,
            point: [0, 0],
            size: 3.5,
            align: 'start',
          })),
        },
      ],
    );
    assert.deepEqual(
      svg.children[0].children.map((g) => g.children[0].textContent),
      ['GODKÄND', 'SYSTEMHANDLING'],
    );
  } finally {
    globalThis.document = previousDocument;
  }
});
