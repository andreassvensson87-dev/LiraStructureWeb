import {
  drawingRevisionHistory,
  revisionFields,
  withDrawingRevision,
} from './drawing-revision-history.js';
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
  return records.map((r) => (ids.has(r.id) ? withDrawingRevision(r, fields) : r));
}
function replaceHistory(record, revisions) {
  const latest = revisions.at(-1) || {};
  return {
    ...record,
    revisions,
    ...Object.fromEntries(revisionFields.map((key) => [key, latest[key] || ''])),
    needsReview: true,
  };
}
export function editDrawingRevision(records, id, label, values) {
  const fields = revisionValues(values);
  const record = records.find((r) => r.id === id);
  if (!record) throw Error('Ritningen finns inte längre.');
  const revisions = drawingRevisionHistory(record),
    index = revisions.findIndex((r) => r.revision === label);
  if (index < 0) throw Error('Revisionen finns inte längre.');
  if (revisions.some((r, i) => i !== index && r.revision === fields.revision))
    throw Error('Revisionsbeteckningen finns redan i historiken.');
  revisions[index] = fields;
  return records.map((r) => (r.id === id ? replaceHistory(r, revisions) : r));
}
export function removeDrawingRevision(records, id, label) {
  const record = records.find((r) => r.id === id);
  if (!record) throw Error('Ritningen finns inte längre.');
  const revisions = drawingRevisionHistory(record);
  if (!revisions.some((r) => r.revision === label)) throw Error('Revisionen finns inte längre.');
  return records.map((r) =>
    r.id === id
      ? replaceHistory(
          r,
          revisions.filter((entry) => entry.revision !== label),
        )
      : r,
  );
}
export function showDrawingRevision(manager) {
  const ids = new Set(manager.selection);
  const selected = manager.getState().drawings.filter((r) => ids.has(r.id));
  if (!selected.length) return;
  const single = selected.length === 1,
    id = selected[0].id;
  const dialog = document.createElement('dialog');
  dialog.className = 'drawing-revision-dialog';
  if (single) dialog.classList.add('drawing-revision-history-dialog');
  dialog.setAttribute('aria-label', single ? 'Revisioner' : 'Revision');
  dialog.innerHTML = `<header><strong>${single ? 'Revisioner' : 'Revision'}</strong><button type="button" aria-label="Stäng revision">×</button></header>${single ? '<section class="revision-list"><div class="revision-actions"><button type="button" data-new>Ny revision</button><button type="button" data-remove disabled>Ta bort revision</button></div><div class="revision-table-scroll"><table><thead><tr><th>Revision</th><th>Datum</th><th>Skapad av</th><th>Kommentar</th></tr></thead><tbody></tbody></table></div></section>' : ''}<form><label>Beteckning<input name="revision" required maxlength="20" placeholder="A eller 1"></label><label>Skapad av<input name="revisionCreatedBy" required maxlength="80"></label><label>Kommentar<textarea name="revisionComment" required maxlength="200" rows="3"></textarea></label><label>Datum<input name="revisionDate" type="date" required></label><p role="alert"></p><footer><button type="button" data-cancel>${single ? 'Stäng' : 'Avbryt'}</button><button type="submit">Spara revision</button></footer></form>`;
  const form = dialog.querySelector('form'),
    error = dialog.querySelector('[role=alert]'),
    submit = dialog.querySelector('[type=submit]');
  let editing = null;
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const fill = (values) => {
    for (const key of revisionFields) form.elements.namedItem(key).value = values[key] || '';
    if (!form.elements.revisionDate.value) form.elements.revisionDate.value = today();
    error.textContent = '';
    submit.textContent = editing === null ? 'Spara revision' : 'Spara ändringar';
  };
  const renderList = () => {
    if (!single) return;
    const body = dialog.querySelector('tbody');
    body.replaceChildren();
    const record = manager.getState().drawings.find((r) => r.id === id);
    for (const entry of drawingRevisionHistory(record).reverse()) {
      const row = document.createElement('tr');
      row.classList.toggle('selected', editing === entry.revision);
      const cell = document.createElement('td'),
        button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.revision;
      button.setAttribute('aria-label', 'Redigera revision ' + entry.revision);
      button.setAttribute('aria-pressed', String(editing === entry.revision));
      const choose = () => {
        editing = entry.revision;
        fill(entry);
        renderList();
      };
      button.onclick = choose;
      row.onclick = (event) => {
        if (event.target !== button) choose();
      };
      cell.append(button);
      row.append(cell);
      for (const key of ['revisionDate', 'revisionCreatedBy', 'revisionComment']) {
        const td = document.createElement('td');
        td.textContent = entry[key] || '';
        row.append(td);
      }
      body.append(row);
    }
    if (!body.children.length) {
      const row = document.createElement('tr'),
        cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'Inga revisioner';
      row.append(cell);
      body.append(row);
    }
    dialog.querySelector('[data-remove]').disabled = editing === null;
  };
  if (single) {
    fill({ revisionCreatedBy: selected[0].revisionCreatedBy });
    dialog.querySelector('[data-new]').onclick = () => {
      const author = form.elements.revisionCreatedBy.value;
      editing = null;
      fill({ revisionCreatedBy: author });
      renderList();
      form.elements.revision.focus();
    };
    dialog.querySelector('[data-remove]').onclick = () => {
      try {
        manager.change(removeDrawingRevision(manager.getState().drawings, id, editing));
        manager.render();
        editing = null;
        fill({ revisionCreatedBy: form.elements.revisionCreatedBy.value });
        renderList();
      } catch (failure) {
        error.textContent = failure.message;
      }
    };
    renderList();
  } else {
    fill(
      Object.fromEntries(
        revisionFields.map((key) => [
          key,
          selected.every((r) => r[key] === selected[0][key]) ? selected[0][key] : '',
        ]),
      ),
    );
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
      const records = manager.getState().drawings;
      if (
        single &&
        editing === null &&
        drawingRevisionHistory(records.find((r) => r.id === id)).some(
          (r) => r.revision === fields.revision.trim(),
        )
      )
        throw Error('Beteckningen finns redan. Välj revisionen i listan för att redigera den.');
      manager.change(
        single && editing !== null
          ? editDrawingRevision(records, id, editing, fields)
          : applyDrawingRevision(records, ids, fields),
      );
      manager.visibleAttributes.add('drawing.revision');
      manager.render();
      if (single) {
        editing = fields.revision.trim();
        fill(revisionValues(fields));
        renderList();
      } else close();
    } catch (failure) {
      error.textContent = failure.message;
    }
  };
  document.body.append(dialog);
  dialog.showModal();
}
