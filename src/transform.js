import { objectType } from './model/object-types/index.js';
export function transformObject(source, mode, base, target) {
  const definition = objectType(source);
  if (mode === 'start' || mode === 'end') {
    if (!definition.moveAnchor) throw new Error('Objekttypen stöder inte denna punktredigering.');
    return definition.moveAnchor(source, mode, target);
  }
  if (!['move', 'copy'].includes(mode)) throw new Error(`Okänd transformation: ${mode}`);
  return definition.translate(
    source,
    target.map((v, i) => v - base[i]),
  );
}
// Compatibility for existing callers; new code uses the object-level name.
export const transformSweep = transformObject;
