import test from 'node:test';
import assert from 'node:assert/strict';
import { newDrawingText, layoutDrawingText } from '../src/drawing-rich-text.js';
import { readRichText } from '../src/drawing-rich-text-editor.js';
const text = (value) => ({ nodeType: 3, textContent: value });
const node = (name, children, style = {}) => ({
  nodeName: name,
  nodeType: 1,
  childNodes: children,
  children: children.filter((c) => c.nodeType === 1),
  style,
});

test('nested browser list markup retains separate items, bold spans and manual line breaks without storing HTML', () => {
  const paragraphs = readRichText(
    node('DIV', [
      node('DIV', [node('STRONG', [text('Heading')])]),
      node('DIV', [
        node('OL', [
          node('LI', [text('First')]),
          node('LI', [text('Second'), node('BR', []), node('EM', [text('continued')])]),
        ]),
      ]),
    ]),
  );
  assert.equal(paragraphs.length, 3);
  assert.equal(paragraphs[0].runs[0].bold, true);
  assert.equal(paragraphs[1].list, 'number');
  assert.equal(paragraphs[2].list, 'number');
  assert.equal(paragraphs[2].runs.map((r) => r.text).join(''), 'Second\ncontinued');
  assert.equal(paragraphs[2].runs.at(-1).italic, true);
  assert.deepEqual(JSON.parse(JSON.stringify(paragraphs)), paragraphs);
});

test('narrowing a text block wraps styled text and preserves paper height, position and list numbering', () => {
  const item = newDrawingText([20, 30], 30);
  item.paragraphs = [
    { runs: [{ text: 'abcdefghij', bold: true }], align: 'left', list: 'number' },
    { runs: [{ text: 'klmnop', italic: true }], align: 'right', list: 'number' },
  ];
  const measure = (value) => value.length * 2;
  const wide = layoutDrawingText(item, measure);
  item.width = 12;
  const narrow = layoutDrawingText(item, measure);
  assert.ok(narrow.height > wide.height);
  assert.equal(item.textSize, 3.5);
  assert.deepEqual(item.points, [[20, 30]]);
  assert.deepEqual(
    narrow.lines.filter((l) => l.prefix).map((l) => l.prefix),
    ['1. ', '2. '],
  );
  assert.equal(
    narrow.lines
      .flatMap((l) => l.runs)
      .map((r) => r.text)
      .join(''),
    'abcdefghijklmnop',
  );
  assert.ok(narrow.lines[0].runs.every((r) => r.bold));
});
