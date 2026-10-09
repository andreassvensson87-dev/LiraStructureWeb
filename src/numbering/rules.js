import { defaultPrefix } from '../object-identity.js';
export function objectSeries(object, assembly = false) {
  const series = object?.[assembly ? 'assemblySeries' : 'partSeries'];
  return series || { prefix: assembly ? 'A' : defaultPrefix(object), start: 1 };
}
export function validateSeries(series) {
  if (!/^[\p{L}\p{N}_-]{1,16}$/u.test(series?.prefix))
    throw Error('Prefix: 1–16 bokstäver, siffror, _ eller -.');
  if (!Number.isSafeInteger(series.start) || series.start < 1 || series.start > 999999999)
    throw Error('Startnummer: ett heltal mellan 1 och 999999999.');
  return series;
}
// Compare against the group's representative, avoiding cumulative tolerance drift.
export function equivalent(a, b, tolerance = 0) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tolerance + 1e-8;
  if (
    typeof a === 'string' &&
    typeof b === 'string' &&
    ['{', '['].includes(a[0]) &&
    ['{', '['].includes(b[0])
  ) {
    try {
      return equivalent(JSON.parse(a), JSON.parse(b), tolerance);
    } catch {
      return a === b;
    }
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        key in b &&
        equivalent(
          a[key],
          b[key],
          ['material', 'series', 'axes', 'axis', 'u', 'v'].includes(key) ? 0 : tolerance,
        ),
    )
  );
}
export function matchingKey(a, b, tolerance = 0) {
  try {
    return equivalent(JSON.parse(a), JSON.parse(b), tolerance);
  } catch {
    return a === b;
  }
}
function recordSeries(record) {
  try {
    const key = JSON.parse(record.key);
    if (!Array.isArray(key)) return key.series;
    return key.map((token) => JSON.parse(token)).find((member) => member.main)?.series;
  } catch {
    return null;
  }
}
export function allocateMark(series, records, used, options) {
  validateSeries(series);
  let number = series.start;
  if (!options.reuseOldNumbers) {
    for (const record of records) {
      const owner = recordSeries(record);
      if (owner && (owner.prefix !== series.prefix || owner.start !== series.start)) continue;
      const mark = record.mark;
      if (mark.startsWith(series.prefix)) {
        const suffix = mark.slice(series.prefix.length).replace(/^-/, '');
        const value = Number(suffix);
        if (/^\d+$/.test(suffix) && value >= number) number = value + 1;
      }
    }
  }
  while (
    used.has(`${series.prefix}${number}`) ||
    used.has(`${series.prefix}-${String(number).padStart(3, '0')}`)
  )
    number++;
  if (number > 999999999) throw Error('Nummerserien är slut.');
  const mark = `${series.prefix}${number}`;
  used.add(mark);
  return mark;
}
