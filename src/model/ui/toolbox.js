/** Fixed group and tool positions; existing buttons retain their handlers and state. */
export const TOOL_GROUPS = [
  { id: 'selection', label: 'Markera', icon: 'select', tools: ['select', 'box-select'] },
  { id: 'create', label: 'Skapa', icon: 'draw', tools: ['draw', 'plate', 'fastener'] },
  { id: 'cut', label: 'Bearbeta', icon: 'polygoncut', tools: ['polygoncut', 'linecut'] },
  { id: 'transform', label: 'Ändra', icon: 'move', tools: ['move', 'copy', 'rotate'] },
  { id: 'helpers', label: 'Hjälp', icon: 'helperpoint', tools: ['helperpoint', 'helperline'] },
];
export function createGroupedToolbox(root) {
  const groups = [];
  let opened = null,
    timer;
  const cancelClose = () => clearTimeout(timer);
  function close(restoreFocus = false) {
    cancelClose();
    if (!opened) return;
    const current = opened;
    opened = null;
    current.clicked = false;
    current.panel.hidden = true;
    current.trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) current.trigger.focus();
  }
  function open(group) {
    cancelClose();
    if (opened !== group) close();
    opened = group;
    group.panel.hidden = false;
    group.trigger.setAttribute('aria-expanded', 'true');
  }
  for (const definition of TOOL_GROUPS) {
    const buttons = definition.tools.map((id) => root.querySelector(`#${id}`));
    if (buttons.some((button) => !button)) throw new Error(`Verktyg saknas i ${definition.id}`);
    const group = document.createElement('div');
    group.className = 'tool-group';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'tool-group-trigger';
    trigger.id = `tools-${definition.id}`;
    trigger.setAttribute(
      'aria-label',
      definition.id === 'helpers' ? 'Hjälpgeometri' : definition.label,
    );
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `tools-panel-${definition.id}`);
    trigger.append(root.querySelector(`#${definition.icon} svg`).cloneNode(true));
    trigger.querySelector('svg').setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = definition.label;
    trigger.append(label);
    const panel = document.createElement('div');
    panel.id = `tools-panel-${definition.id}`;
    panel.className = 'tool-group-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'group');
    panel.setAttribute(
      'aria-label',
      definition.id === 'helpers' ? 'Hjälpgeometri' : definition.label,
    );
    const heading = document.createElement('div');
    heading.className = 'tool-group-heading';
    heading.textContent = panel.getAttribute('aria-label');
    panel.append(heading);
    const items = document.createElement('div');
    items.className = 'tool-group-items';
    items.append(...buttons);
    panel.append(items);
    group.append(trigger, panel);
    root.append(group);
    const entry = { trigger, panel, group, buttons };
    groups.push(entry);
    group.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') open(entry);
    });
    group.addEventListener('pointerleave', () => {
      cancelClose();
      timer = setTimeout(() => {
        if (!group.contains(document.activeElement)) close();
      }, 220);
    });
    trigger.onclick = () => {
      if (opened === entry && entry.clicked) {
        entry.clicked = false;
        close();
      } else {
        open(entry);
        entry.clicked = true;
      }
    };
    trigger.addEventListener('keydown', (e) => {
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        open(entry);
        buttons.find((b) => !b.disabled)?.focus();
      }
    });
    panel.addEventListener('click', (e) => {
      if (e.target.closest('button')) {
        entry.clicked = false;
        close();
      }
    });
    panel.addEventListener('keydown', (e) => {
      const enabled = buttons.filter((b) => !b.disabled),
        index = enabled.indexOf(document.activeElement);
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? enabled.length - 1
              : (index + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1) + enabled.length) %
                enabled.length;
        enabled[next]?.focus();
      }
    });
    group.addEventListener('focusout', (e) => {
      if (!group.contains(e.relatedTarget)) close();
    });
    group.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && opened === entry) {
        e.preventDefault();
        e.stopPropagation();
        entry.clicked = false;
        close(true);
      }
    });
    const sync = () => {
      const active = buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
      trigger.classList.toggle('active', !!active);
      trigger.title = active
        ? `${panel.getAttribute('aria-label')} · ${active.getAttribute('aria-label')}`
        : panel.getAttribute('aria-label');
    };
    const observer = new MutationObserver(sync);
    buttons.forEach((button) =>
      observer.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] }),
    );
    entry.observer = observer;
    sync();
  }
  root.classList.add('grouped-toolbox');
  const outside = (e) => {
    if (!root.contains(e.target)) close();
  };
  document.addEventListener('pointerdown', outside);
  return {
    close,
    dispose() {
      close();
      document.removeEventListener('pointerdown', outside);
      groups.forEach((g) => g.observer.disconnect());
    },
  };
}
