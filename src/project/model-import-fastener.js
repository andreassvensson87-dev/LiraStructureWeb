import { latestFasteners } from '../fasteners/library.js';
import { withFastenerLength, fastenerFitWarnings } from '../fasteners/manual-length.js';
import { prepareFastenerPlacement } from '../fasteners/placement-draft.js';
import { partAxisIntervals } from '../fasteners/placement.js';
import { axisPlacement } from '../fasteners/geometry.js';

const assemblyKeys = ['bolt', 'nearWasher', 'nearNut', 'farWasher', 'nut', 'extraNut'];
/** Translate file intent through the same placement and bore resolution as the native editor. */
export function importFastener(input, base, references, records, model, named) {
  const product = named(latestFasteners(records), input.spec, 'Skruv');
  if (product.kind !== 'bolt')
    throw new Error('AI-import stöder här skruv med mutter och rena genomgående hål.');
  if (!Number.isFinite(input.length)) throw new Error('Ange skruvlängd i mm.');
  const spec = withFastenerLength(product, input.length);
  if (
    !input.assembly ||
    Array.isArray(input.assembly) ||
    Object.keys(input.assembly).length !== assemblyKeys.length ||
    !assemblyKeys.every((key) => typeof input.assembly[key] === 'boolean')
  )
    throw new Error('Ange förbandets sex val för skruv, brickor och muttrar.');
  const holes = input.holes.map((hole, i) => {
    if (
      !hole ||
      Object.keys(hole).some((key) => !['target', 'diameter', 'extent'].includes(key)) ||
      !Number.isFinite(hole.diameter) ||
      hole.diameter <= 0 ||
      hole.diameter > 1000 ||
      !['wall', 'profile'].includes(hole.extent)
    )
      throw new Error('Ange hålets måldel, diameter och omfattning wall eller profile.');
    if (input.assembly.bolt && hole.diameter < spec.diameter)
      throw new Error('Genomgående hål får inte vara mindre än skruvdiametern.');
    return {
      id: crypto.randomUUID(),
      targetId: references[i],
      kind: 'clearance',
      diameter: hole.diameter,
      extent: hole.extent,
      offset: 0,
      depth: spec.length,
    };
  });
  const { draft } = prepareFastenerPlacement(
    {
      ...base,
      type: 'fastener',
      spec,
      assembly: structuredClone(input.assembly),
      ...axisPlacement(spec, input.start, input.direction),
      holes,
      anchorId: references[0],
      placementMode: 'range',
    },
    { model, start: input.start, direction: input.direction },
  );
  if (draft.holes.some((hole) => hole.active === false || !hole.layers?.length))
    throw new Error('Skruven/hålaxeln träffar inte eller når inte igenom alla valda delar.');
  const materialModel = model.filter((o) => o.type !== 'fastener');
  for (const hole of draft.holes) {
    const intervals = partAxisIntervals(
      draft,
      materialModel.find((o) => o.id === hole.targetId),
      materialModel,
    );
    const expected = hole.extent === 'wall' ? intervals.slice(0, 1) : intervals;
    if (
      expected.some(
        (span) =>
          !hole.layers.some(
            (layer) =>
              Math.abs(layer.offset - span.offset) < 0.01 &&
              Math.abs(layer.depth - span.depth) < 0.01,
          ),
      )
    )
      throw new Error(
        'Längden når inte igenom alla begärda materiallager. Välj wall för enbart första väggen/flänsen.',
      );
  }
  const warnings = fastenerFitWarnings(draft);
  if (warnings.length) throw new Error(warnings.join(' '));
  return draft;
}
