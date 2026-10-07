import { createGroupedToolbox } from './model/ui/toolbox.js';

export function createDrawingToolbox(root) {
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
  root.replaceChildren(...buttons);
  const definitions = groups
    .filter((g) => g.categories.some((c) => c.buttons.length))
    .map((g) => {
      const categories = g.categories
        .filter((c) => c.buttons.length)
        .map((c) => ({ label: c.label, tools: c.buttons.map((b) => b.id) }));
      const tools = categories.flatMap((c) => c.tools);
      return { ...g, categories, tools, icon: tools[0] };
    });
  const toolbox = createGroupedToolbox(root, definitions);
  root.closest('dialog').addEventListener('close', () => toolbox.close());
  return toolbox;
}
