import { isPhysical } from './model-object.js';
import { createAssembly, removeAssembly, assemblyValid } from './project/assemblies.js';
import { showDrawingBatch } from './drawing-workflows.js';
import { numberAssembliesWithDrawings } from './assembly-numbering-workflow.js';
import { assemblyNumberStatus, drawingForAssembly } from './assembly-numbering.js';
import { editAssembly } from './assembly-editor.js';

const element = (tag, text) => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
};
export function showAssemblies(manager) {
  manager.beforeNumber?.();
  let reopen = manager.dialog.open;
  if (reopen) manager.dialog.close();
  const selected = new Set(manager.getState().selected);
  const candidates = manager.getState().objects.filter((o) => selected.has(o.id) && isPhysical(o));
  const d = element('dialog');
  d.className = 'drawing-workflow';
  d.setAttribute('aria-label', 'Assemblies');
  const header = element('header'),
    close = element('button', 'Stäng');
  header.append(element('strong', 'Assemblies · Sammanställningar'), close);
  close.onclick = () => d.close();
  const intro = element(
      'p',
      'Markera minst två delar i modellen. Huvuddelen styr ritningsvyernas riktning. Varje del kan ingå i en assembly.',
    ),
    form = element('div'),
    nameLabel = element('label', 'Namn'),
    name = element('input'),
    mainLabel = element('label', 'Huvuddel'),
    main = element('select'),
    create = element('button', 'Skapa assembly från markering'),
    number = element('button', 'Numrera assemblies'),
    list = element('div'),
    message = element('p');
  form.className = 'batch-setup';
  list.className = 'workflow-content';
  name.setAttribute('aria-label', 'Assemblynamn');
  name.maxLength = 200;
  main.setAttribute('aria-label', 'Huvuddel');
  main.append(...candidates.map((o) => new Option(o.name || o.id, o.id)));
  nameLabel.append(name);
  mainLabel.append(main);
  create.disabled = candidates.length < 2;
  message.setAttribute('role', 'status');
  form.append(nameLabel, mainLabel, create, number);
  d.append(header, intro, form, list, message);
  document.body.append(d);
  d.addEventListener('keydown', (e) => e.stopPropagation());
  const render = () => {
    list.replaceChildren();
    const state = manager.getState();
    if (!state.assemblies?.length) {
      list.append(element('p', 'Inga assemblies skapade.'));
      return;
    }
    const table = element('table');
    table.className = 'drawing-table';
    const head = element('tr');
    for (const title of ['Assembly', 'Huvuddel / antal', 'Ritning', 'Åtgärder'])
      head.append(element('th', title));
    const thead = element('thead');
    thead.append(head);
    table.append(thead);
    const body = element('tbody');
    table.append(body);
    for (const a of state.assemblies) {
      const row = element('tr'),
        identity = element('td'),
        info = element('td'),
        drawingCell = element('td'),
        actions = element('td');
      const highlight = element('button', `${a.mark} · ${a.name}`);
      highlight.onclick = () =>
        manager.highlight?.(a.memberIds.filter((id) => state.objects.some((o) => o.id === id)));
      identity.append(highlight);
      const valid = assemblyValid(a, state.objects);
      info.textContent = valid
        ? `${state.objects.find((o) => o.id === a.mainId)?.name || a.mainId} · ${a.memberIds.length} delar`
        : 'Delar saknas i modellen';
      if (valid && !assemblyNumberStatus(a, state).valid) info.textContent += ' · Numrering krävs';
      const drawing = drawingForAssembly(state, a),
        open = element('button', drawing ? `${drawing.number} · Öppna` : 'Skapa ritning…');
      open.disabled = !valid;
      open.onclick = () => {
        reopen = false;
        d.close();
        showDrawingBatch(manager, 'AS', a.memberIds);
      };
      drawingCell.append(open);
      const remove = element('button', 'Ta bort assembly');
      remove.title =
        'Tar bort gruppen. En gemensam ritning behålls om typen har fler instanser. Delarna finns kvar i modellen. Kan ångras.';
      remove.onclick = () => {
        manager.changeAssemblies(removeAssembly(manager.getState(), a.id));
        render();
        manager.render();
        message.textContent = 'Assembly borttagen. Kan ångras i modellen.';
      };
      const edit = element('button', 'Redigera assembly');
      edit.onclick = () =>
        editAssembly(manager, a.id, () => {
          render();
          manager.render();
          message.textContent = `${a.mark} uppdaterad. Granska assemblyritningen.`;
        });
      actions.append(edit, remove);
      row.append(identity, info, drawingCell, actions);
      body.append(row);
    }
    list.append(table);
  };
  number.onclick = async () => {
    number.disabled = true;
    try {
      if (await numberAssembliesWithDrawings(manager)) {
        render();
        message.textContent = 'Assemblies numrerade. Lika grupper delar nummer, namn och ritning.';
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      number.disabled = false;
    }
  };
  create.onclick = () => {
    try {
      const state = manager.getState(),
        a = createAssembly(
          state,
          candidates.map((o) => o.id),
          main.value,
          name.value,
        );
      manager.changeAssemblies({
        assemblies: [...(state.assemblies || []), a],
        drawings: state.drawings,
      });
      render();
      manager.render();
      message.textContent = `${a.mark} skapad. Välj Skapa ritning för att öppna den gemensamma listan.`;
    } catch (error) {
      message.textContent = error.message;
    }
  };
  d.addEventListener(
    'close',
    () => {
      d.remove();
      if (reopen) {
        manager.render();
        manager.dialog.showModal();
      }
    },
    { once: true },
  );
  render();
  d.showModal();
}
