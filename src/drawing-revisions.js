export function revisionValues(value) {
  const fields = {
    revision: String(value.revision || '').trim(),
    revisionCreatedBy: String(value.revisionCreatedBy || '').trim(),
    revisionComment: String(value.revisionComment || '').trim(),
    revisionDate: String(value.revisionDate || '').trim(),
  };
  if (!fields.revision || fields.revision.length > 20)
    throw Error('Ange en revisionsbeteckning, exempelvis A eller 1 (högst 20 tecken).');
  if (!fields.revisionCreatedBy || fields.revisionCreatedBy.length > 80)
    throw Error('Ange vem som skapat revisionen (högst 80 tecken).');
  if (!fields.revisionComment || fields.revisionComment.length > 200)
    throw Error('Ange en kommentar (högst 200 tecken).');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fields.revisionDate) ||
    !Number.isFinite(Date.parse(fields.revisionDate)) ||
    new Date(fields.revisionDate).toISOString().slice(0, 10) !== fields.revisionDate
  )
    throw Error('Ange ett giltigt revisionsdatum.');
  return fields;
}
export function applyDrawingRevision(records, ids, values) {
  const fields = revisionValues(values);
  if (!ids.size || [...ids].some((id) => !records.some((r) => r.id === id)))
    throw Error('Markera ritningarna som ska revideras.');
  return records.map((r) => (ids.has(r.id) ? { ...r, ...fields, needsReview: true } : r));
}
export function showDrawingRevision(manager) {
  const ids = new Set(manager.selection);
  const selected = manager.getState().drawings.filter((r) => ids.has(r.id));
  if (!selected.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'drawing-revision-dialog';
  dialog.setAttribute('aria-label', 'Revision');
  dialog.innerHTML = `<header><strong>Revision</strong><button type="button" aria-label="Stäng revision">×</button></header><form><label>Beteckning<input name="revision" required maxlength="20" placeholder="A eller 1"></label><label>Skapad av<input name="revisionCreatedBy" required maxlength="80"></label><label>Kommentar<textarea name="revisionComment" required maxlength="200" rows="3"></textarea></label><label>Datum<input name="revisionDate" type="date" required></label><p role="alert"></p><footer><button type="button" data-cancel>Avbryt</button><button type="submit">Spara revision</button></footer></form>`;
  const form = dialog.querySelector('form');
  for (const key of ['revision', 'revisionCreatedBy', 'revisionComment', 'revisionDate']) {
    const common = selected.every((r) => r[key] === selected[0][key]) ? selected[0][key] : '';
    form.elements.namedItem(key).value = common || '';
  }
  if (!form.elements.revisionDate.value) {
    const today = new Date();
    form.elements.revisionDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  const close = () => dialog.close();
  dialog.querySelector('header button').onclick = dialog.querySelector('[data-cancel]').onclick =
    close;
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('close', () => dialog.remove());
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      const fields = Object.fromEntries(new FormData(form));
      manager.change(applyDrawingRevision(manager.getState().drawings, ids, fields));
      manager.visibleAttributes.add('drawing.revision');
      manager.render();
      close();
    } catch (error) {
      dialog.querySelector('[role=alert]').textContent = error.message;
    }
  };
  document.body.append(dialog);
  dialog.showModal();
}
