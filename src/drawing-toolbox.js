import { installEditorWorkspace } from './ui/editor-workspace.js';

export function createDrawingToolbox(root, toolbar) {
  const buttons = [...root.querySelectorAll('button')];
  const groups = [
    { id: 'select', label: 'Markera', categories: [{ label: 'Urval', buttons: [] }] },
    {
      id: 'draw',
      label: 'Rita',
      categories: [
        { label: 'Linjer', buttons: [] },
        { label: 'Former', buttons: [] },
      ],
    },
    {
      id: 'measure',
      label: 'Mått',
      categories: [
        { label: 'Kedjemått', buttons: [] },
        { label: 'Automatisk måttsättning', buttons: [] },
      ],
    },
    { id: 'notes', label: 'Text', categories: [{ label: 'Hänvisningar', buttons: [] }] },
    { id: 'modify', label: 'Ändra', categories: [{ label: 'Placering', buttons: [] }] },
    { id: 'views', label: 'Vyer', categories: [{ label: 'Snitt och detaljer', buttons: [] }] },
    { id: 'other', label: 'Bibliotek', categories: [{ label: 'Ritningsmallar', buttons: [] }] },
  ];
  for (const [index, button] of buttons.entries()) {
    button.id ||= `${root.id}-tool-${index}`;
    button.setAttribute('aria-label', button.textContent.trim());
    const label = button.textContent.trim();
    const group =
      groups.find((g) => g.id === button.dataset.drawingGroup) ||
      groups.find(
        (g) =>
          g.id ===
          (label === 'Markera'
            ? 'select'
            : /snitt|detalj/i.test(label)
              ? 'views'
              : /mark|leader/i.test(label)
                ? 'notes'
                : 'other'),
      );
    const category =
      group.categories.find((c) => c.label === button.dataset.drawingCategory) ||
      group.categories[0];
    category.buttons.push(button);
  }
  const commands = (id) =>
    groups
      .find((g) => g.id === id)
      .categories.flatMap((c) => c.buttons)
      .map((node) => ({ node }));
  const [select, ...selectionTools] = commands('select');
  const modify = commands('modify');
  const draw = commands('draw');
  const measure = commands('measure');
  const notes = commands('notes');
  const views = commands('views');
  const dialog = root.closest('dialog');
  const toolbarGroups = { document: [], display: [], views: [], library: [], history: [] };
  const collect = (node) => {
    const group = node.dataset.drawingHistory ? 'history' : node.dataset.drawingCommandGroup;
    if (group && toolbarGroups[group]) {
      const command = node.classList.contains('drawing-action-menu')
        ? {
            label: node.querySelector('button').textContent.trim(),
            icon: 'plus',
            menu: [...node.querySelector('.drawing-action-panel').children].map((node) => ({
              node,
            })),
          }
        : { node };
      toolbarGroups[group].push(command);
    } else if (node.classList.contains('drawing-action-menu')) {
      [...node.querySelector('.drawing-action-panel').children].forEach(collect);
    } else if (node.classList.contains('drawing-history-controls')) {
      [...node.children].forEach(collect);
    }
  };
  [...toolbar.children].forEach(collect);
  const viewCommands = [...toolbarGroups.views, ...views];
  const libraries = [...commands('other'), ...toolbarGroups.library];
  const definitions = [
    {
      label: 'Ritning',
      items: [
        { node: dialog.querySelector('.drawing-document-save'), size: 'large' },
        ...(toolbarGroups.document.length ? [{ stack: toolbarGroups.document }] : []),
      ],
    },
    {
      label: 'Ändra',
      items: [
        selectionTools.length
          ? { label: 'Markera', primary: select.node, size: 'large', menu: selectionTools }
          : { ...select, size: 'large' },
        ...(modify.length ? [{ ...modify[0], size: 'large' }] : []),
        ...(modify.length > 1 ? [{ stack: modify.slice(1) }] : []),
        { stack: toolbarGroups.history },
      ],
    },
    ...(draw.length
      ? [
          {
            label: 'Rita',
            items: [{ label: 'Linje', primary: draw[0].node, size: 'large', menu: draw.slice(1) }],
          },
        ]
      : []),
    ...(measure.length
      ? [
          {
            label: 'Annotera',
            items: [
              {
                label: 'Måttsätt',
                primary: measure[0].node,
                size: 'large',
                menu: measure.slice(1),
              },
              ...(notes.length ? [{ stack: notes }] : []),
            ],
          },
        ]
      : []),
    ...(viewCommands.length
      ? [
          {
            label: 'Vyer',
            items: [
              { ...viewCommands[0], size: 'large' },
              ...(viewCommands.length > 1 ? [{ stack: viewCommands.slice(1) }] : []),
            ],
          },
        ]
      : []),
    {
      label: 'Visa',
      items: toolbarGroups.display.map((command) => ({ ...command, size: 'large' })),
    },
    ...(libraries.length
      ? [
          {
            label: 'Bibliotek',
            items: [{ label: 'Bibliotek', menu: libraries, icon: 'library' }],
          },
        ]
      : []),
  ];
  const ribbon = installEditorWorkspace(dialog, { ribbon: root, groups: definitions });
  toolbar.hidden = true;
  return ribbon;
}
