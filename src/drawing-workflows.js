import {
  planDrawingNumbering,
  applyDrawingNumbering,
  batchDrawingGroups,
  createBatchDrawings,
} from './single-part-drawings.js';
const element = (tag, text, className) => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (className) e.className = className;
  return e;
};
function dialog(title) {
  const d = document.createElement('dialog');
  d.className = 'drawing-workflow';
  const header = element('header'),
    name = element('strong', title),
    close = element('button', '×');
  close.setAttribute('aria-label', 'Stäng ' + title);
  close.onclick = () => d.close();
  header.append(name, close);
  d.append(header);
  d.addEventListener('keydown', (e) => e.stopPropagation());
  document.body.append(d);
  return d;
}
export async function numberWithDrawings(manager) {
  manager.beforeNumber?.();
  const state = manager.getState(),
    plan = planDrawingNumbering(state.objects, state.parts, state.drawings),
    merges = plan.groups.filter((g) => g.merged);
  let choices = {};
  if (merges.length) {
    const answer = await chooseMerges(plan, merges, manager);
    if (!answer) return false;
    choices = answer;
  }
  const next = applyDrawingNumbering(plan, choices);
  manager.number(next.parts, next.drawings);
  manager.render();
  return true;
}
function chooseMerges(plan, merges, manager) {
  return new Promise((resolve) => {
    const d = dialog('Sammanslagning av detaljer'),
      intro = element(
        'p',
        'Välj vilken ritning som ska behållas. Övriga ritningar i gruppen tas bort från den aktiva listan när du tillämpar numreringen. Ångra återställer hela ändringen.',
      ),
      body = element('div', null, 'workflow-content'),
      choices = {},
      required = [];
    d.append(intro, body);
    for (const g of merges) {
      const section = element('section', null, 'merge-group');
      section.append(element('h3', `${g.mark} · ${g.objects.length} objekt blir samma detaljtyp`));
      const table = element('table', null, 'drawing-table');
      table.innerHTML =
        '<thead><tr><th>Behåll</th><th>Tidigare part mark</th><th>Ritning</th><th>Innehåll</th></tr></thead>';
      const tbody = element('tbody');
      table.append(tbody);
      const rows = g.candidates.map((r) => ({ drawing: r, mark: r.mark }));
      for (const origin of g.origins) if (!origin.drawings.length) rows.push({ mark: origin.mark });
      if (!rows.length) rows.push({ mark: g.mark });
      for (const row of rows) {
        const tr = element('tr'),
          choose = element('td'),
          r = row.drawing;
        if (r) {
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'keep-' + merges.indexOf(g);
          radio.setAttribute('aria-label', `Behåll ${r.number} för ${g.mark}`);
          radio.checked = g.candidates.length === 1;
          if (radio.checked) choices[g.key] = r.id;
          radio.onchange = () => {
            choices[g.key] = r.id;
            update();
          };
          choose.append(radio);
        } else choose.textContent = '—';
        tr.append(
          choose,
          element('td', row.mark),
          element('td', r ? `${r.number} · ${r.name}` : 'Ingen ritning'),
          element(
            'td',
            r
              ? `${r.sheet ? '3 vyer' : 'Ej öppnad'} · ${(r.annotations || []).length} mått / texter`
              : '—',
          ),
        );
        tbody.append(tr);
      }
      section.append(table);
      if (g.candidates.length > 1) required.push(g.key);
      else if (!g.candidates.length)
        section.append(
          element('p', 'Ingen ritning finns. Skapa en gemensam ritning från batchlistan.'),
        );
      body.append(section);
    }
    const footer = element('div', null, 'workflow-actions'),
      cancel = element('button', 'Avbryt'),
      apply = element('button', 'Tillämpa numrering', 'primary');
    const update = () => (apply.disabled = required.some((k) => !choices[k]));
    update();
    cancel.onclick = () => d.close();
    let result = null;
    apply.onclick = () => {
      result = choices;
      d.close();
    };
    footer.append(cancel, apply);
    d.append(footer);
    d.addEventListener(
      'close',
      () => {
        d.remove();
        resolve(result);
      },
      { once: true },
    );
    d.showModal();
  });
}
export function showDrawingBatch(manager) {
  const reopenManager = manager.dialog.open;
  if (reopenManager) manager.dialog.close();
  const initial = manager.getState(),
    selection = new Set(initial.selected),
    d = dialog('Single Part från markering');
  d.classList.add('drawing-batch');
  const intro = element(
      'p',
      `${selection.size} markerade objekt. En rad per detaljtyp. Klicka på raden för att framhäva objekten i modellen.`,
    ),
    content = element('div', null, 'workflow-content'),
    message = element('p'),
    footer = element('div', null, 'workflow-actions'),
    all = element('button', 'Välj alla utan ritning'),
    number = element('button', 'Numrera detaljer'),
    create = element('button', 'Skapa valda', 'primary'),
    close = element('button', 'Stäng');
  message.setAttribute('role', 'status');
  d.append(intro, content, message, footer);
  footer.append(all, number, close, create);
  let checked = new Set();
  const render = () => {
    const state = manager.getState(),
      groups = batchDrawingGroups(state, selection);
    content.replaceChildren();
    if (!groups.length) {
      content.append(element('p', 'Markera sweeps eller plates i modellen först.'));
      create.disabled = true;
      return;
    }
    const table = element('table', null, 'drawing-table');
    table.innerHTML =
      '<thead><tr><th>Skapa</th><th>Detalj / profil</th><th>Valda / totalt</th><th>Ritning</th></tr></thead>';
    const tbody = element('tbody');
    table.append(tbody);
    const update = () => {
      create.disabled = !groups.some((g) => g.valid && !g.drawing && checked.has(g.key));
      create.textContent = `Skapa valda (${groups.filter((g) => g.valid && !g.drawing && checked.has(g.key)).length})`;
    };
    for (const g of groups) {
      const row = element('tr'),
        cell = element('td'),
        check = document.createElement('input');
      check.type = 'checkbox';
      check.disabled = !g.valid || !!g.drawing;
      check.checked = !check.disabled && checked.has(g.key);
      check.setAttribute('aria-label', 'Skapa ritning ' + g.mark);
      check.onchange = () => {
        check.checked ? checked.add(g.key) : checked.delete(g.key);
        update();
      };
      cell.append(check);
      const info = element('td'),
        title = element('button', g.mark);
      title.onclick = () => manager.highlight?.(g.objects.map((o) => o.id));
      info.append(
        title,
        element(
          'small',
          `${g.source.name || ''} · ${g.source.type === 'plate' ? 'Plate' : g.source.section?.name || g.source.profile || 'Sweep'}`,
        ),
      );
      row.onclick = (e) => {
        if (e.target.closest('input,button')) return;
        manager.highlight?.(g.objects.map((o) => o.id));
        for (const r of tbody.children) r.classList.toggle('batch-highlight', r === row);
      };
      const drawingCell = element('td');
      if (g.drawing) {
        const open = element('button', g.drawing.number + ' · Öppna');
        open.onclick = () => manager.open({ ...g.drawing, sourceId: g.source.id });
        drawingCell.append(open);
      } else drawingCell.textContent = g.valid ? 'Saknas' : 'Numrering krävs';
      row.append(cell, info, element('td', `${g.objects.length} / ${g.all.length}`), drawingCell);
      tbody.append(row);
    }
    content.append(table);
    update();
  };
  all.onclick = () => {
    checked = new Set(
      batchDrawingGroups(manager.getState(), selection)
        .filter((g) => g.valid && !g.drawing)
        .map((g) => g.key),
    );
    render();
  };
  number.onclick = async () => {
    number.disabled = true;
    try {
      if (await numberWithDrawings(manager)) {
        checked.clear();
        render();
        message.textContent = 'Numrering klar. Välj vilka ritningar som ska skapas.';
      }
    } catch (e) {
      message.textContent = e.message;
    } finally {
      number.disabled = false;
    }
  };
  create.onclick = () => {
    const state = manager.getState(),
      next = createBatchDrawings(state, selection, checked);
    manager.change(next);
    checked.clear();
    render();
    manager.render();
    const count = next.length - state.drawings.length;
    message.textContent = `${count} ${count === 1 ? 'ritning skapad' : 'ritningar skapade'}.`;
  };
  close.onclick = () => d.close();
  d.addEventListener(
    'close',
    () => {
      manager.highlight?.([...selection]);
      d.remove();
      if (reopenManager) {
        manager.render();
        manager.dialog.showModal();
      }
    },
    { once: true },
  );
  render();
  d.showModal();
}
