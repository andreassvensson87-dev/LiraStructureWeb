/** Bore features are owned by a fastener, referenced independently of list order. */
export function boreFeature(h) {
  return { ...structuredClone(h), id: h.id || crypto.randomUUID(), type: 'bore' };
}
export function boreIdentity(s, h) {
  return `${s.id}:bore:${h.id || h.targetId}`;
}
export function transformSpan(s, turn) {
  return s.span ? { span: { start: turn(s.span.start), end: turn(s.span.end) } } : {};
}
