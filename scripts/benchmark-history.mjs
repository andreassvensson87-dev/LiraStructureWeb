import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus } from 'node:os';
import { createFrameExample } from '../src/project/frame-example.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const size = value('--size', 'stress');
const edits = Number(value('--edits', '100'));
if (!Number.isInteger(edits) || edits < 1 || edits > 500) throw new Error('Use --edits 1–500.');
if (!globalThis.gc)
  throw new Error('Run with --expose-gc for comparable retained-memory measurements.');
const report = {
  recordedAt: new Date().toISOString(),
  runtime: { node: process.version, cpu: cpus()[0]?.model },
  method:
    'Node/V8 retained heap after two explicit GCs. Real model, automatic joint edits and project history. Excludes DOM, GPU, renderer and browser/process memory. RSS need not fall after collection.',
  size,
  edits,
  points: [],
  timings: {},
};
let project, history;
function memory(label) {
  globalThis.gc();
  globalThis.gc();
  const memory = process.memoryUsage();
  const point = {
    label,
    heapUsed: memory.heapUsed,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
    rss: memory.rss,
    past: history?.past.length || 0,
    future: history?.future.length || 0,
  };
  report.points.push(point);
  console.error(
    `${label}: ${(point.heapUsed / 1048576).toFixed(1)} MiB retained heap, ${point.past} undo / ${point.future} redo steps`,
  );
}
function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted.at(-1),
  };
}
function retainedRecords() {
  const records = new Set();
  let references = 0;
  for (const step of [...history.past, ...history.future]) {
    references += step.objects.length;
    for (const object of step.objects) records.add(object);
  }
  return { uniqueObjects: records.size, objectReferences: references };
}
memory('runtime');
project = createFrameExample(size);
report.objects = project.objects.length;
const index = project.objects.findIndex((object) => object.type === 'fastener');
const diameter = () => project.objects[index].holes[0].diameter;
const expected = (step) => 22 + step / 1000;
assert.equal(diameter(), 22);
memory('model');
history = new ProjectHistory(edits);
history.prime(project);
memory('primed');
const checkpoints = [],
  transactions = [];
function edit(step) {
  let started = performance.now();
  history.checkpoint(project);
  checkpoints.push(performance.now() - started);
  started = performance.now();
  const screw = project.objects[index];
  project.objects = applyObjectBatch(project.objects, [
    { ...screw, holes: screw.holes.map((hole) => ({ ...hole, diameter: expected(step) })) },
  ]).objects;
  transactions.push(performance.now() - started);
  assert.equal(diameter(), expected(step));
  assert.ok(history.past.length <= edits);
}
for (let step = 1; step <= edits * 2; step++) {
  edit(step);
  if (step === edits) memory('history-full');
}
memory('history-overflow');
report.retained = retainedRecords();
const undo = [],
  redo = [];
for (let step = 1; step <= edits; step++) {
  const started = performance.now();
  project = history.undo(project);
  undo.push(performance.now() - started);
  assert.equal(diameter(), expected(edits * 2 - step));
}
assert.equal(history.undo(project), null);
memory('all-undone');
for (let step = 1; step <= edits; step++) {
  const started = performance.now();
  project = history.redo(project);
  redo.push(performance.now() - started);
  assert.equal(diameter(), expected(edits + step));
}
assert.equal(history.redo(project), null);
memory('all-redone');
for (let step = 0; step < Math.ceil(edits / 2); step++) project = history.undo(project);
memory('before-branch');
edit(edits * 2 + 1);
assert.equal(history.canRedo, false);
memory('after-branch');
history = null;
memory('history-released');
report.timings = {
  checkpointMs: summary(checkpoints),
  transactionMs: summary(transactions),
  undoMs: summary(undo),
  redoMs: summary(redo),
};
const json = JSON.stringify(report, null, 2) + '\n';
const output = value('--output', null);
if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json);
}
process.stdout.write(json);
