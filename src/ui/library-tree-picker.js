import { renderLibraryTree } from './library-tree.js';
import { commandIcon } from './icons.js';
import './library-tree-picker.css';

/** Compact library selector. Domain adapters supply nodes, selection and loading. */
export function createLibraryTreePicker({
  label,
  placeholder,
  searchLabel,
  searchPlaceholder,
  emptyLabel,
  icon,
  getNodes,
  getSelection,
  getError = () => '',
  beforeOpen,
  onSelect,
}) {
  const root = document.createElement('div');
  root.className = 'ui-library-tree-picker';
  const caption = document.createElement('span');
  caption.className = 'attribute-caption';
  caption.textContent = label;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.setAttribute('aria-label', label);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const path = document.createElement('small');
  path.className = 'ui-library-picker-path';
  const panel = document.createElement('div');
  panel.className = 'ui-library-tree-picker-panel ui-standard-library';
  panel.setAttribute('popover', 'auto');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', label);
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = searchPlaceholder;
  search.setAttribute('aria-label', searchLabel);
  const tree = document.createElement('div');
  const status = document.createElement('p');
  status.className = 'ui-library-empty';
  status.setAttribute('role', 'status');
  panel.append(search, tree, status);
  root.append(caption, trigger, path, panel);
  let opening = false;
  const close = () => {
    if (panel.matches(':popover-open')) panel.hidePopover();
  };
  function render() {
    const selection = getSelection();
    renderLibraryTree(tree, {
      nodes: getNodes(search.value),
      query: search.value,
      selectedKey: selection.key,
      empty: search.value.trim() ? 'Inga träffar.' : emptyLabel,
      onSelect: (node) => {
        close();
        trigger.focus({ preventScroll: true });
        onSelect(node);
      },
    });
    status.textContent = getError();
    status.hidden = !status.textContent;
  }
  function sync() {
    const selection = getSelection(),
      text = document.createElement('span');
    text.textContent = selection.label || placeholder;
    trigger.title = selection.label || placeholder;
    trigger.replaceChildren(commandIcon(icon), text, commandIcon('down'));
    path.textContent = selection.path || '';
    path.title = selection.path || '';
    path.hidden = !selection.path;
    if (panel.matches(':popover-open')) render();
  }
  function position() {
    const r = trigger.getBoundingClientRect(),
      gap = 6;
    const width = Math.min(Math.max(r.width, 360), innerWidth - 16);
    const below = innerHeight - r.bottom - 8,
      above = r.top - 8;
    const down = below >= 220 || below >= above;
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.min(440, Math.max(100, down ? below - gap : above - gap))}px`;
    panel.style.left = `${Math.max(8, Math.min(r.right - width, innerWidth - width - 8))}px`;
    panel.style.top = `${Math.max(8, down ? r.bottom + gap : r.top - panel.offsetHeight - gap)}px`;
  }
  async function open() {
    if (opening || root.hidden || root.closest('[hidden], [inert]')) return;
    opening = true;
    trigger.disabled = true;
    try {
      await beforeOpen?.();
      if (!root.isConnected || root.closest('[hidden], [inert]')) return;
      search.value = '';
      render();
      panel.showPopover();
      position();
      const selected = tree.querySelector('[aria-current="true"]');
      if (selected) {
        const row = selected.getBoundingClientRect(),
          viewport = tree.getBoundingClientRect();
        if (row.bottom > viewport.bottom) tree.scrollTop += row.bottom - viewport.bottom;
        else if (row.top < viewport.top) tree.scrollTop += row.top - viewport.top;
      }
      search.focus({ preventScroll: true });
    } finally {
      opening = false;
      trigger.disabled = false;
    }
  }
  trigger.onclick = () => {
    if (panel.matches(':popover-open')) close();
    else void open();
  };
  trigger.onkeydown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      void open();
    }
  };
  search.oninput = render;
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      trigger.focus({ preventScroll: true });
    } else if (event.target === search && event.key === 'ArrowDown') {
      event.preventDefault();
      tree.querySelector('summary, button')?.focus();
    }
  });
  for (const name of ['input', 'change']) panel.addEventListener(name, (e) => e.stopPropagation());
  panel.addEventListener('toggle', () =>
    trigger.setAttribute('aria-expanded', String(panel.matches(':popover-open'))),
  );
  const observer = new ResizeObserver(() => {
    if (panel.matches(':popover-open')) position();
  });
  observer.observe(trigger);
  const resize = () => {
    if (panel.matches(':popover-open')) position();
  };
  const scroll = (event) => {
    if (!panel.contains(event.target)) close();
  };
  window.addEventListener('resize', resize);
  document.addEventListener('scroll', scroll, true);
  sync();
  return {
    root,
    open,
    close,
    sync,
    destroy: () => {
      close();
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('scroll', scroll, true);
      root.remove();
    },
  };
}
