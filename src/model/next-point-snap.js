/** One point override in editor state; project snap preferences are never changed. */
export const nextPointSnaps = [
  { id: 'endpoints', label: 'Ändpunkt' },
  { id: 'corners', label: 'Hörn' },
  { id: 'midpoints', label: 'Mittpunkt' },
  { id: 'quadrants', label: 'Kvadrant' },
  { id: 'perpendicular', label: 'Vinkelrät' },
  { id: 'nearest', label: 'Närmaste' },
  { id: 'gridIntersections', label: 'Stomlinjekorsning' },
  { id: 'free', label: 'Fri punkt' },
];
export function nextPointSnapSettings(settings, choice) {
  if (!choice) return settings;
  return {
    ...settings,
    ...Object.fromEntries(
      [
        'endpoints',
        'corners',
        'midpoints',
        'quadrants',
        'perpendicular',
        'nearest',
        'gridLines',
        'gridIntersections',
        'gridStepEnabled',
        'axes',
      ].map((key) => [key, key === choice]),
    ),
    polar: 0,
  };
}
export function nextPointReferenceCandidates(candidates, choice) {
  if (!choice) return candidates;
  return candidates.filter((candidate) => {
    if (choice === 'endpoints' || choice === 'corners') return candidate.symbol === 'square';
    if (choice === 'perpendicular') return candidate.symbol === 'perpendicular';
    if (choice === 'nearest') return candidate.edge;
    return false;
  });
}
export function nextPointSnapLabel(choice) {
  return nextPointSnaps.find((snap) => snap.id === choice)?.label || '';
}
export function acceptsNextPointSnap(snap, choice) {
  return !choice || (choice === 'free' ? !!snap.point : snap.kind === 'point');
}
export function consumeNextPointSnap(tools) {
  tools.nextPointSnap = null;
}
