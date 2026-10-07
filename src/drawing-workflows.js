import { TEMPLATE_KEY, readDrawingTemplates } from './drawing-templates.js';
import { drawingPresetPicker, selectedDrawingPreset } from './drawing-presets.js';
import { planDrawingNumbering, applyDrawingNumbering } from './single-part-drawings.js';
import { drawingCreationGroups, createSelectedDrawings } from './drawing-creation.js';
import { showAssemblies } from './assembly-workflow.js';
import { numberAssembliesWithDrawings } from './assembly-numbering-workflow.js';
const element = (tag, text, className) => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (className) e.className = className;
  return e;
};
function dialog(title) {
  const d = document.createElement('dialog');
  d.className = 'drawing-workflow';
  d.setAttribute('aria-label', title);
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
  if (manager.openNumbering) return manager.openNumbering({ parts: true, assemblies: false });
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
export function showDrawingBatch(manager, initialType = 'all', initialSelection = null) {
  manager.beforeNumber?.();
  let reopenManager = manager.dialog.open,
    openingDrawing = false;
  if (reopenManager) manager.dialog.close();
  const initial = manager.getState(),
    selectedIds = new Set(initialSelection || initial.selected),
    d = dialog('Skapa ritningar');
  let selection = selectedIds.size ? selectedIds : new Set(initial.objects.map((o) => o.id));
  d.classList.add('drawing-batch');
  const intro = element(
      'p',
      'Single Part och Assembly i samma lista. En ritning per typ. Klicka på en rad för att framhäva delarna i modellen.',
    ),
    content = element('div', null, 'workflow-content'),
    message = element('p'),
    footer = element('div', null, 'workflow-actions'),
    all = element('button', 'Välj alla utan ritning'),
    number = element('button', 'Numrera detaljer'),
    create = element('button', 'Skapa valda', 'primary'),
    close = element('button', 'Stäng'),
    clear = element('button', 'Avmarkera alla'),
    summary = element('div', null, 'batch-summary'),
    selectionCount = element('span', null, 'batch-selection-count'),
    setup = element('div', null, 'batch-setup'),
    selectionBar = element('div', null, 'batch-selectionbar');
  message.setAttribute('role', 'status');
  message.className = 'batch-feedback';
  const preset = drawingPresetPicker('Inställningar för nya ritningar');
  const templates = readDrawingTemplates();
  const templateLabel = element('label', 'Single Part · Ritningsmall'),
    templateSelect = document.createElement('select');
  templateSelect.setAttribute('aria-label', 'Ritningsmall');
  templateSelect.append(
    new Option('Ingen mall · standardvyer', ''),
    ...templates.map((t) => new Option(t.name, t.id)),
  );
  templateLabel.append(templateSelect);
  const removeTemplate = element('button', 'Ta bort mall');
  removeTemplate.type = 'button';
  removeTemplate.disabled = true;
  templateSelect.onchange = () => {
    preset.select.disabled = typeSelect.value === 'SP' && !!templateSelect.value;
    removeTemplate.disabled = !templateSelect.value;
    removeTemplate.textContent = 'Ta bort mall';
  };
  removeTemplate.onclick = () => {
    const id = templateSelect.value;
    if (!id) return;
    if (removeTemplate.textContent !== 'Bekräfta borttagning') {
      removeTemplate.textContent = 'Bekräfta borttagning';
      message.textContent = 'Klicka igen för att ta bort mallen. Befintliga ritningar behålls.';
      return;
    }
    try {
      localStorage.setItem(
        TEMPLATE_KEY,
        JSON.stringify(readDrawingTemplates().filter((t) => t.id !== id)),
      );
      templateSelect.selectedOptions[0].remove();
      templateSelect.value = '';
      templateSelect.onchange();
    } catch {
      message.textContent = 'Mallen kunde inte tas bort.';
    }
  };
  const typeLabel = element('label', 'Ritningstyp'),
    typeSelect = document.createElement('select');
  typeSelect.setAttribute('aria-label', 'Ritningstyp att skapa');
  typeSelect.append(
    new Option('Alla typer', 'all'),
    new Option('Single Part', 'SP'),
    new Option('Assembly', 'AS'),
  );
  typeSelect.value = initialType;
  typeLabel.append(typeSelect);
  const scopeLabel = element('label', 'Urval'),
    scopeSelect = document.createElement('select');
  scopeSelect.setAttribute('aria-label', 'Urval för ritningar');
  scopeSelect.append(
    new Option('Hela modellen', 'all'),
    new Option('Markerade objekt', 'selected'),
  );
  scopeSelect.value = selectedIds.size ? 'selected' : 'all';
  scopeLabel.append(scopeSelect);
  const manageAssemblies = element('button', 'Hantera assemblies');
  manageAssemblies.onclick = () =>
    showAssemblies(manager, (assembly) => {
      if (assembly) {
        typeSelect.value = 'AS';
        scopeSelect.value = 'all';
        selection = new Set(manager.getState().objects.map((o) => o.id));
      }
      checked = availableKeys();
      render();
    });
  const setupActions = element('div', null, 'batch-setup-actions');
  setupActions.append(removeTemplate, number, manageAssemblies);
  setup.append(typeLabel, scopeLabel, templateLabel, preset.label, setupActions);
  const groupsForList = () =>
    drawingCreationGroups(manager.getState(), selection, typeSelect.value);
  selectionBar.append(selectionCount, all, clear);
  d.append(summary, intro, setup, selectionBar, content, message, footer);
  footer.append(close, create);
  const availableKeys = () =>
    new Set(
      groupsForList()
        .filter((g) => g.valid && !g.drawing)
        .map((g) => g.key),
    );
  let checked = availableKeys();
  const render = () => {
    const groups = groupsForList();
    content.replaceChildren();
    const unnumbered = groups.filter((g) => !g.valid).length;
    summary.replaceChildren(
      ...[
        [groups.filter((g) => g.type === 'SP').length, 'Single Part-typer'],
        [groups.filter((g) => g.type === 'AS').length, 'assemblytyper'],
        [groups.filter((g) => g.drawing).length, 'har ritning'],
      ].map(([count, label]) => {
        const item = element('span');
        item.append(element('strong', String(count)), ' ' + label);
        return item;
      }),
    );
    number.textContent = unnumbered ? `Numrera (${unnumbered})` : 'Uppdatera numrering';
    templateLabel.hidden = typeSelect.value === 'AS';
    number.classList.toggle('batch-number-needed', !!unnumbered);
    number.disabled = !groups.length;
    all.disabled = !groups.some((g) => g.valid && !g.drawing);
    preset.select.disabled =
      !groups.length || (typeSelect.value === 'SP' && !!templateSelect.value);
    if (!groups.length) {
      content.append(
        element(
          'p',
          'Inga typer i detta urval. Byt filter eller urval. Skapa assemblygrupper med Hantera assemblies.',
          'batch-empty',
        ),
      );
      selectionCount.textContent = 'Inga detaljer valda';
      clear.disabled = true;
      create.textContent = 'Skapa ritningar';
      create.disabled = true;
      return;
    }
    const table = element('table', null, 'drawing-table');
    table.innerHTML =
      '<thead><tr><th>Skapa</th><th>Typ</th><th>Detalj / assembly</th><th>Antal i urval / modell</th><th>Ritning</th></tr></thead>';
    const tbody = element('tbody');
    table.append(tbody);
    const update = () => {
      const count = groups.filter((g) => g.valid && !g.drawing && checked.has(g.key)).length;
      create.disabled = count === 0;
      clear.disabled = count === 0;
      selectionCount.textContent = `${count} av ${groups.filter((g) => g.valid && !g.drawing).length} nya ritningar valda`;
      create.textContent = count
        ? `Skapa ${count} ${count === 1 ? 'ritning' : 'ritningar'}`
        : 'Skapa ritningar';
    };
    for (const g of groups) {
      const row = element('tr'),
        cell = element('td'),
        check = document.createElement('input');
      check.type = 'checkbox';
      check.disabled = !g.valid || !!g.drawing;
      check.checked = !check.disabled && checked.has(g.key);
      check.setAttribute(
        'aria-label',
        `Skapa ${g.type === 'AS' ? 'Assembly' : 'Single Part'} ${g.mark}`,
      );
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
          g.type === 'AS'
            ? `${g.name} · ${g.source.memberIds.length} delar per assembly`
            : `${g.source.name || ''} · ${g.source.type === 'plate' ? 'Plate' : g.source.section?.name || g.source.profile || 'Sweep'}`,
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
        open.disabled = !g.valid;
        open.onclick = () => {
          reopenManager = false;
          openingDrawing = true;
          d.close();
          manager.open(g.type === 'AS' ? g.drawing : { ...g.drawing, sourceId: g.sourceId });
        };
        drawingCell.append(open);
        if (!g.valid)
          drawingCell.append(element('span', 'Numrering krävs', 'batch-badge batch-badge-warning'));
      } else
        drawingCell.append(
          element(
            'span',
            g.valid ? 'Ny ritning' : 'Numrering krävs',
            g.valid ? 'batch-badge' : 'batch-badge batch-badge-warning',
          ),
        );
      row.append(
        cell,
        element('td', g.type === 'AS' ? 'Assembly' : 'Single Part'),
        info,
        element(
          'td',
          `${g.type === 'AS' ? g.assemblyIds.length : g.objects.length} / ${g.all.length}`,
        ),
        drawingCell,
      );
      tbody.append(row);
    }
    content.append(table);
    update();
  };
  all.onclick = () => {
    checked = availableKeys();
    render();
  };
  clear.onclick = () => {
    checked.clear();
    render();
  };
  number.onclick = async () => {
    number.disabled = true;
    try {
      if ((await numberWithDrawings(manager)) && (await numberAssembliesWithDrawings(manager))) {
        checked = availableKeys();
        render();
        message.textContent = 'Numrering klar. Granska typerna och skapa valda ritningar.';
      }
    } catch (e) {
      message.textContent = e.message;
    } finally {
      render();
    }
  };
  create.onclick = () => {
    try {
      const state = manager.getState(),
        next = createSelectedDrawings(
          state,
          selection,
          new Set(
            groupsForList()
              .filter((g) => checked.has(g.key))
              .map((g) => g.key),
          ),
          selectedDrawingPreset(preset.select.value),
          templates.find((t) => t.id === templateSelect.value) || null,
        );
      manager.change(next);
      checked.clear();
      render();
      manager.render();
      const count = next.length - state.drawings.length;
      message.textContent = `${count} ${count === 1 ? 'ritning skapad' : 'ritningar skapade'}. Öppna en ritning från listan eller stäng för att återgå.`;
    } catch (error) {
      message.textContent = error.message;
    }
  };
  typeSelect.onchange = () => {
    checked = availableKeys();
    render();
  };
  scopeSelect.onchange = () => {
    selection =
      scopeSelect.value === 'selected'
        ? selectedIds
        : new Set(manager.getState().objects.map((o) => o.id));
    checked = availableKeys();
    render();
  };
  close.onclick = () => d.close();
  d.addEventListener(
    'close',
    () => {
      if (reopenManager || !openingDrawing) manager.highlight?.([...selectedIds]);
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
