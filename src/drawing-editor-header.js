import { actionButton, actionMenu } from './drawing-toolbar.js';

/** Keep document actions separate from view commands in both drawing editors. */
export function installDrawingEditorHeader({ dialog, toolbar, save, annotations }) {
  const header = dialog.querySelector('header');
  const title = header.querySelector('strong');
  const back = header.querySelector('button');
  header.classList.add('drawing-document-header');
  title.classList.add('drawing-document-title');
  const identity = document.createElement('div');
  identity.className = 'drawing-document-identity drawing-commandbar';
  const label = document.createElement('span');
  label.textContent = 'Ritningseditor';
  identity.append(label);
  const button = (text, icon, run) => {
    const b = actionButton(document.createElement('button'), icon, text);
    b.onclick = run;
    return b;
  };
  const persist = () => {
    save();
    title.title = 'Ritningen sparad i projektet';
    const hint = dialog.querySelector('.cad-statusbar > .cad-hint');
    if (hint) {
      hint.hidden = false;
      hint.textContent = 'Ritningen sparad i projektet.';
      hint.title = hint.textContent;
    }
  };
  actionMenu(identity, {
    label: 'Arkiv',
    iconName: 'page',
    items: [
      button('Spara ritning', 'save', persist),
      button('Till modellen', 'select', () => back.click()),
    ],
  });
  const actions = document.createElement('div');
  actions.className = 'drawing-document-actions drawing-commandbar';
  const saveButton = button('Spara', 'save', persist);
  saveButton.classList.add('drawing-document-save');
  saveButton.title = 'Spara ritningen i projektet · Ctrl/⌘ S';
  actions.append(saveButton);
  const saveMenu = actionMenu(actions, {
    label: '',
    iconName: 'down',
    items: [
      button('Spara och till modellen', 'save', () => {
        persist();
        back.click();
      }),
    ],
  });
  saveMenu.classList.add('drawing-save-menu');
  saveMenu.querySelector('button').setAttribute('aria-label', 'Fler sparalternativ');
  saveMenu.querySelector('button svg:last-child').remove();
  actions.append(back);
  header.replaceChildren(identity, title, actions);

  const history = document.createElement('div');
  history.className = 'drawing-history-controls';
  history.setAttribute('role', 'group');
  history.setAttribute('aria-label', 'Historik för ritobjekt');
  for (const [name, redo] of [
    ['Ångra', false],
    ['Gör om', true],
  ]) {
    const b = button('', redo ? 'redo' : 'undo', () => annotations().undo(redo));
    b.dataset.drawingHistory = redo ? 'redo' : 'undo';
    b.setAttribute('aria-label', name);
    b.title = `${name} ritobjekt · Ctrl/⌘ ${redo ? 'Shift Z' : 'Z'}`;
    b.disabled = !(redo ? annotations().future : annotations().history).length;
    history.append(b);
  }
  toolbar.prepend(history);
  const find = (text) =>
    [...toolbar.children].find((b) => b.tagName === 'BUTTON' && b.textContent.trim() === text);
  const fitPaper = find('Visa blad');
  const fitAll = find('Visa allt');
  if (fitPaper && fitAll) {
    const fitGroup = document.createElement('div');
    fitGroup.className = 'drawing-fit-controls';
    fitPaper.before(fitGroup);
    fitGroup.append(fitPaper);
    const menu = actionMenu(fitGroup, { label: '', iconName: 'down', items: [fitAll] });
    menu.querySelector('button').setAttribute('aria-label', 'Fler vyanpassningar');
    menu.querySelector('button svg:last-child').remove();
  }
  const views = ['Ny vy', 'Duplicera vy', 'Ordna vyer'].map(find).filter(Boolean);
  if (views.length) {
    const menu = actionMenu(toolbar, { label: 'Vyer', iconName: 'layout', items: views });
    const more = [...toolbar.children].find(
      (el) =>
        el.classList.contains('drawing-action-menu') &&
        el.firstElementChild.textContent.trim() === 'Mer',
    );
    if (more) toolbar.insertBefore(menu, more);
  }
  dialog.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      persist();
    }
  });
}
