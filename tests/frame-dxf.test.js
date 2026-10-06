import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrameDXF, frameFromDXF } from '../src/frame-dxf.js';
import { transformFrameEntity, builtInAttributes } from '../src/frame-model.js';
import { revisionExampleBlock } from '../src/frame-revision-example.js';
const dxf = (entities, extra = '') =>
  `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n${extra}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
const line = '0\nLINE\n10\n10\n20\n20\n11\n190\n21\n20\n';
const text = '0\nTEXT\n10\n15\n20\n25\n40\n3.5\n1\nÖversikt ÅÄÖ\n';
test('DXF text parsing keeps units and Swedish text; scale and insertion preserve model coordinates', () => {
  const doc = parseFrameDXF(dxf(line + text));
  assert.equal(doc.header.$INSUNITS, 4);
  const { frame } = frameFromDXF(doc, { factor: 10, scale: 0.1, origin: [10, 20] });
  assert.equal(frame.width, 180);
  assert.deepEqual(frame.origin, [0, 0]);
  assert.deepEqual(frame.entities[0].points, [
    [0, 0],
    [180, 0],
  ]);
  assert.equal(frame.entities[1].text, 'Översikt ÅÄÖ');
  const placed = transformFrameEntity(frame.entities[1], frame.origin, [100, 200]);
  assert.deepEqual(placed.point, [105, 205]);
  assert.equal(new Set(frame.entities.map((e) => e.id)).size, frame.entities.length);
});
test('closed polylines with bulges and wrapping arcs become editable finite polylines', () => {
  const doc = {
    entities: [
      {
        type: 'LWPOLYLINE',
        shape: true,
        vertices: [
          { x: 0, y: 0, bulge: 1 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      },
      {
        type: 'ARC',
        center: { x: 0, y: 0 },
        radius: 5,
        startAngle: Math.PI * 1.5,
        endAngle: Math.PI / 2,
      },
      { type: 'CIRCLE', center: { x: 20, y: 0 }, radius: 3 },
    ],
  };
  const { frame } = frameFromDXF(doc);
  assert.equal(frame.entities.length, 3);
  assert.ok(frame.entities[0].points.length > 10);
  assert.deepEqual(frame.entities[0].points[0], frame.entities[0].points.at(-1));
  assert.ok(frame.entities.flatMap((e) => e.points.flat()).every(Number.isFinite));
  assert.ok(frame.entities[1].points.length > 20);
});
test('nested DXF blocks apply basepoint, scale and rotation; unsupported objects are reported', () => {
  const doc = {
    blocks: {
      Title: {
        position: { x: 10, y: 20 },
        entities: [
          {
            type: 'LINE',
            vertices: [
              { x: 10, y: 20 },
              { x: 20, y: 20 },
            ],
          },
          { type: 'INSERT', name: 'Loop', position: { x: 10, y: 20 } },
        ],
      },
      Loop: {
        position: { x: 0, y: 0 },
        entities: [{ type: 'INSERT', name: 'Loop', position: { x: 0, y: 0 } }],
      },
    },
    entities: [
      {
        type: 'INSERT',
        name: 'Title',
        position: { x: 100, y: 200 },
        xScale: 2,
        yScale: 2,
        rotation: 90,
      },
      { type: 'HATCH' },
    ],
  };
  const { frame, skipped } = frameFromDXF(doc, { origin: [100, 200] });
  assert.ok(Math.abs(frame.origin[0]) < 1e-8 && Math.abs(frame.origin[1]) < 1e-8);
  assert.ok(Math.abs(frame.entities[0].points[1][1] - 20) < 1e-8);
  assert.ok(skipped.includes('HATCH'));
  assert.ok(skipped.some((s) => s.startsWith('INSERT')));
});
test('MTEXT paragraphs are plain editable rows and invalid input does not create a block', () => {
  const { frame } = frameFromDXF({
    entities: [
      {
        type: 'MTEXT',
        text: '{\\H2x;ÅÄÖ}\\PRad 2',
        position: { x: 0, y: 10 },
        height: 3,
        attachmentPoint: 1,
      },
    ],
  });
  assert.deepEqual(
    frame.entities.map((e) => e.text),
    ['ÅÄÖ', 'Rad 2'],
  );
  assert.ok(frame.entities[0].point[1] > frame.entities[1].point[1]);
  assert.throws(() => parseFrameDXF('AutoCAD Binary DXF'), /textformat/);
  assert.throws(() => parseFrameDXF('not a dxf'), /Kunde inte/);
  assert.throws(() => frameFromDXF({ entities: [{ type: 'HATCH' }] }), /inga ramobjekt/);
  assert.throws(() => frameFromDXF(parseFrameDXF(dxf(line)), { scale: -1 }), /skala/);
  assert.throws(() => frameFromDXF(parseFrameDXF(dxf(line)), { factor: 1000 }), /5 000/);
});
test('example title block contains real revision attributes and independent editable entities', () => {
  const block = revisionExampleBlock();
  const keys = block.entities.filter((e) => e.type === 'attribute').map((e) => e.key);
  for (const key of [
    'drawing.revision',
    'drawing.revisionDate',
    'drawing.revisionCreatedBy',
    'drawing.revisionComment',
  ])
    assert.ok(keys.includes(key));
  assert.ok(keys.every((key) => builtInAttributes.some((a) => a.key === key)));
  assert.equal(block.entities.length, new Set(block.entities.map((e) => e.id)).size);
});
