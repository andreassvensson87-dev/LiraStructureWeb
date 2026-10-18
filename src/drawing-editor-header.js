import { actionButton } from './drawing-toolbar.js';

/** Keep document actions separate from view commands in both drawing editors. */
export function installDrawingEditorHeader({ dialog, toolbar, save, annotations, openList }) {
  const header = dialog.querySelector('header');
  const title = header.querySelector('strong');
  const back = header.querySelector('button');
  header.classList.add('drawing-document-header');
  title.classList.add('drawing-document-title');
  const identity = document.createElement('div');
  identity.className = 'drawing-document-identity drawing-commandbar';
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
  identity.append(button('Ritningslista', 'page', openList));
  const actions = document.createElement('div');
  actions.className = 'drawing-document-actions drawing-commandbar';
  const saveButton = button('Spara', 'save', persist);
  saveButton.classList.add('drawing-document-save');
  saveButton.title = 'Spara ritningen i projektet · Ctrl/⌘ S';
  actions.append(saveButton);
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
  dialog.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      persist();
    }
  });
}
