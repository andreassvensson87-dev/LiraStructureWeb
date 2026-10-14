import { latestFasteners } from '../fasteners/library.js';
import { fastenerSeriesKey } from '../fasteners/assembly.js';
/** Dependencies of one edited parameter; resolution/validation remains in its definition. */
export function editComponentParameter(draft, key, value, records = []) {
  const choices = latestFasteners(records);
  const result = { ...structuredClone(draft), [key]: structuredClone(value) };
  if (key === 'anchorKind')
    result.anchorSpec = structuredClone(
      choices.find((spec) => spec.kind === result.anchorKind) || null,
    );
  if (['anchorKind', 'anchorSpec'].includes(key) && result.anchorSpec) {
    result.holeDiameter = result.anchorSpec.diameter + 2;
    result.useWasher = !!result.anchorSpec.washer;
  }
  if (key === 'boltSpec' && result.boltSpec) {
    result.lengthOptions = structuredClone(
      choices
        .filter((spec) => spec.kind === 'bolt')
        .filter((spec) => fastenerSeriesKey(spec) === fastenerSeriesKey(result.boltSpec)),
    );
    result.holeDiameter = result.boltSpec.diameter + 2;
    result.nearWasher = result.farWasher = !!result.boltSpec.washer;
  }
  return result;
}
