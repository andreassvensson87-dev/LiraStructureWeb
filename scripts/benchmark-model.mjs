import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { buildExample, measureInteraction } from './model-performance.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const sizes = value('--sizes', 'medium,large,stress').split(',');
const trials = Number(value('--trials', '1'));
if (!Number.isInteger(trials) || trials < 1 || trials > 10) throw new Error('Use --trials 1–10.');
const report = {
  recordedAt: new Date().toISOString(),
  runtime: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  method:
    'CPU only; actual model meshes, instance batches, joint edit and snap paths. Excludes GPU rendering, UI lists, history and labels. No FPS claim.',
  results: [],
};
for (const size of sizes)
  for (let trial = 1; trial <= trials; trial++) {
    globalThis.gc?.();
    console.error(`Measuring ${size}, trial ${trial}/${trials}…`);
    const example = buildExample(size);
    const interaction = measureInteraction(example);
    report.results.push({ trial, load: example.load, interaction });
    console.error(
      `${size}: ${example.load.objects} objects, meshes ${(example.load.meshesMs / 1000).toFixed(2)} s, joint edit ${interaction.jointEditMs.median.toFixed(1)} ms, snap ${interaction.stableSnapMs.p95.toFixed(1)} ms p95`,
    );
    example.dispose();
  }
const json = JSON.stringify(report, null, 2) + '\n';
const output = value('--output', null);
if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json);
  console.error(`Saved ${output}`);
}
process.stdout.write(json);
