/** A transient displacement draft, independent of UI and project data. */
export function linearDraft(mode) {
  if (!['move', 'copy'].includes(mode)) throw Error('Okänd linjär operation.');
  return { mode, values: ['0', '0', '0'], enabled: [true, true, true] };
}
export function linearVector(draft) {
  return draft.values.map((text, i) => {
    if (!draft.enabled[i]) return 0;
    const value = String(text).trim().replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(+value))
      throw Error('Ange ett giltigt avstånd.');
    return +value;
  });
}
export function pickedLinearValues(start, end) {
  return end.map((value, i) => String(value - start[i]));
}
