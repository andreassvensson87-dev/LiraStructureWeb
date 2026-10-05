import { isPhysical } from './model-object.js';
import { designation } from './object-identity.js';
import { updateAssembly } from './project/assemblies.js';

const node = (tag, text) => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
};
/** Draft membership stays outside project history until Save. */
export function editAssembly(manager, id, changed) {
  const state = manager.getState(),
    assembly = state.assemblies.find((a) => a.id === id);
  if (!assembly) return;
  const draft = structuredClone(assembly),
    d = node('dialog');
  d.className = 'drawing-workflow';
  d.setAttribute('aria-label', `Redigera assembly ${assembly.mark}`);
  const header = node('header'),
    close = node('button', 'Avbryt');
  header.append(node('strong', `Redigera ${assembly.mark}`), close);
  close.onclick = () => d.close();
  const nameLabel = node('label', 'Namn'),
    name = node('input'),
    mainLabel = node('label', 'Huvuddel'),
    main = node('select'),
    setup = node('div'),
    list = node('div'),
    addBar = node('div'),
    addSelect = node('select'),
    add = node('button', 'Lägg till del'),
    addSelected = node('button', 'Lägg till markerade delar'),
    message = node('p'),
    footer = node('div'),
    save = node('button', 'Spara assembly');
  name.value = draft.name;
  name.maxLength = 200;
  name.setAttribute('aria-label', 'Assemblynamn');
  main.setAttribute('aria-label', 'Huvuddel');
  main.onchange = () => {
    draft.mainId = main.value;
    render();
  };
  nameLabel.append(name);
  mainLabel.append(main);
  setup.append(nameLabel, mainLabel);
  setup.className = 'batch-setup';
  list.className = 'workflow-content';
  addBar.className = 'batch-setup';
  addSelect.setAttribute('aria-label', 'Del att lägga till');
  const addLabel = node('label', 'Lägg till del');
  addLabel.append(addSelect);
  addBar.append(addLabel, add, addSelected);
  message.setAttribute('role', 'status');
  footer.className = 'workflow-actions';
  save.className = 'primary';
  footer.append(save);
  d.append(
    header,
    node(
      'p',
      'Namnbyte gäller hela den numrerade typen. Ändrade delar eller huvuddel kan ge ett nytt A-nummer vid Numrera assemblies. Befintliga vyer och mått behåller sin riktning när du byter huvuddel; nya vyer följer den nya huvuddelen. Borttagna delar kan lämna brutna måttkopplingar som behöver granskas.',
    ),
    setup,
    list,
    addBar,
    message,
    footer,
  );
  d.addEventListener('keydown', (e) => e.stopPropagation());
  const render = () => {
    const current = manager.getState(),
      byId = new Map(current.objects.map((o) => [o.id, o]));
    main.replaceChildren(
      new Option('Välj huvuddel', ''),
      ...draft.memberIds
        .filter((id) => byId.has(id))
        .map((id) => new Option(`${designation(byId.get(id))} · ${byId.get(id).name || ''}`, id)),
    );
    main.value =
      draft.memberIds.includes(draft.mainId) && byId.has(draft.mainId) ? draft.mainId : '';
    list.replaceChildren();
    const table = node('table');
    table.className = 'drawing-table';
    const thead = node('thead'),
      headings = node('tr');
    for (const title of ['Del', 'Roll', 'Åtgärd']) headings.append(node('th', title));
    thead.append(headings);
    table.append(thead);
    const body = node('tbody');
    table.append(body);
    for (const id of draft.memberIds) {
      const object = byId.get(id),
        row = node('tr'),
        action = node('td'),
        remove = node('button', 'Ta bort del');
      remove.setAttribute(
        'aria-label',
        `Ta bort ${object ? designation(object) : id} från assembly`,
      );
      remove.onclick = () => {
        draft.memberIds = draft.memberIds.filter((member) => member !== id);
        if (draft.mainId === id) draft.mainId = '';
        render();
      };
      action.append(remove);
      row.append(
        node(
          'td',
          object ? `${designation(object)} · ${object.name || ''}` : `${id} · Saknas i modellen`,
        ),
        node('td', id === draft.mainId ? 'Huvuddel' : 'Del'),
        action,
      );
      body.append(row);
    }
    list.append(table);
    const otherMembers = new Set(
      (current.assemblies || []).filter((a) => a.id !== assembly.id).flatMap((a) => a.memberIds),
    );
    const available = current.objects.filter(
      (o) => isPhysical(o) && !draft.memberIds.includes(o.id) && !otherMembers.has(o.id),
    );
    addSelect.replaceChildren(
      ...available.map((o) => new Option(`${designation(o)} · ${o.name || ''}`, o.id)),
    );
    add.disabled = !available.length;
    addSelected.disabled = ![...current.selected].some((id) => available.some((o) => o.id === id));
  };
  add.onclick = () => {
    if (addSelect.value) draft.memberIds.push(addSelect.value);
    render();
  };
  addSelected.onclick = () => {
    const current = manager.getState();
    const ids = [...current.selected].filter(
      (id) =>
        current.objects.some((o) => o.id === id && isPhysical(o)) && !draft.memberIds.includes(id),
    );
    if (
      current.assemblies.some(
        (a) => a.id !== assembly.id && a.memberIds.some((id) => ids.includes(id)),
      )
    ) {
      message.textContent =
        'En markerad del ingår i en annan assembly. Flytta den från den gruppen först.';
      return;
    }
    draft.memberIds.push(...ids);
    render();
  };
  save.onclick = () => {
    try {
      const next = updateAssembly(manager.getState(), assembly.id, {
        ...draft,
        mainId: main.value,
        name: name.value,
      });
      manager.changeAssemblies(next);
      changed?.();
      d.close();
    } catch (error) {
      message.textContent = error.message;
    }
  };
  document.body.append(d);
  d.addEventListener('close', () => d.remove(), { once: true });
  render();
  d.showModal();
}
