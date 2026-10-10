import { createEditorSection, installEditorSurface } from './editor-surface.js';
import { createRibbon } from './ribbon.js';

export function installEditorWorkspace(dialog, { ribbon, groups }) {
  dialog.classList.add('ui-editor-workspace');
  dialog.querySelector(':scope > header').after(ribbon);
  return createRibbon(ribbon, groups);
}

export function installReportWorkspace(dialog) {
  const toolbar = dialog.querySelector('.report-toolbar');
  const project = dialog.querySelector('.report-project-bar');
  const command = (selector, size = 'small', label) => ({
    node: dialog.querySelector(selector),
    size,
    label,
  });
  installEditorWorkspace(dialog, {
    ribbon: toolbar,
    groups: [
      {
        label: 'Rapport',
        items: [
          command('[data-new]', 'large'),
          command('[data-store]', 'large', 'Spara'),
          { node: project.querySelector('label') },
        ],
      },
      {
        label: 'Underlag',
        items: [{ node: dialog.querySelector('[data-kind]').closest('label') }],
      },
      {
        label: 'Layout',
        items: [
          { node: toolbar.querySelector('label') },
          { stack: [command('[data-save-template]'), command('[data-layout-editor]')] },
        ],
      },
      {
        label: 'Utdata',
        items: [command('[data-pdf]', 'large', 'PDF'), command('[data-csv]', 'large', 'CSV')],
      },
    ],
  });
  project.remove();
  installEditorSurface(dialog, {
    layout: dialog.querySelector('.report-body'),
    inspector: dialog.querySelector('.report-body > aside'),
    footer: dialog.querySelector('footer'),
    labels: 'label:not(:has(input[type="checkbox"]))',
    observe: true,
  });
}

export function installFrameWorkspace(dialog, ribbon) {
  dialog.classList.add('ui-editor-workspace');
  const back = dialog.querySelector('[data-action="close"]');
  back.textContent = 'Tillbaka';
  back.classList.add('ui-back-button');
  back.setAttribute('aria-label', 'Till föregående arbetsyta');
  back.classList.remove('fe-header-icon');
  const command = (action, size = 'small') => ({
    node: dialog.querySelector(`[data-action="${action}"]`),
    size,
  });
  ribbon.addGroup({
    label: 'Kontroll',
    items: [
      { stack: [command('fit'), { ...command('preview'), label: 'Förhandsvisa' }] },
      { stack: [command('undo'), command('redo')] },
    ],
  });
  const saveGroup = dialog.querySelector('.fe-save-group');
  ribbon.addGroup({
    label: 'Spara',
    items: [
      {
        label: 'Spara',
        size: 'large',
        primary: dialog.querySelector('[data-action="save"]'),
        menu: [command('saveAs')],
      },
    ],
  });
  saveGroup.remove();
  installEditorSurface(dialog, {
    layout: dialog.querySelector('.fe-body'),
    inspector: dialog.querySelector('.fe-body > aside'),
    footer: dialog.querySelector('.cad-statusbar'),
    labels: 'label:not(:has(input[type="checkbox"]))',
    observe: true,
  });
}

export function installItemWorkspace(dialog) {
  const tools = dialog.querySelector('.item-editor-tools');
  const command = (selector, size = 'small') => ({ node: dialog.querySelector(selector), size });
  const form = dialog.querySelector('.item-editor-properties');
  form.id = 'item-editor-form';
  dialog.querySelector('[data-save]').setAttribute('form', form.id);
  installEditorWorkspace(dialog, {
    ribbon: tools,
    groups: [
      { label: 'Markera', items: [command('[data-mode="select"]', 'large')] },
      {
        label: 'Placering',
        items: [command('[data-mode="start"]', 'large'), command('[data-mode="end"]', 'large')],
      },
      {
        label: 'Hjälpgeometri',
        items: [{ stack: [command('[data-mode="helper"]'), command('[data-clear-guides]')] }],
      },
      { label: 'Kontroll', items: [command('[data-fit]', 'large')] },
      { label: 'Spara', items: [command('[data-save]', 'large'), command('[data-test]')] },
    ],
  });
  const back = dialog.querySelector('[data-editor-close]');
  back.textContent = 'Till biblioteket';
  back.setAttribute('aria-label', 'Till item-biblioteket');
  dialog.querySelector('[data-back]').hidden = true;
  const inspector = document.createElement('aside');
  inspector.className = 'ui-item-inspector';
  dialog.querySelector('.item-editor-layout').append(inspector);
  const nav = dialog.querySelector('.item-editor-nav');
  const metadata = nav.querySelector('[data-metadata]');
  nav.prepend(createEditorSection('Item', [metadata]));
  nav.querySelector('hr').remove();
  const helperTitle = nav.querySelector(':scope > strong');
  const helperNodes = [...nav.children].filter(
    (node) => node !== nav.firstElementChild && !node.matches('[data-back]'),
  );
  helperTitle.remove();
  nav.append(
    createEditorSection(
      'Hjälpgeometri',
      helperNodes.filter((node) => node !== helperTitle),
      { open: false },
    ),
  );
  form.querySelector(':scope > strong').remove();
  const placementNodes = [...form.children];
  form.append(createEditorSection('Placering', placementNodes));
  inspector.append(nav, form);
  installEditorSurface(dialog, {
    layout: dialog.querySelector('.item-editor-layout'),
    inspector,
    tracking: dialog.querySelector('.item-editor-tracking'),
    status: dialog.querySelector('[data-editor-status]'),
  });
}
