import { componentDefinition } from './definitions.js';
import { nextIdentity, designation } from '../object-identity.js';
import { latestFasteners } from '../fasteners/library.js';

/** Owns reference-picking state only; no geometry commit, DOM, project writes or history. */
export function createComponentPlacement(kind, { id = crypto.randomUUID() } = {}) {
  const definition = componentDefinition(kind);
  let state = {
    type: 'component',
    id,
    kind,
    ...structuredClone(definition.defaults),
    references: [],
    ready: false,
  };
  return {
    get state() {
      return state;
    },
    pick(object, point, objects, fasteners = []) {
      if (state.ready) return state;
      const next = definition.placement.pick(
        structuredClone(state),
        object,
        point,
        latestFasteners(fasteners).filter((spec) => spec.kind === 'bolt'),
      );
      if (next.ready) {
        Object.assign(next.draft, nextIdentity(next.draft, objects));
        next.draft.name = `${definition.label} · ${designation(next.draft)}`;
      }
      state = { ...next.draft, ready: next.ready };
      return state;
    },
  };
}
export function componentPlacementPrompt(kind, count = 0, ready = false) {
  const definition = componentDefinition(kind);
  return ready
    ? `${definition.label} · Kontrollera förhandsvisningen och bekräfta`
    : `${definition.label} · ${definition.placement.prompts[count] || definition.placement.prompts[0]} · Esc avbryter`;
}
