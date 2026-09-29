import { createDrawingTemplate, readDrawingTemplates, TEMPLATE_KEY } from './drawing-templates.js';
import { actionButton } from './drawing-toolbar.js';
export function installTemplateSave(editor, toolbar) {
  const button = actionButton(document.createElement('button'), 'page', 'Spara som ritningsmall');
  const menu = [...toolbar.querySelectorAll('.drawing-action-menu')]
    .find((w) => w.firstElementChild.textContent.trim() === 'Mer')
    ?.querySelector('.drawing-action-panel');
  (menu || toolbar).append(button);
  button.onclick = () => {
    editor.cancelInteraction();
    const dialog = document.createElement('dialog');
    dialog.className = 'drawing-template-save';
    dialog.setAttribute('aria-label', 'Spara ritningsmall');
    dialog.innerHTML =
      '<form><h2>Spara ritningsmall</h2><p>Papper, layout, standardvyer, sektioner och ritningsinställningar sparas. Mått, part marks och detaljvyer ingår inte. Sektionernas läge anpassas relativt den nya detaljens storlek.</p><label>Mallnamn<input required maxlength="80" aria-label="Mallnamn"></label><p role="status"></p><footer><button type="button">Avbryt</button><button type="submit">Spara mall</button></footer></form>';
    document.body.append(dialog);
    dialog.addEventListener('keydown', (e) => e.stopPropagation());
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      try {
        const name = dialog.querySelector('input').value.trim(),
          items = readDrawingTemplates();
        if (items.some((t) => t.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
          throw Error('Namnet används redan. Välj ett annat namn.');
        items.push(createDrawingTemplate(editor.record, editor.bounds, name));
        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(items));
        dialog.close();
        editor.$('message').textContent = 'Ritningsmallen sparad.';
      } catch (error) {
        dialog.querySelector('[role=status]').textContent = error.message;
      }
    };
    dialog.showModal();
  };
}
