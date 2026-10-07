import { readColors } from './color-library.js';
import { createGroupedToolbox } from './model/ui/toolbox.js';
const paths = {
  select: 'm5 3 14 10-7 1-3 7Z',
  origin: 'M12 3v18M3 12h18M8 8h8v8H8Z',
  insert: 'M3 3h13v13H3ZM16 12v9m-4-5h9',
  'report-area': 'M3 4h18v16H3ZM3 9h18M9 9v11M15 9v11',
  line: 'M4 20 20 4M3 18h3v3H3ZM18 3h3v3h-3Z',
  polyline: 'M3 18 9 6l6 12 6-12M2 17h2v2H2ZM8 5h2v2H8ZM14 17h2v2h-2Z',
  text: 'M4 5V3h16v2M12 3v18M8 21h8',
  attribute: 'M7 4 2 12l5 8M17 4l5 8-5 8M8 16l4-8 4 8M10 13h4',
  image: 'M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M15 7h2',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  copy: 'M9 9h12v12H9ZM15 9V3H3v12h6',
  rotate: 'M20 10a8 8 0 1 0-2 8M20 4v6h-6',
  delete: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
};
export function improveFrameTools(root) {
  for (const b of root.querySelectorAll('nav [data-tool],nav [data-action="delete"]')) {
    const key = b.dataset.tool || 'delete',
      label = key === 'origin' ? 'Origo' : key === 'insert' ? 'Infoga block' : b.title || 'Radera';
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]}"/></svg><span></span>`;
    b.querySelector('span').textContent = label;
    b.setAttribute('aria-label', key === 'origin' ? 'Insättningspunkt' : label);
  }
}
export function createFrameToolbox(dialog) {
  const root = dialog.querySelector('.fe-body > nav');
  root.id = 'frame-tools';
  for (const button of root.querySelectorAll('button'))
    button.id = `frame-tool-${button.dataset.tool || button.dataset.action}`;
  const definitions = [
    ['select', 'Markera', [['Urval', ['select']]]],
    ['draw', 'Rita', [['Linjer', ['line', 'polyline']]]],
    ['text', 'Text', [['Text och attribut', ['text', 'attribute']]]],
    [
      'insert',
      'Infoga',
      [
        ['Ramblock', ['insert']],
        ['Rapport', ['report-area']],
        ['Bilder', ['image']],
      ],
    ],
    [
      'modify',
      'Ändra',
      [
        ['Placering', ['move', 'copy', 'rotate']],
        ['Radera', ['delete']],
      ],
    ],
    ['origin', 'Origo', [['Insättningspunkt', ['origin']]]],
  ].map(([id, label, sections]) => {
    const categories = sections.map(([label, keys]) => ({
      label,
      tools: keys.map((key) => `frame-tool-${key}`),
    }));
    const tools = categories.flatMap((category) => category.tools);
    return { id, label, categories, tools, icon: tools[0] };
  });
  const toolbox = createGroupedToolbox(root, definitions);
  dialog.addEventListener('close', () => toolbox.close());
  return {
    ...toolbox,
    syncVisibility() {
      toolbox.close();
      for (const group of root.querySelectorAll('.tool-group')) {
        for (const category of group.querySelectorAll('.tool-category'))
          category.hidden = [...category.querySelectorAll('button')].every(
            (button) => button.hidden,
          );
        group.hidden = [...group.querySelectorAll('[data-tool],[data-action]')].every(
          (button) => button.hidden,
        );
      }
    },
  };
}
export function paletteControl(input, onPick) {
  const label = input.parentElement,
    button = document.createElement('button'),
    palette = document.createElement('div');
  button.type = 'button';
  button.className = 'fe-color-trigger';
  button.setAttribute('aria-label', 'Välj färg');
  button.setAttribute('aria-expanded', 'false');
  palette.className = 'fe-color-palette';
  palette.hidden = true;
  input.hidden = true;
  label.append(button, palette);
  const update = () => {
    const colors = readColors(),
      match = colors.find((c) => c.color.toLowerCase() === input.value.toLowerCase());
    button.replaceChildren();
    const swatch = document.createElement('i');
    swatch.style.background =
      input.value || 'repeating-linear-gradient(45deg,#ccc 0 4px,#fff 4px 8px)';
    button.append(swatch, document.createTextNode(match?.name || input.value || 'Blandat'));
  };
  button.onclick = (e) => {
    e.preventDefault();
    palette.hidden = !palette.hidden;
    button.setAttribute('aria-expanded', String(!palette.hidden));
    palette.replaceChildren();
    for (const c of readColors()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = c.name;
      b.setAttribute('aria-label', c.name);
      b.style.background = c.color;
      b.setAttribute('aria-pressed', String(c.color.toLowerCase() === input.value.toLowerCase()));
      b.onclick = (e) => {
        e.preventDefault();
        input.value = c.color;
        onPick();
        palette.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        update();
      };
      palette.append(b);
    }
  };
  update();
  return () => {
    palette.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    update();
  };
}
export class FrameFileDialog {
  constructor(parent) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'fe-file-dialog';
    parent.append(this.dialog);
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    this.dialog.addEventListener('cancel', (e) => e.stopPropagation());
  }
  shell(title) {
    this.dialog.replaceChildren();
    const header = document.createElement('header'),
      strong = document.createElement('strong'),
      close = document.createElement('button');
    strong.textContent = title;
    close.textContent = '×';
    close.setAttribute('aria-label', 'Stäng filruta');
    close.onclick = () => this.dialog.close();
    header.append(strong, close);
    this.dialog.append(header);
    return this.dialog;
  }
  open(items, kind, onOpen) {
    const root = this.shell('Öppna ' + kind),
      search = document.createElement('input'),
      list = document.createElement('div');
    search.placeholder = 'Sök efter namn…';
    search.setAttribute('aria-label', 'Sök sparade objekt');
    list.className = 'fe-file-list';
    const render = () => {
      list.replaceChildren();
      for (const item of items.filter((i) =>
        i.name.toLowerCase().includes(search.value.toLowerCase()),
      )) {
        const b = document.createElement('button');
        b.textContent = item.name;
        const small = document.createElement('small');
        small.textContent = `${item.entities.length} ${kind === 'layout' ? 'block' : 'objekt'}`;
        b.append(small);
        b.onclick = () => {
          if (onOpen(item) !== false) this.dialog.close();
        };
        list.append(b);
      }
      if (!list.children.length) list.textContent = 'Inga sparade objekt att visa.';
    };
    search.oninput = render;
    root.append(search, list);
    render();
    this.dialog.showModal();
  }
  manage({ kind, items, usage, onOpen, onChange }) {
    const root = this.shell('Öppna / hantera ' + (kind === 'layout' ? 'layouter' : 'ramblock')),
      search = document.createElement('input'),
      list = document.createElement('div'),
      panel = document.createElement('form'),
      message = document.createElement('p');
    search.placeholder = 'Sök efter namn…';
    search.setAttribute('aria-label', 'Sök sparade objekt');
    list.className = 'fe-file-list fe-library-list';
    const menu = document.createElement('div');
    menu.className = 'fe-library-menu';
    menu.setAttribute('popover', 'auto');
    root.append(menu);
    panel.hidden = true;
    message.className = 'fe-file-message';
    message.setAttribute('role', 'status');
    const button = (text, action) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.onclick = action;
      return b;
    };
    const render = () => {
      menu.hidePopover();
      list.replaceChildren();
      const matches = items()
        .filter((i) => i.name.toLowerCase().includes(search.value.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
      search.placeholder = `Sök bland ${items().length} ${kind === 'layout' ? 'layouter' : 'ramblock'}…`;
      for (const item of matches) {
        const row = document.createElement('div');
        row.className = 'fe-library-row';
        const name = button(item.name, () => {
            if (onOpen(item) !== false) this.dialog.close();
          }),
          count = document.createElement('small'),
          detail = document.createElement('small');
        name.className = 'fe-library-name';
        name.title = 'Öppna ' + item.name;
        count.textContent = `${item.entities.length} ${kind === 'layout' ? 'block' : 'objekt'}`;
        const refs = usage(item);
        detail.textContent = refs.length
          ? `${refs.length} ${kind === 'layout' ? 'ritningar' : 'layouter'}`
          : 'Ej använd';
        detail.title = refs.length ? 'Används i: ' + refs.join(', ') : 'Används inte';
        const edit = (operation) => {
          menu.hidePopover();
          panel.replaceChildren();
          panel.hidden = false;
          message.textContent = '';
          const label = document.createElement('label'),
            input = document.createElement('input'),
            submit = document.createElement('button');
          if (operation === 'delete') {
            label.textContent = `Ta bort ”${item.name}” från biblioteket?`;
            submit.textContent = 'Ta bort';
          } else {
            label.textContent = 'Nytt namn';
            input.value = item.name;
            input.required = true;
            input.maxLength = 120;
            input.setAttribute('aria-label', 'Nytt namn');
            label.append(input);
            submit.textContent = 'Spara namn';
          }
          panel.append(
            label,
            submit,
            button('Avbryt', () => {
              panel.hidden = true;
            }),
          );
          panel.onsubmit = (e) => {
            e.preventDefault();
            try {
              onChange(operation, item, input.value.trim());
              panel.hidden = true;
              message.textContent =
                operation === 'delete' ? 'Borttaget ur biblioteket.' : 'Namnet har ändrats.';
              render();
            } catch (error) {
              message.textContent = error.message;
            }
          };
          if (operation !== 'delete') {
            input.focus();
            input.select();
          }
        };
        const remove = button('Ta bort', () => edit('delete'));
        remove.disabled = refs.length > 0;
        remove.title = refs.length ? 'Används av ' + refs.join(', ') : 'Ta bort från biblioteket';
        const actions = [
          button('Kopiera', () => {
            try {
              onChange('copy', item);
              panel.hidden = true;
              search.value = '';
              message.textContent = 'En separat kopia har skapats.';
              render();
            } catch (error) {
              message.textContent = error.message;
            }
          }),
          button('Byt namn', () => edit('rename')),
          remove,
        ];
        const more = button('⋯', () => {
          const r = more.getBoundingClientRect();
          menu.replaceChildren(...actions);
          menu.showPopover();
          menu.style.left = Math.max(8, r.right - menu.offsetWidth) + 'px';
          menu.style.top =
            Math.max(8, Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8)) + 'px';
        });
        more.className = 'fe-library-more';
        more.setAttribute('aria-label', 'Åtgärder för ' + item.name);
        more.setAttribute('aria-haspopup', 'true');
        row.append(name, count, detail, more);
        list.append(row);
      }
      if (!list.children.length) list.textContent = 'Inga sparade objekt att visa.';
    };
    search.oninput = () => {
      panel.hidden = true;
      render();
    };
    root.append(search, list, panel, message);
    render();
    this.dialog.showModal();
  }
  save(name, kind, onSave) {
    const root = this.shell('Spara ' + kind),
      form = document.createElement('form'),
      label = document.createElement('label'),
      input = document.createElement('input'),
      button = document.createElement('button'),
      error = document.createElement('p');
    label.textContent = 'Namn';
    input.value = name;
    input.required = true;
    input.maxLength = 120;
    input.setAttribute('aria-label', 'Filnamn');
    label.append(input);
    button.textContent = 'Spara';
    button.className = 'primary';
    error.setAttribute('role', 'alert');
    form.append(label, error, button);
    form.onsubmit = (e) => {
      e.preventDefault();
      try {
        onSave(input.value.trim());
        this.dialog.close();
      } catch (e) {
        error.textContent = e.message;
      }
    };
    root.append(form);
    this.dialog.showModal();
    input.select();
  }
}
