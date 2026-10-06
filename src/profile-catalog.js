import { TIBNOR_PROFILES } from './tibnor-catalog.js';
import { TIMBER_PROFILES } from './timber-catalog.js';
import { mergeLibrary } from './section-profile.js';

export const BUILTIN_PROFILES = [...TIBNOR_PROFILES, ...TIMBER_PROFILES];
const builtinIds = new Set(BUILTIN_PROFILES.map((p) => p.id));
export const isBuiltinProfile = (p) => builtinIds.has(p.id);
export const withBuiltinCatalog = (personal) => mergeLibrary(BUILTIN_PROFILES, personal);
export const personalProfiles = (profiles) =>
  profiles.filter((p) => !(isBuiltinProfile(p) && p.revision === 1));
