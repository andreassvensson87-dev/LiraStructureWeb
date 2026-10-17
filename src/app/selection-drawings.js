import { selectionDrawingContext } from '../drawing-selection.js';

/** Continue a drawing request after the existing explicit numbering transaction. */
export function createSelectionDrawingActions({
  getState,
  prepare,
  number,
  restoreSelection,
  openDrawing,
  showBatch,
  message,
}) {
  let pending = false;
  async function withNumberedSelection(
    type,
    ids,
    next,
    needsNumbering = (context) => context.groups.some((g) => g.type === type && !g.valid),
  ) {
    if (pending) return;
    pending = true;
    const original = new Set(ids);
    try {
      prepare();
      let context = selectionDrawingContext(getState(), original);
      if (!context.selection.size) throw Error('Markera fysiska delar för ritningen.');
      if (needsNumbering(context)) {
        message('Numrering behövs innan ritningen kan öppnas eller skapas.');
        let assigned;
        try {
          assigned = await number({ parts: true, assemblies: type === 'AS' });
        } finally {
          restoreSelection(
            [...original].filter((id) => getState().objects.some((o) => o.id === id)),
          );
        }
        if (!assigned) {
          message('Ritningsåtgärden avbruten · Inga ritningar skapades');
          return;
        }
        context = selectionDrawingContext(getState(), original);
        if (context.groups.some((g) => g.type === type && !g.valid))
          throw Error(
            'Urvalets numrering är inte aktuell. Numrera berörda detaljer och assemblies.',
          );
      }
      next(context, original);
    } catch (error) {
      message(error.message);
    } finally {
      pending = false;
    }
  }
  return {
    selectionContext: (ids) => selectionDrawingContext(getState(), ids),
    createForSelection: (type, ids) =>
      withNumberedSelection(type, ids, (_context, original) => {
        showBatch(type, original);
      }),
    openForSelection: (record, ids) =>
      withNumberedSelection(
        record.type,
        ids,
        (context, original) => {
          const linked = context.drawings.filter(
            (link) => link.valid && link.record.type === record.type,
          );
          const drawing =
            linked.find((link) => link.record.id === record.id) ||
            (linked.length === 1 && linked[0]);
          if (drawing) openDrawing(drawing.record);
          else showBatch(record.type, original);
        },
        (context) => !context.drawings.some((link) => link.valid && link.record.id === record.id),
      ),
  };
}
