/** Picking uses the hit on the member, independent of its start/end drawing direction. */
export function nearestFitEnd(sweep, point) {
  const distance = (end) => Math.hypot(...sweep[end].map((v, i) => v - point[i]));
  return distance('start') < distance('end') ? 'start' : 'end';
}
export function suggestFitEnds(a, b) {
  let closest = Infinity,
    result = { endA: 'end', endB: 'end' };
  for (const endA of ['start', 'end'])
    for (const endB of ['start', 'end']) {
      const distance = Math.hypot(...a[endA].map((v, i) => v - b[endB][i]));
      if (distance < closest) {
        closest = distance;
        result = { endA, endB };
      }
    }
  return result;
}
export function pickFitReference(references, slot, source, point) {
  if (!source || (source.type ?? 'sweep') !== 'sweep') throw new Error('Klicka på en sweep.');
  if (references[slot === 'a' ? 'b' : 'a'] === source.id)
    throw new Error('Välj en annan sweep än den första.');
  return { id: source.id, end: nearestFitEnd(source, point) };
}
