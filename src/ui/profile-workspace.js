import { installFloatingWindow } from './floating-window.js';
import { installEditorWorkspace } from './editor-workspace.js';
import { evaluateSection } from '../section-profile.js';
import { installLibraryWorkspace } from './library-workspace.js';
import { createEditorSection, installEditorSurface } from './editor-surface.js';
import { createAttributeRow } from '../inspector/attributes.js';

export function installProfileWorkspace(editor) {
  const dialog = editor.dialog;
  const library = document.createElement('dialog');
  library.id = 'profile-library';
  library.setAttribute('aria-label', 'Profilbibliotek');
  library.innerHTML =
    '<header><strong>Profilbibliotek</strong><button type="button" aria-label="Stäng profilbibliotek">×</button></header><div class="ui-profile-library-body"><section class="ui-profile-preview"><h3></h3><svg viewBox="0 0 240 240" aria-label="Förhandsvisning av profil"></svg><p></p></section></div><footer><button type="button" data-edit>Redigera profil</button><button type="button" class="primary" data-use>Använd profil</button></footer>';
  document.body.append(library);
  const nav = dialog.querySelector('.section-library');
  const profileFields = document.createElement('div');
  library.querySelector('.ui-profile-preview').append(profileFields);
  library.querySelector('.ui-profile-library-body').prepend(nav);
  editor.libraryDialog = library;
  editor.libraryWindow = installFloatingWindow(library);
  library.querySelector('header button').onclick = () => library.close();
  const edit = () => {
    library.close();
    editor.openEditor();
  };
  library.querySelector('[data-edit]').onclick = edit;
  library.querySelector('[data-use]').onclick = () => {
    editor.action('use');
    if (!editor.error) library.close();
  };
  for (const name of ['new', 'variant']) {
    nav.querySelector(`[data-action="${name}"]`).onclick = () => {
      editor.action(name);
      edit();
    };
  }
  const find = (name) => nav.querySelector(`[data-action="${name}"]`);
  installLibraryWorkspace(library, {
    search: nav.querySelector('#section-search'),
    tree: nav.querySelector('#section-list'),
    details: library.querySelector('.ui-profile-preview'),
    refresh: () => editor.list(),
    commands: [
      { node: find('new'), label: 'Ny' },
      { node: find('variant'), label: 'Ny variant' },
      { node: find('import'), label: 'Importera' },
      { node: find('export'), label: 'Exportera' },
    ],
    edit: library.querySelector('[data-edit]'),
    use: library.querySelector('[data-use]'),
    message: nav.querySelector('small'),
  });
  library.append(nav.querySelector('#section-import'));
  library.querySelector('.ui-profile-library-body').remove();
  const action = (label, name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => editor.action(name);
    return b;
  };
  const command = (selector, size = 'small', label) => ({
    node: dialog.querySelector(selector),
    size,
    label,
  });
  const tools = dialog.querySelector('.section-tools');
  installEditorWorkspace(dialog, {
    ribbon: tools,
    groups: [
      {
        label: 'Profil',
        items: [
          { node: action('Ny profil', 'new'), size: 'large' },
          { node: action('Ny variant', 'variant') },
        ],
      },
      {
        label: 'Geometri',
        items: [
          command('[data-mode="poly"]', 'large'),
          { stack: [command('[data-mode="rect"]'), command('[data-mode="hole"]')] },
          { stack: [command('[data-mode="anchor"]'), command('[data-action="finish"]')] },
        ],
      },
      {
        label: 'Ändra',
        items: [
          command('[data-mode="select"]', 'large'),
          {
            stack: [
              command('[data-action="undo"]', 'small', 'Ångra'),
              command('[data-action="redo"]', 'small', 'Gör om'),
            ],
          },
        ],
      },
      { label: 'Kontroll', items: [command('[data-action="fit"]', 'large')] },
      {
        label: 'Spara',
        items: [command('[data-action="save"]', 'large'), command('[data-action="use"]')],
      },
    ],
  });
  const inspector = dialog.querySelector('.section-properties');
  const identity = [...inspector.querySelectorAll(':scope > label.field')];
  inspector.prepend(createEditorSection('Profil', identity));
  const dimensions = dialog.querySelector('#section-template-fields');
  const dimensionSlot = document.createElement('div');
  dimensions.before(dimensionSlot);
  dimensionSlot.replaceWith(
    createEditorSection('Profilmått', [dimensions, dialog.querySelector('#section-template-note')]),
  );
  const surface = installEditorSurface(dialog, {
    layout: dialog.querySelector('.section-layout'),
    inspector,
    tracking: dialog.querySelector('.section-tracking'),
    command: dialog.querySelector('#section-command'),
    status: dialog.querySelector('#section-feedback'),
  });
  dialog.querySelector('header strong').textContent = 'Profileditor';
  const back = dialog.querySelector('header button');
  back.textContent = 'Till biblioteket';
  back.setAttribute('aria-label', 'Till profilbiblioteket');
  back.onclick = () => {
    dialog.close();
    editor.open();
  };
  return {
    refreshProperties: surface.refreshFields,
    preview() {
      library.querySelector('h3').textContent = editor.def.name;
      const svg = library.querySelector('.ui-profile-preview > svg');
      svg.replaceChildren();
      const message = library.querySelector('.ui-profile-preview p');
      message.setAttribute('role', 'status');
      try {
        const section = evaluateSection(editor.def);
        const points = section.loops.flat();
        const xs = points.map((p) => p[0]),
          ys = points.map((p) => p[1]);
        const x = Math.min(...xs),
          y = Math.min(...ys);
        const w = Math.max(...xs) - x,
          h = Math.max(...ys) - y;
        const pad = Math.max(w, h) * 0.15 || 10;
        svg.setAttribute('viewBox', `${x - pad} ${-y - h - pad} ${w + 2 * pad} ${h + 2 * pad}`);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute(
          'd',
          section.loops
            .map((loop) => 'M' + loop.map(([a, b]) => `${a},${-b}`).join('L') + 'Z')
            .join(''),
        );
        path.setAttribute('fill-rule', 'evenodd');
        svg.append(path);
        message.textContent = editor.error || `${editor.fmt(w)} × ${editor.fmt(h)} mm`;
        profileFields.replaceChildren();
        for (const [key, label, value, unit] of [
          ['width', 'Bredd', editor.fmt(w), 'mm'],
          ['height', 'Höjd', editor.fmt(h), 'mm'],
          ['family', 'Familj', editor.def.family || 'Egen profil', ''],
          ['version', 'Version', editor.def.revision || 1, ''],
        ]) {
          const row = createAttributeRow({ key, label, type: 'text', unit }, { value });
          row.querySelector('input').readOnly = true;
          profileFields.append(row);
        }
        library.querySelector('[data-use]').disabled = false;
      } catch {
        profileFields.replaceChildren();
        message.textContent = editor.error || 'Välj en profil i listan eller skapa en ny.';
        library.querySelector('[data-use]').disabled = true;
      }
    },
  };
}
