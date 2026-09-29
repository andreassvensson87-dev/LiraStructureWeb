// Shared actions keep drawing workspaces consistent as more tools are added.
const paths = {
  detail: 'M3 3h12v12H3zM15 15l6 6M7 9h4M9 7v4',
  section: 'M5 3v18M19 3v18M2 7h7m-3-3 3 3-3 3M16 7h7m-3-3 3 3-3 3M5 15h14',
  select: 'm5 3 14 10-7 1-3 7Z',
  dimension: 'M4 4v16M20 4v16M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3',
  leader: 'M3 20l8-10h10M3 20l1-6M3 20l6-2',
  plus: 'M12 5v14M5 12h14',
  fit: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8z',
  layout: 'M3 3h12v6H3zM3 13h12v8H3zM18 13h3v8h-3z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'm5 12 4 4L19 6',
  number: 'M9 3 7 21M17 3l-2 18M4 8h17M3 16h17',
  down: 'm8 10 4 4 4-4',
  page: 'M5 3h10l4 4v14H5zM14 3v5h5',
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="${paths[name]}"/>`;
  return svg;
}
export function actionButton(button, name, label) {
  button.type = 'button';
  button.classList.add('drawing-action');
  button.replaceChildren(icon(name), document.createTextNode(label));
  return button;
}
export function actionMenu(root, { label, iconName = 'more', primary = false, items }) {
  const wrap = document.createElement('div');
  wrap.className = 'drawing-action-menu';
  const trigger = actionButton(document.createElement('button'), iconName, label);
  trigger.classList.toggle('drawing-action-primary', primary);
  trigger.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.className = 'drawing-action-panel';
  panel.hidden = true;
  panel.id = `drawing-actions-${crypto.randomUUID()}`;
  trigger.setAttribute('aria-controls', panel.id);
  trigger.append(icon('down'));
  panel.append(...items);
  wrap.append(trigger, panel);
  root.append(wrap);
  const close = (focus = false) => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  };
  trigger.onclick = () => {
    const open = panel.hidden;
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  };
  panel.addEventListener('click', (e) => {
    if (e.target.closest('button:not(:disabled)')) close(true);
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown' && e.target === trigger) {
      e.preventDefault();
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      panel.querySelector('button:not(:disabled)')?.focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) close();
  });
  wrap.addEventListener('focusout', (e) => {
    if (!wrap.contains(e.relatedTarget)) close();
  });
  root.closest('dialog')?.addEventListener('close', () => close());
  return wrap;
}
