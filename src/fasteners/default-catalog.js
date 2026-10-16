import { validateFastenerLibrary } from './library.js';
import { METRIC_FASTENER_DIMENSIONS, iso4014ThreadLength } from './standard-dimensions.js';

/** Detached built-ins: stable identities, one editable version per family/diameter. */
export function defaultFasteners() {
  const records = [];
  for (const [
    d,
    pitch,
    width,
    height,
    nutHeight,
    bore,
    outer,
    thickness,
  ] of METRIC_FASTENER_DIMENSIONS) {
    for (const standard of ['ISO 4017', 'ISO 4014', 'DIN 976-1']) {
      const rod = standard === 'DIN 976-1';
      const length = rod ? 1000 : Math.max(100, 5 * d);
      records.push({
        id: `builtin-${standard.toLowerCase().replaceAll(' ', '-')}-m${d}`,
        revision: 1,
        kind: rod ? 'rod' : 'bolt',
        name: `${standard} M${d}`,
        standard,
        series: standard,
        diameter: d,
        length,
        grade: '8.8',
        coating: 'Obehandlad',
        ...(!rod ? { head: { kind: 'hex', diameter: width, height } } : {}),
        thread: {
          length: standard === 'ISO 4014' ? iso4014ThreadLength(d, length) : length,
          pitch,
        },
        nut: { acrossFlats: width, thickness: nutHeight },
        washer: { innerDiameter: bore, outerDiameter: outer, thickness },
        holeDefaults: {
          kind: 'clearance',
          extent: 'profile',
          diameter: d + (d <= 12 ? 1 : d <= 24 ? 2 : 3),
          depth: length,
        },
      });
    }
  }
  // Modelling templates, deliberately without a standard, grade or manufacturer claim.
  for (const d of [4, 5, 6, 8, 10])
    records.push({
      id: `builtin-wood-${d}`,
      revision: 1,
      kind: 'wood',
      name: `Träskruv Ø${d} · modellmall`,
      series: 'Träskruv · modellmall',
      diameter: d,
      length: 100,
      head: { kind: 'countersunk', diameter: 2 * d, height: d / 2 },
      holeDefaults: { kind: 'none' },
    });
  for (const [d, width, height, drill, embedment] of [
    [8, 13, 6, 6, 40],
    [10, 15, 7, 8, 50],
    [12, 17, 8, 10, 60],
  ])
    records.push({
      id: `builtin-concrete-${d}`,
      revision: 1,
      kind: 'concrete',
      name: `Betongskruv Ø${d} · modellmall`,
      series: 'Betongskruv · modellmall',
      diameter: d,
      length: 100,
      head: { kind: 'hex', diameter: width, height },
      anchor: { embedment, drillDiameter: drill, drillDepth: embedment + 10 },
      holeDefaults: { kind: 'clearance', extent: 'profile', diameter: d + 2, depth: 100 },
    });
  return validateFastenerLibrary({ schema: 1, fasteners: records });
}

/** Fill missing built-ins without overwriting user revisions or re-importing revision 1. */
export function withDefaultFasteners(existing = []) {
  const records = validateFastenerLibrary({ schema: 1, fasteners: existing });
  const ids = new Set(records.map((spec) => spec.id));
  return validateFastenerLibrary({
    schema: 1,
    fasteners: [...records, ...defaultFasteners().filter((spec) => !ids.has(spec.id))],
  });
}
