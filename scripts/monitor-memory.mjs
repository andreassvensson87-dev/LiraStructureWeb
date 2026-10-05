import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const pid = Number(option('--pid', '0'));
const seconds = Number(option('--seconds', '600'));
const output = option('--output', 'artifacts/browser-process-memory.json');
if (!Number.isInteger(pid) || pid < 1 || !Number.isFinite(seconds) || seconds < 1)
  throw new Error('Use --pid <renderer PID> --seconds <duration>.');
const run = promisify(execFile);
const report = {
  startedAt: new Date().toISOString(),
  pid,
  method:
    'macOS ps RSS sampled once per second for the specified renderer PID. Identify the content renderer by its response to a known model load; a newly created IAB wrapper process may not host page content. RSS may include shared pages, excludes the shared GPU/browser processes and is not JS retained heap. No forced GC.',
  samples: [],
};
await mkdir(dirname(output), { recursive: true });
const started = Date.now();
while (Date.now() - started < seconds * 1000) {
  try {
    await access(output + '.stop');
    break;
  } catch {
    /* No stop marker. */
  }
  let stdout;
  try {
    ({ stdout } = await run('ps', ['-p', String(pid), '-o', 'pid=,rss=']));
  } catch (error) {
    // Closing a temporary test tab can remove its renderer between samples.
    if (error.code === 1 && !error.stdout?.trim()) break;
    throw error;
  }
  const [observed, rssKiB] = stdout.trim().split(/\s+/).map(Number);
  if (observed !== pid || !Number.isFinite(rssKiB)) break;
  report.samples.push({ at: new Date().toISOString(), rssBytes: rssKiB * 1024 });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
report.finishedAt = new Date().toISOString();
report.peakRssBytes = Math.max(...report.samples.map((sample) => sample.rssBytes));
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    pid,
    samples: report.samples.length,
    peakMiB: report.peakRssBytes / 1048576,
    output,
  }),
);
