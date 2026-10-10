import { nextNumber } from './identity-number.js';
import { objectType } from './model/object-types/index.js';
export const typeName = (s) => objectType(s).label;
export const defaultPrefix = (s) => objectType(s).prefix;
export const designation = (s) =>
  s.type === 'gridline'
    ? s.name
    : s.prefix && s.number
      ? `${s.prefix}-${String(s.number).padStart(3, '0')}`
      : s.name;
export function nextIdentity(s, objects) {
  const prefix = s.prefix || defaultPrefix(s);
  return nextNumber(prefix, objects);
}
export function identityError(s, objects) {
  if (!/^[\p{L}\p{N}_-]{1,16}$/u.test(s.prefix))
    return 'Prefix: 1–16 bokstäver, siffror, _ eller -.';
  if (!Number.isSafeInteger(s.number) || s.number < 1)
    return 'Löpnumret måste vara ett positivt heltal.';
  if (objects.some((o) => o.id !== s.id && o.prefix === s.prefix && o.number === s.number))
    return 'Beteckningen används redan.';
  return '';
}
