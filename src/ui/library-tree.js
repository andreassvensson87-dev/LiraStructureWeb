const states = new WeakMap();
const leafCount = (node) =>
  node.count ?? (node.children ? node.children.reduce((n, child) => n + leafCount(child), 0) : 1);
const contains = (node, key) =>
  node.key === key || node.children?.some((child) => contains(child, key));

/** Shared tree presentation. Adapters supply stable keys, labels and selection callbacks. */
export function renderLibraryTree(
  root,
  { nodes, selectedKey, query = '', onSelect, empty = 'Inga träffar' },
) {
  let state = states.get(root);
  if (!state) {
    state = { expanded: new Map(), query: '', selected: null };
    states.set(root, state);
    root.addEventListener('keydown', (event) => {
      const targets = [...root.querySelectorAll('summary, button')].filter((node) => {
        for (
          let parent = node.parentElement;
          parent && parent !== root;
          parent = parent.parentElement
        )
          if (
            parent.tagName === 'DETAILS' &&
            !parent.open &&
            parent.querySelector(':scope > summary') !== node
          )
            return false;
        return !node.disabled;
      });
      const index = targets.indexOf(document.activeElement);
      if (index < 0) return;
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? targets.length - 1
              : Math.max(
                  0,
                  Math.min(targets.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
                );
        targets[next]?.focus();
      } else if (event.key === 'ArrowRight' && document.activeElement.tagName === 'SUMMARY') {
        event.preventDefault();
        document.activeElement.parentElement.open = true;
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const current = document.activeElement;
        const parent = current.closest('details');
        if (current.tagName === 'SUMMARY' && parent.open) parent.open = false;
        else {
          const target =
            current.tagName === 'SUMMARY' ? parent?.parentElement.closest('details') : parent;
          target?.querySelector(':scope > summary')?.focus();
        }
      }
    });
  }
  if (!state.query)
    for (const branch of root.querySelectorAll('details'))
      state.expanded.set(branch.dataset.key, branch.open);
  const changed = selectedKey !== state.selected;
  const focusKey = root.contains(document.activeElement)
    ? document.activeElement.dataset.key
    : null;
  const scrollTop = root.scrollTop;
  state.query = query.trim();
  state.selected = selectedKey;
  root.classList.add('ui-library-tree');
  root.replaceChildren();
  const append = (parent, node) => {
    if (node.children) {
      const branch = document.createElement('details');
      branch.dataset.key = node.key;
      branch.open =
        !!state.query ||
        (changed && contains(node, selectedKey)) ||
        (state.expanded.get(node.key) ?? contains(node, selectedKey));
      const summary = document.createElement('summary');
      summary.dataset.key = `summary:${node.key}`;
      summary.title = node.label;
      summary.append(document.createTextNode(node.label));
      const count = document.createElement('span');
      count.className = 'ui-library-count';
      count.textContent = `(${leafCount(node)})`;
      summary.append(count);
      if (node.key === selectedKey) summary.setAttribute('aria-current', 'true');
      if (node.selectable)
        summary.addEventListener('click', () => queueMicrotask(() => onSelect?.(node)));
      branch.append(summary);
      node.children.forEach((child) => append(branch, child));
      parent.append(branch);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.key = node.key;
      button.textContent = node.label;
      if (node.badge) {
        button.setAttribute('aria-label', node.label);
        const badge = document.createElement('span');
        badge.className = 'ui-library-badge';
        badge.textContent = node.badge;
        button.append(badge);
      }
      button.title = node.title || node.label;
      button.disabled = !!node.disabled;
      if (node.key === selectedKey) button.setAttribute('aria-current', 'true');
      button.onclick = () => onSelect?.(node);
      parent.append(button);
    }
  };
  nodes.forEach((node) => append(root, node));
  if (!nodes.length) {
    const message = document.createElement('p');
    message.className = 'ui-library-empty';
    message.textContent = empty;
    root.append(message);
  }
  if (focusKey)
    [...root.querySelectorAll('[data-key]')].find((node) => node.dataset.key === focusKey)?.focus();
  root.scrollTop = scrollTop;
}

export function setLibraryTreeExpanded(root, open) {
  const state = states.get(root);
  for (const branch of root.querySelectorAll('details')) {
    branch.open = open;
    state?.expanded.set(branch.dataset.key, open);
  }
}
