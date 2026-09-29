const fields = ['settings', 'levelId', 'view', 'viewport', 'sheet', 'annotations'];
/** Preserve numbering/source metadata owned by the drawing manager. */
export function mergeDrawingEdit(drawings, edit) {
  if (!edit) return drawings;
  const old = drawings.find((d) => d.id === edit.id);
  if (
    !old ||
    JSON.stringify(fields.map((k) => old[k])) === JSON.stringify(fields.map((k) => edit[k]))
  )
    return drawings;
  const patch = structuredClone(Object.fromEntries(fields.map((k) => [k, edit[k]])));
  return drawings.map((d) => (d.id === edit.id ? { ...d, ...patch } : d));
}
