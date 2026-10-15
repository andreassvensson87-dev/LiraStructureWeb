import { activeBasePoint, localToMap, mapToLocal } from './coordinates.js';
/** Reference file engineering mm → map metres → project engineering mm. No camera/UI state. */
export function referenceLocalPoint(p, mode, source, coordinates) {
  if (mode === 'local') return [...p];
  const map = source
    ? localToMap(
        p.map((v) => v * source.scale),
        { local: [0, 0, 0], map: source.map, rotation: source.rotation },
      )
    : p.map((v) => v / 1000);
  return mapToLocal(map, activeBasePoint(coordinates));
}
export function validateReferenceCRS(source, mode, coordinates) {
  if (mode === 'local' || !source || !activeBasePoint(coordinates)) return;
  const same = (a, b) =>
    !a || !b || a.replace(/\s/g, '').toUpperCase() === b.replace(/\s/g, '').toUpperCase();
  if (!same(source.crs, coordinates.crs) || !same(source.verticalDatum, coordinates.verticalDatum))
    throw Error(
      'Referensens koordinatsystem skiljer sig från projektets. Omprojektera filen före import eller använd lokala modellkoordinater.',
    );
}
export function validateSourceCoordinates(source) {
  if (
    !source ||
    !Array.isArray(source.map) ||
    source.map.length !== 3 ||
    !source.map.every(Number.isFinite) ||
    !Number.isFinite(source.rotation) ||
    !Number.isFinite(source.scale) ||
    source.scale <= 0 ||
    !['crs', 'verticalDatum'].every((k) => typeof source[k] === 'string' && source[k].length <= 200)
  )
    throw Error('Ogiltig georeferering i referensfilen.');
  return source;
}

/** Analytic axes avoid subtracting large map coordinates to estimate a rotation. */
export function referenceFrame(mode, source, coordinates) {
  if (mode === 'local') return { offset: [0, 0, 0], rotation: 0, scale: 1 };
  const base = activeBasePoint(coordinates);
  return {
    offset: referenceLocalPoint([0, 0, 0], mode, source, coordinates),
    rotation: (source?.rotation || 0) - (base?.rotation || 0),
    scale: source?.scale || 1,
  };
}
