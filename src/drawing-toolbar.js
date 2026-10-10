import { positionDrawingMenu } from './drawing-menu-position.js';
// Shared actions keep drawing workspaces consistent as more tools are added.
import { commandIcon as icon } from './ui/icons.js';
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
    if (open) {
      root
        .closest('dialog')
        ?.querySelectorAll('.drawing-action-menu')
        .forEach((other) => {
          if (other === wrap) return;
          other.querySelector('.drawing-action-panel').hidden = true;
          other.querySelector('button').setAttribute('aria-expanded', 'false');
        });
      positionDrawingMenu(trigger, panel);
    }
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
      positionDrawingMenu(trigger, panel);
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
  window.addEventListener('resize', () => {
    if (!panel.hidden) positionDrawingMenu(trigger, panel);
  });
  root.closest('dialog')?.addEventListener('close', () => close());
  return wrap;
}
