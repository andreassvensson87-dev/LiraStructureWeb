import './context-menu.css';
import { installContextMenuDismissal } from './context-menu-dismissal.js';

/** Presentation only: callers supply command state and retain command ownership. */
export function createContextMenu({ label, returnFocus, nested = false }) {
  const root = document.createElement('div');
  root.className = 'ui-context-menu';
  root.setAttribute('popover', 'auto');
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', label);
  document.body.append(root);
  let child = null;
  const close = (focus = false) => {
    child?.dispose();
    child = null;
    if (root.matches(':popover-open')) root.hidePopover();
    if (focus) returnFocus?.focus({ preventScroll: true });
  };
  const buttons = () => [...root.children].filter((node) => node.matches('button:not(:disabled)'));
  const removeDismissal = nested
    ? () => {}
    : installContextMenuDismissal(document, {
        isOpen: () => root.matches(':popover-open'),
        contains: (target) => root.contains(target),
        close,
      });
  const open = (items, { x, y, title, parent } = {}) => {
    close();
    root.replaceChildren();
    if (title) {
      const caption = document.createElement('div');
      caption.className = 'ui-context-menu-caption';
      caption.textContent = title;
      root.append(caption);
    }
    for (const item of items.filter((item) => !item.hidden)) {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.setAttribute('role', 'separator');
        root.append(separator);
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.textContent = item.label;
      button.disabled = !!item.disabled;
      button.title = item.reason || '';
      if (item.items) {
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.setAttribute('aria-hidden', 'true');
        button.append(arrow);
        button.onclick = () => {
          child?.dispose();
          root
            .querySelectorAll('[aria-expanded]')
            .forEach((b) => b.setAttribute('aria-expanded', 'false'));
          child = createContextMenu({ label: item.label, returnFocus: button, nested: true });
          const submenu = child;
          root.append(submenu.root);
          submenu.root.addEventListener('toggle', () =>
            button.setAttribute('aria-expanded', String(submenu.root.matches(':popover-open'))),
          );
          button.setAttribute('aria-expanded', 'true');
          const rect = button.getBoundingClientRect();
          child.open(
            item.items.map((entry) => ({
              ...entry,
              run: () => {
                close();
                entry.run();
              },
            })),
            {
              x: rect.right + 3,
              y: rect.top,
              parent: rect,
            },
          );
        };
        button.onkeydown = (event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            button.click();
          }
        };
      } else
        button.onclick = () => {
          close(true);
          item.run();
        };
      root.append(button);
    }
    root.showPopover();
    const left =
      parent && x + root.offsetWidth > innerWidth - 6 ? parent.left - root.offsetWidth - 3 : x;
    root.style.left = `${Math.max(6, Math.min(left, innerWidth - root.offsetWidth - 6))}px`;
    root.style.top = `${Math.max(6, Math.min(y, innerHeight - root.offsetHeight - 6))}px`;
    buttons()[0]?.focus({ preventScroll: true });
  };
  root.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault();
      close(true);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const entries = buttons();
      const index = entries.indexOf(document.activeElement);
      entries[
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? entries.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length
      ]?.focus();
    } else if (event.key === 'Tab') close();
  });
  root.addEventListener('toggle', () => {
    if (!root.matches(':popover-open')) {
      child?.dispose();
      child = null;
    }
  });
  return {
    root,
    isOpen: () => root.matches(':popover-open'),
    open,
    close,
    dispose: () => {
      close();
      removeDismissal();
      root.remove();
    },
  };
}
