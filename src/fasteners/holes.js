import { transformGroup } from './group-data.js';
/** Bore features are owned by a fastener, referenced independently of list order. */
export function boreFeature(h) {
  return { ...structuredClone(h), id: h.id || crypto.randomUUID(), type: 'bore' };
}
export function boreIdentity(s, h) {
  return `${s.id}:bore:${h.id || h.targetId}`;
}
export function transformSpan(s, turn) {
  return {
    ...transformGroup(s, turn),
    ...(s.span ? { span: { start: turn(s.span.start), end: turn(s.span.end) } } : {}),
    ...(s.insertion
      ? {
          insertion: {
            ...s.insertion,
            start: turn(s.insertion.start),
            direction: turn(s.insertion.direction),
          },
        }
      : {}),
  };
}
