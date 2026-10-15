import { referenceSnapFixture } from './reference-snap-fixture.js';
import { createReferencePartSnapIndex } from '../src/references/snap-part-index.js';
import { ReferenceModels } from '../src/references/reference-models.js';
import { resolveSnap } from '../src/snap.js';
import { drawingReferenceSnapIndex } from '../src/references/drawing-reference-geometry.js';
import { locateDrawingPoint } from '../src/drawing-point-placement.js';
import { defaultCadSettings } from '../src/cad-statusbar.js';
import { CadTracking } from '../src/cad-tracking.js';

export function timingSummary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMs: sorted.at(-1),
  };
}
const digestPoint = (hit) =>
  JSON.stringify([hit.label || hit.kind, hit.point?.map((v) => Math.round(v * 1e6) / 1e6)]);

/** Repeatable CPU workload shared by CLI and opt-in browser diagnostics. Never touches a user project. */
export async function runReferenceSnapWorkload({
  references = 20,
  partsPerReference = 1000,
  samples = 240,
  progress = async () => {},
  measureModelPoint = null,
} = {}) {
  const report = {
    method:
      'Synthetic references with 12 feature edges per box. Same cursor positions, corners enabled; warmup per mode. Model uses production ReferenceModels.candidates + resolveSnap, drawing uses locateDrawingPoint and the production drawing reference index. CPU only: excludes IFC parsing, DOM overlays, GPU/render, physical mouse and layout.',
    references,
    parts: references * partsPerReference,
    samples,
    results: [],
    equivalent: true,
  };
  for (const overlap of [false, true]) {
    await progress(`Förbereder ${overlap ? 'överlappande' : 'utspridda'} referenser`);
    const f = referenceSnapFixture({ references, partsPerReference, overlap });
    try {
      const refs = Object.assign(Object.create(ReferenceModels.prototype), {
        models: f.models,
        group: f.root,
      });
      const t = performance.now();
      const indices = f.models.map((m) => createReferencePartSnapIndex(m.parts, m.group));
      report.results.push({ stage: 'build', overlap, ms: performance.now() - t });
      const queries = f.queries.slice(0, samples),
        signatures = new Map();
      for (const indexed of [false, true]) {
        f.models.forEach((m, i) => {
          m.snapIndex = indexed ? indices[i] : null;
        });
        for (const [nearest, perpendicular] of [
          [false, false],
          [true, false],
          [false, true],
          [true, true],
        ]) {
          await progress(
            `Modell ${overlap ? 'överlappar' : 'utspridd'} · index ${indexed ? 'på' : 'av'} · N ${nearest} P ${perpendicular}`,
          );
          const search = [],
            total = [],
            hits = [];
          const run = (q, measure) => {
            const started = performance.now();
            const points = refs.candidates({ ...q, nearest, perpendicular });
            const searched = performance.now();
            const hit = resolveSnap({
              ...q,
              referencePoints: points,
              sweeps: [],
              grid: { x: [], y: [] },
              z: 0,
              nearestSnap: nearest,
              perpendicularSnap: perpendicular,
              axisSnap: false,
              polar: 0,
            });
            if (measure) {
              search.push(searched - started);
              total.push(performance.now() - started);
              hits.push(digestPoint(hit));
            }
          };
          queries.slice(0, 30).forEach((q) => run(q, false));
          queries.forEach((q) => run(q, true));
          const key = `${nearest}:${perpendicular}`;
          if (indexed && signatures.get(key) !== JSON.stringify(hits))
            throw Error('Indexed snap changed the selected result');
          if (!indexed) signatures.set(key, JSON.stringify(hits));
          report.results.push({
            stage: 'model',
            overlap,
            indexed,
            nearest,
            perpendicular,
            search: timingSummary(search),
            total: timingSummary(total),
            ...(measureModelPoint
              ? { pointAndOverlay: measureModelPoint(f, queries, nearest, perpendicular) }
              : {}),
          });
        }
      }
      await progress('Förbereder ritningens referenskanter');
      const sets = f.models.map((m) => ({
        referenceId: m.id,
        referenceSnap: true,
        visible: m.parts.flatMap((part) => {
          const x = m.group.position.x + part.mesh.position.x,
            y = part.mesh.position.y;
          const p = [
            [x - 100, y - 200],
            [x + 100, y - 200],
            [x + 100, y + 200],
            [x - 100, y + 200],
          ];
          return p.map((a, i) => [a, p[(i + 1) % 4]]);
        }),
      }));
      const query = drawingReferenceSnapIndex(sets);
      let raw = [0, 0],
        base = [0, 0],
        settings;
      const editor = {
        items: [],
        cad: { get: () => settings, coordinates() {} },
        tracking: new CadTracking(),
        transform: {
          active: () => true,
          get base() {
            return base;
          },
        },
        adapter: {
          locate: () => ({ view: 'v', point: [...raw] }),
          project: (p) => p,
          pixelScale: () => 0.1,
          snapEntities: (_v, p, t) => query(p, t).map((points) => ({ type: 'line', points })),
          candidates: (_v, p, t) =>
            p
              ? query(p, t).flatMap(([a, b]) => [
                  a,
                  b,
                  Object.assign([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { snapKind: 'Mittpunkt' }),
                ])
              : [],
        },
      };
      for (const [nearest, perpendicular] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ]) {
        await progress(
          `Ritning ${overlap ? 'överlappar' : 'utspridd'} · N ${nearest} P ${perpendicular}`,
        );
        settings = { ...defaultCadSettings, nearest, perpendicular, otrack: false, polar: 0 };
        const values = [];
        const run = (q, measure) => {
          raw = [
            3000 + (queries.indexOf(q) % 20) * 137,
            3000 + Math.floor(queries.indexOf(q) / 20) * 271,
          ];
          base = q.start.slice(0, 2);
          const t = performance.now();
          locateDrawingPoint(editor, { clientX: 0, clientY: 0 }, 'v');
          if (measure) values.push(performance.now() - t);
        };
        queries.slice(0, 30).forEach((q) => run(q, false));
        queries.forEach((q) => run(q, true));
        report.results.push({
          stage: 'drawing',
          overlap,
          nearest,
          perpendicular,
          total: timingSummary(values),
        });
      }
    } finally {
      f.dispose();
    }
  }
  return report;
}
