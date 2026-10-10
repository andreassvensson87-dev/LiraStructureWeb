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
  const [select] = commands('select');
  const modify = commands('modify');
  const draw = commands('draw');
  const measure = commands('measure');
  const notes = commands('notes');
  const views = commands('views');
  const dialog = root.closest('dialog');
  const toolbarNodes = [];
  const collect = (node) => {
    if (node.classList.contains('drawing-action-menu')) {
      for (const child of node.querySelector('.drawing-action-panel').children) collect(child);
    } else if (node.matches('.drawing-history-controls,.drawing-fit-controls')) {
      for (const child of node.children) collect(child);
    } else toolbarNodes.push({ node });
  };
  [...toolbar.children].forEach(collect);
  const history = toolbarNodes.filter(({ node }) => node.dataset.drawingHistory);
  const fit = toolbarNodes.find(({ node }) => node.textContent.trim() === 'Visa blad');
  const more = toolbarNodes.filter((item) => !history.includes(item) && item !== fit);
  const definitions = [
    {
      label: 'Ritning',
      items: [{ node: dialog.querySelector('.drawing-document-save'), size: 'large' }],
    },
    {
      label: 'Ändra',
      items: [
        { ...select, size: 'large' },
        ...(modify.length ? [{ ...modify[0], size: 'large' }] : []),
        ...(modify.length > 1 ? [{ stack: modify.slice(1) }] : []),
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
    ...(views.length
      ? [
          {
            label: 'Vyer',
            items: [
              { ...views[0], size: 'large' },
              ...(views.length > 1 ? [{ stack: views.slice(1) }] : []),
            ],
          },
        ]
      : []),
    {
      label: 'Blad och vy',
      items: [
        { stack: history },
        ...(fit ? [{ ...fit, size: 'large' }] : []),
        { label: 'Fler', menu: more },
      ],
    },
    ...(commands('other').length
      ? [
          {
            label: 'Bibliotek',
            items: [{ label: 'Bibliotek', menu: commands('other'), icon: 'library' }],
          },
        ]
      : []),
  ];
  const ribbon = installEditorWorkspace(dialog, { ribbon: root, groups: definitions });
  toolbar.hidden = true;
  return ribbon;
}
