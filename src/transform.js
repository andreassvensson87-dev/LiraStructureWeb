import { objectType } from './model/object-types/index.js';
import { transformBlockMetadata } from './blocks/placement.js';
export function transformObject(source, mode, base, target) {
  const definition = objectType(source);
  if (mode === 'start' || mode === 'end') {
    if (source.parametricBlock)
      throw Error(
        'Insättningspunkten styrs av blocket. Ändra blockparametrarna eller frigör blocket.',
      );
    if (!definition.moveAnchor) throw new Error('Objekttypen stöder inte denna punktredigering.');
    return definition.moveAnchor(source, mode, target);
  }
  if (!['move', 'copy'].includes(mode)) throw new Error(`Okänd transformation: ${mode}`);
  const delta = target.map((v, i) => v - base[i]);
  return {
    ...definition.translate(
      source,
      target.map((v, i) => v - base[i]),
    ),
    ...transformBlockMetadata(source, (p) => p.map((v, i) => v + delta[i])),
  };
}
// Compatibility for existing callers; new code uses the object-level name.
export const transformSweep = transformObject;
