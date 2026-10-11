/** A compact selection field with caller-provided previews; no domain dependencies. */
export function createPreviewSelect({ label, entries, onChange }) {
  const root = document.createElement('div');
  root.className = 'ui-preview-select';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.setAttribute('aria-label', label);
  trigger.setAttribute('aria-haspopup', 'listbox');
  const panel = document.createElement('div');
  panel.className = 'ui-preview-options';
  panel.setAttribute('popover', 'auto');
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('aria-label', label);
  const choices = entries.map((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.append(entry.preview(), document.createTextNode(entry.label));
    button.onclick = () => {
      set(entry.value);
      onChange(entry.value);
      panel.hidePopover();
      trigger.focus();
    };
    panel.append(button);
    return button;
  });
  let value;
  function set(next) {
    value = next;
    const entry = entries.find((e) => e.value === next) || entries[0];
    const caption = document.createElement('span');
    caption.textContent = entry.label;
    const arrow = document.createElement('span');
    arrow.textContent = '⌄';
    trigger.replaceChildren(entry.preview(), caption, arrow);
    choices.forEach((button, i) =>
      button.setAttribute('aria-selected', String(entries[i].value === next)),
    );
  }
  function open() {
    if (trigger.matches(':disabled')) return;
    panel.showPopover();
    const r = trigger.getBoundingClientRect();
    panel.style.width = `${r.width}px`;
    panel.style.left = `${Math.max(4, Math.min(r.left, innerWidth - r.width - 4))}px`;
    const below = r.bottom + 3;
    const top =
      below + panel.offsetHeight <= innerHeight - 4 ? below : r.top - panel.offsetHeight - 3;
    panel.style.top = `${Math.max(4, top)}px`;
    choices[entries.findIndex((e) => e.value === value)]?.focus();
  }
  trigger.onclick = () => (panel.matches(':popover-open') ? panel.hidePopover() : open());
  trigger.onkeydown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      open();
    }
  };
  panel.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      panel.hidePopover();
      trigger.focus();
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const i = choices.indexOf(document.activeElement);
      choices[
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? choices.length - 1
            : (i + (e.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length
      ].focus();
    }
  };
  panel.addEventListener('toggle', () =>
    trigger.setAttribute('aria-expanded', String(panel.matches(':popover-open'))),
  );
  root.append(trigger, panel);
  set(entries[0].value);
  return {
    root,
    set,
    get: () => value,
    close: () => {
      if (panel.matches(':popover-open')) panel.hidePopover();
    },
  };
}
