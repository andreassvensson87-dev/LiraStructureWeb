import {
  normalizeAssemblySchedule,
  assemblyScheduleTable,
  newMaterialSchedule,
  materialScheduleFields,
} from './assembly-schedule.js';
const modelFields = ['mark', 'quantity', 'length', 'weight'];
const node = (tag, text) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
};
/** Work on a draft; cancelling never changes the drawing. */
export function editAssemblySchedule(settings, rows, save) {
  const draft = normalizeAssemblySchedule(settings),
    dialog = node('dialog');
  dialog.className = 'drawing-workflow';
  dialog.setAttribute('aria-label', 'Redigera stycklista');
  const header = node('header'),
    cancel = node('button', 'Avbryt');
  header.append(node('strong', 'Redigera stycklista'), cancel);
  cancel.onclick = () => dialog.close();
  dialog.append(
    header,
    node(
      'p',
      'Detaljnummer, antal, längd och vikt följer modellen. Vikt avser radens sammanlagda vikt per assembly och visas som — när densitet saknas. Profil/namn, material, anvisningar och egna fält kan ändras för den här ritningen. Ändrad tillverkningsdel får en ny rad utan tidigare textändringar.',
    ),
  );
  const setup = node('div');
  setup.className = 'batch-setup';
  const labelField = (title, input) => {
    const label = node('label', title);
    input.setAttribute('aria-label', title);
    label.append(input);
    return label;
  };
  const size = node('input');
  const style = node('select');
  style.append(
    new Option('Materiallista · enligt exempel', 'material'),
    new Option('Stycklista · tabell', 'table'),
  );
  style.value = draft.style;
  style.onchange = () => {
    const preset = style.value === 'material' ? newMaterialSchedule() : normalizeAssemblySchedule();
    draft.style = preset.style;
    draft.dockToTitle = preset.dockToTitle;
    draft.columns = preset.columns;
    draft.textSize = preset.textSize;
    size.value = draft.textSize;
    notes.hidden = draft.style !== 'material';
    renderColumns();
    renderRows();
  };
  size.type = 'number';
  size.min = '1';
  size.max = '10';
  size.step = '0.1';
  size.value = draft.textSize;
  size.oninput = () => {
    if (size.value.trim())
      draft.textSize = normalizeAssemblySchedule({ textSize: size.value }).textSize;
  };
  size.onchange = () => {
    draft.textSize = normalizeAssemblySchedule({ textSize: size.value }).textSize;
    size.value = draft.textSize;
  };
  const sort = node('select');
  for (const [id, title] of [
    ['mark', 'Detalj'],
    ['name', 'Profil / namn'],
    ['material', 'Material'],
    ['quantity', 'Antal'],
    ['length', 'Längd'],
    ['weight', 'Vikt'],
  ])
    sort.append(new Option(title, id));
  sort.value = draft.sort;
  sort.onchange = () => {
    draft.sort = sort.value;
    renderRows();
  };
  const direction = node('select');
  direction.append(new Option('Stigande', 'up'), new Option('Fallande', 'down'));
  direction.value = draft.descending ? 'down' : 'up';
  direction.onchange = () => {
    draft.descending = direction.value === 'down';
    renderRows();
  };
  setup.append(
    labelField('Utseende (återställer kolumner)', style),
    labelField('Textstorlek · mm', size),
    labelField('Sortera efter', sort),
    labelField('Sorteringsriktning', direction),
  );
  dialog.append(setup);
  const notes = node('div');
  notes.className = 'batch-setup';
  notes.hidden = draft.style !== 'material';
  for (const [id, title] of materialScheduleFields) {
    const input = node('input');
    input.maxLength = 200;
    input.value = draft.notes[id];
    input.oninput = () => {
      draft.notes[id] = input.value;
    };
    notes.append(labelField(title, input));
  }
  dialog.append(notes);
  const columns = node('div'),
    cells = node('div');
  columns.className = cells.className = 'workflow-content';
  dialog.append(node('h3', 'Kolumner'), columns);
  const add = node('button', 'Lägg till eget fält');
  add.onclick = () => {
    if (draft.columns.length >= 20) return;
    draft.columns.push({
      id: `custom-${crypto.randomUUID()}`,
      title: 'Eget fält',
      width: 30,
      visible: true,
    });
    renderColumns();
    renderRows();
  };
  dialog.append(add, node('h3', 'Radtexter'), cells);
  function renderRows() {
    cells.replaceChildren();
    const data = assemblyScheduleTable(rows, draft),
      table = node('table');
    table.className = 'drawing-table';
    const head = node('tr');
    head.append(node('th', 'Detalj (från modellen)'));
    for (const c of data.columns.filter((c) => !['mark', 'quantity'].includes(c.id)))
      head.append(node('th', c.title));
    head.append(node('th', 'Antal (från modellen)'));
    table.append(head);
    for (const row of data.rows) {
      const tr = node('tr');
      tr.append(node('td', row.mark));
      for (const c of data.columns.filter((c) => !['mark', 'quantity'].includes(c.id))) {
        const td = node('td'),
          input = node('input');
        if (modelFields.includes(c.id)) {
          td.textContent = data.values[data.rows.indexOf(row) + 1][data.columns.indexOf(c)];
          tr.append(td);
          continue;
        }
        input.maxLength = 200;
        input.value = draft.cells[row.key]?.[c.id] ?? row[c.id] ?? '';
        input.setAttribute('aria-label', `${row.mark} · ${c.title}`);
        input.oninput = () => {
          (draft.cells[row.key] ??= {})[c.id] = input.value;
        };
        td.append(input);
        tr.append(td);
      }
      tr.append(node('td', String(row.quantity)));
      table.append(tr);
    }
    cells.append(table);
  }
  function renderColumns() {
    columns.replaceChildren();
    const table = node('table');
    table.className = 'drawing-table';
    const head = node('tr');
    for (const title of ['Visa', 'Rubrik', 'Bredd · mm', 'Ordning']) head.append(node('th', title));
    table.append(head);
    draft.columns.forEach((column, index) => {
      const tr = node('tr'),
        visible = node('input'),
        title = node('input'),
        width = node('input');
      visible.type = 'checkbox';
      visible.checked = column.visible;
      visible.setAttribute('aria-label', `Visa kolumn ${column.title}`);
      visible.onchange = () => {
        column.visible = visible.checked;
        renderRows();
      };
      title.value = column.title;
      title.maxLength = 80;
      title.setAttribute('aria-label', `Rubrik ${index + 1}`);
      title.oninput = () => {
        column.title = title.value;
        renderRows();
      };
      title.onchange = () => {
        column.title = title.value;
        renderColumns();
        renderRows();
      };
      width.type = 'number';
      width.min = '5';
      width.step = '0.5';
      width.max = '300';
      width.value = column.width;
      width.setAttribute('aria-label', `Bredd ${index + 1} · mm`);
      width.oninput = () => {
        if (width.value.trim())
          column.width = normalizeAssemblySchedule({
            columns: [{ ...column, width: width.value }],
          }).columns[0].width;
      };
      width.onchange = () => {
        column.width = normalizeAssemblySchedule({
          columns: [{ ...column, width: width.value }],
        }).columns[0].width;
        width.value = column.width;
      };
      for (const input of [visible, title, width]) {
        const td = node('td');
        td.append(input);
        tr.append(td);
      }
      const actions = node('td');
      for (const [text, offset] of [
        ['Flytta upp', -1],
        ['Flytta ned', 1],
      ]) {
        const button = node('button', text);
        button.setAttribute('aria-label', `${text} kolumn ${index + 1}`);
        button.disabled = index + offset < 0 || index + offset >= draft.columns.length;
        button.onclick = () => {
          [draft.columns[index], draft.columns[index + offset]] = [
            draft.columns[index + offset],
            draft.columns[index],
          ];
          renderColumns();
          renderRows();
        };
        actions.append(button);
      }
      if (column.id.startsWith('custom-')) {
        const remove = node('button', 'Ta bort fält');
        remove.onclick = () => {
          draft.columns.splice(index, 1);
          renderColumns();
          renderRows();
        };
        actions.append(remove);
      }
      tr.append(actions);
      table.append(tr);
    });
    columns.append(table);
    add.disabled = draft.columns.length >= 20;
  }
  const reset = node('button', 'Återställ radtexter');
  reset.onclick = () => {
    draft.cells = {};
    renderRows();
  };
  const apply = node('button', 'Spara stycklista');
  apply.onclick = () => {
    save(normalizeAssemblySchedule(draft));
    dialog.close();
  };
  dialog.append(reset, apply);
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  renderColumns();
  renderRows();
  dialog.showModal();
}
