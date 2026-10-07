import { FRAME_LIBRARY_KEY } from './frame-model.js';
import { LAYOUT_KEY } from './frame-layout.js';
import { standardDrawingLayouts } from './frame-standard-layouts.js';
export function showStandardLayouts(editor) {
  const dialog = document.createElement('dialog');
  dialog.className = 'fe-file-dialog fe-dxf-dialog';
  dialog.setAttribute('aria-label', 'Standardlayouter');
  dialog.innerHTML =
    '<header><strong>Standardlayouter</strong><button type="button" aria-label="Stäng standardlayouter">×</button></header><form><label>Ritningshuvud<select name="title"></select></label><label>Revisionsblock<select name="revision"></select></label><fieldset><legend>Pappersformat</legend><label><input type="checkbox" name="paper" value="A4" checked>A4 · stående</label><label><input type="checkbox" name="paper" value="A3" checked>A3 · liggande</label><label><input type="checkbox" name="paper" value="A1" checked>A1 · liggande</label></fieldset><label>Kantavstånd · mm<input name="margin" type="number" value="10" min="0" max="100" required></label><label>Mellan block · mm<input name="gap" type="number" value="5" min="0" max="100" required></label><p role="alert"></p><footer><button type="button" data-cancel>Avbryt</button><button type="submit">Skapa layouter</button></footer></form>';
  const form = dialog.querySelector('form'),
    fields = form.elements;
  fields.title.replaceChildren(
    new Option('Välj sparat block…', ''),
    ...editor.blocks.map((b) => new Option(b.name, b.id)),
  );
  fields.revision.replaceChildren(
    new Option('Välj sparat block…', ''),
    ...editor.blocks.map((b) => new Option(b.name, b.id)),
  );
  fields.title.value = editor.blocks.find((b) => b.titleBlock)?.id || '';
  fields.revision.value = editor.blocks.find((b) => b.revisionTable)?.id || '';
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      const title = editor.blocks.find((b) => b.id === fields.title.value);
      const revision = editor.blocks.find((b) => b.id === fields.revision.value);
      const created = standardDrawingLayouts(title, revision, {
        papers: new FormData(form).getAll('paper'),
        margin: +fields.margin.value,
        gap: +fields.gap.value,
      });
      const blocks = [...editor.blocks];
      for (const block of [title, revision])
        if (block && !blocks.some((b) => b.id === block.id)) blocks.push(block);
      const layouts = [...editor.layouts];
      for (const layout of created) {
        const base = layout.name;
        let n = 2;
        while (layouts.some((l) => l.name === layout.name)) layout.name = `${base} (${n++})`;
        layouts.push(layout);
      }
      if (!editor.canDiscard()) return;
      const oldBlocks = localStorage.getItem(FRAME_LIBRARY_KEY),
        oldLayouts = localStorage.getItem(LAYOUT_KEY);
      try {
        localStorage.setItem(FRAME_LIBRARY_KEY, JSON.stringify(blocks));
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(layouts));
      } catch {
        for (const [key, value] of [
          [FRAME_LIBRARY_KEY, oldBlocks],
          [LAYOUT_KEY, oldLayouts],
        ]) {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        }
        throw Error('Kunde inte spara layouterna.');
      }
      editor.blocks = blocks;
      editor.layouts = layouts;
      if (editor.mode !== 'layout') editor.switchMode('layout');
      editor.library = layouts;
      editor.frame = structuredClone(created.find((l) => l.width === 420) || created[0]);
      editor.loaded();
      editor.status(`${created.length} layouter sparade`);
      dialog.close();
    } catch (error) {
      dialog.querySelector('[role=alert]').textContent = error.message;
    }
  };
  dialog.querySelector('header button').onclick = dialog.querySelector('[data-cancel]').onclick =
    () => dialog.close();
  dialog.addEventListener('keydown', (e) => e.stopPropagation());
  dialog.addEventListener('cancel', (e) => e.stopPropagation());
  dialog.addEventListener('close', () => dialog.remove());
  editor.dialog.append(dialog);
  dialog.showModal();
}
