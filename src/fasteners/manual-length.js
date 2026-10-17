import { iso4014ThreadLength } from './standard-dimensions.js';
import { validateFastenerSpec } from './library.js';
import { fastenerAccessories } from './accessories.js';

/** A detached instance specification; library records remain unchanged. */
export function withFastenerLength(spec, length) {
  const result = structuredClone(spec);
  result.length = length;
  if (
    result.thread &&
    (spec.kind === 'rod' || spec.standard === 'ISO 4017' || spec.thread.length === spec.length)
  )
    result.thread.length = length;
  if (result.thread && spec.standard === 'ISO 4014')
    result.thread.length = iso4014ThreadLength(spec.diameter, length);
  validateFastenerSpec(result, { instance: true });
  return result;
}

/** Fit feedback is separate from structural validation and never changes the requested length. */
export function fastenerFitWarnings(s) {
  if (!s?.spec) return [];
  const warnings = new Set();
  if (s.insertion?.reachWarning === 'incomplete-layer')
    warnings.add('Skruven slutar inne i ett materiallager. Lagret får inget genomgående hål.');
  if (s.insertion?.reachWarning === 'hardware')
    warnings.add('Längden räcker inte för nästa lager med valda brickor och muttrar.');
  const length = s.spec.length;
  if (s.spec.thread?.length > length) warnings.add('Längden är kortare än produktens gänglängd.');
  if (s.assembly?.bolt !== false && s.span) {
    const gripEnd = Math.hypot(...s.span.end.map((v, i) => v - s.start[i]));
    if (gripEnd > length + 0.001) warnings.add('Längden räcker inte genom förbandet.');
  }
  for (const item of fastenerAccessories(s)) {
    if (item.offset < -0.001) warnings.add('Utstick före rymmer inte bricka och mutter.');
    if (item.offset + s.spec[item.kind].thickness > length + 0.001)
      warnings.add('Längden räcker inte för brickor och muttrar.');
    if (item.kind === 'nut' && s.spec.thread && item.offset < length - s.spec.thread.length - 0.001)
      warnings.add('Muttern ligger utanför den gängade delen.');
  }
  return [...warnings];
}
