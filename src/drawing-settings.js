import { drawingFonts } from './drawing-preferences.js';
import { readDrawingPresets } from './drawing-presets.js';
import { presetEditor } from './drawing-preset-editor.js';
import { actionButton } from './drawing-toolbar.js';

function fontField(title) {
  const label = document.createElement('label');
  label.textContent = title;
  const select = document.createElement('select');
  select.append(...drawingFonts.map(([name, value]) => new Option(name, value)));
  label.append(select);
  return { label, select };
}
/** Shared entry point; existing editors continue to own their respective data. */
export function installDrawingSettings({ manager, planView, singleSheet }, frameEditor) {
  document.getElementById('frame-editor-open')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'drawing-settings';
  dialog.setAttribute('aria-label', 'Ritningsinställningar');
  dialog.innerHTML =
    '<header><strong>Ritningsinställningar</strong><button type="button" aria-label="Stäng ritningsinställningar">×</button></header><form><section><h3>Allmänt</h3><p>Standardvärden används för nya ritningar. Befintliga ritningar behåller sina val.</p></section><section class="drawing-settings-libraries"><h3>Bibliotek och editorer</h3></section><p role="status"></p><footer><button type="button" data-cancel>Avbryt</button><button type="submit">Spara standardvärden</button></footer></form>';
  document.body.append(dialog);
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  const prepare = presetEditor(dialog, singleSheet);
  dialog.addEventListener('close', () => {
    const library = readDrawingPresets();
    manager.presetSelect.replaceChildren(...library.items.map((p) => new Option(p.name, p.id)));
    manager.presetSelect.value = library.defaultId;
  });
  const close = () => dialog.close();
  dialog.querySelector('header button').onclick = close;
  dialog.querySelector('[data-cancel]').onclick = close;
  for (const [name, open] of [
    [
      'Ramblock',
      () => {
        frameEditor.open();
        frameEditor.switchMode('block');
      },
    ],
    [
      'Layouter',
      () => {
        frameEditor.open();
        frameEditor.switchMode('layout');
      },
    ],
    ['Pappersformat', () => singleSheet.openLibrary()],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name + '…';
    button.onclick = () => {
      close();
      open();
    };
    dialog.querySelector('.drawing-settings-libraries').append(button);
  }
  const open = (editor) => {
    prepare(editor);
    dialog.showModal();
  };
  for (const [editor, toolbar] of [
    [manager, '.drawing-actions'],
    [planView, '.plan-toolbar'],
    [singleSheet, '.sheet-toolbar'],
  ]) {
    const button = actionButton(
      document.createElement('button'),
      'settings',
      'Ritningsinställningar',
    );
    button.classList.add('drawing-settings-button');
    button.setAttribute('aria-label', 'Ritningsinställningar');
    button.title = 'Ritningsinställningar';
    button.onclick = () => {
      editor.cancelInteraction?.();
      open(editor);
    };
    editor.dialog.querySelector(toolbar).append(button);
  }
  for (const editor of [planView, singleSheet]) {
    const field = fontField('Ritningens typsnitt');
    field.label.className = 'drawing-font-field';
    const parent =
      editor === singleSheet
        ? editor.dialog.querySelector('.sheet-properties')
        : editor.dialog.querySelector('.drawing-inspector');
    parent.append(field.label);
    editor.fontSelect = field.select;
    field.select.onchange = () => {
      editor.record.typography = { font: field.select.value };
      if (editor === singleSheet) editor.compose();
      else {
        editor.refreshPaper();
        editor.views.refresh();
      }
    };
  }
  frameEditor.dialog.addEventListener('close', () => {
    if (singleSheet.dialog.open) singleSheet.render();
    if (planView.dialog.open) {
      planView.refreshPaper();
      planView.views.refresh();
    }
  });
  // Font controls are synchronized by each editor when opening the drawing.
  return { open, dialog };
}
