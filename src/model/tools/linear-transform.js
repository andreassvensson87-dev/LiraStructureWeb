import { expression } from '../../section-expression.js';

/** A transient displacement draft, independent of UI and project data. */
export function linearDraft(mode) {
  if (!['move', 'copy'].includes(mode)) throw Error('Okänd linjär operation.');
  return { mode, values: ['0', '0', '0'], enabled: [true, true, true], count: '1' };
}
function axes(frame) {
  if (!frame)
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  const [u, v] = [frame.u, frame.v];
  return [u, v, [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]];
}
export function linearCount(draft) {
  if (draft.mode !== 'copy') return 1;
  const count = Number(String(draft.count).trim());
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw Error('Ange 1–1000 kopior.');
  return count;
}
export function linearVector(draft, frame = null) {
  const values = draft.values.map((text, i) =>
    draft.enabled[i] ? expression(String(text).trim().replace(/^=/, '')) : 0,
  );
  const basis = axes(frame);
  return basis[0].map((_, i) => basis.reduce((sum, axis, j) => sum + axis[i] * values[j], 0));
}
export function pickedLinearValues(start, end, frame = null) {
  const delta = end.map((v, i) => v - start[i]);
  return axes(frame).map((axis) => String(axis.reduce((sum, v, i) => sum + v * delta[i], 0)));
}
