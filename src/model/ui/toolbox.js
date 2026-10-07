/** Fixed group and tool positions; existing buttons retain their handlers and state. */
export const TOOL_GROUPS = [
  { id: 'selection', label: 'Markera', icon: 'select', tools: ['select', 'box-select'] },
  {
    id: 'create',
    label: 'Skapa',
    icon: 'draw',
    tools: ['draw', 'plate', 'fastener', 'fastener-group'],
  },
  {
    id: 'connections',
    label: 'Kopplingar',
    icon: 'component-fit',
    tools: [
      'component-fit',
      'component-baseplate',
      'component-stiffener',
      'component-endplate',
      'component-bolted-endplate',
      'component-beam-splice',
    ],
    categories: [
      { label: 'Generellt', tools: ['component-fit'] },
      {
        label: 'Stål',
        tools: [
          'component-baseplate',
          'component-stiffener',
          'component-endplate',
          'component-bolted-endplate',
          'component-beam-splice',
        ],
      },
    ],
  },
  { id: 'cut', label: 'Bearbeta', icon: 'polygoncut', tools: ['polygoncut', 'linecut'] },
  { id: 'transform', label: 'Ändra', icon: 'move', tools: ['move', 'copy', 'rotate'] },
  { id: 'helpers', label: 'Hjälp', icon: 'helperpoint', tools: ['helperpoint', 'helperline'] },
];
export function createGroupedToolbox(root, definitions = TOOL_GROUPS) {
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
    if (current.search) {
      current.search.value = '';
      current.filter();
    }
    if (restoreFocus) current.trigger.focus();
  }
  function open(group) {
    cancelClose();
    if (opened !== group) close();
    opened = group;
    group.panel.hidden = false;
    group.trigger.setAttribute('aria-expanded', 'true');
    if (root.closest('.drawing-editor, #frame-editor')) {
      const panel = group.panel,
        anchor = group.trigger.getBoundingClientRect();
      const area = root.closest('.drawing-body, .fe-body').getBoundingClientRect();
      const top = Math.max(8, area.top + 8),
        bottom = Math.min(window.innerHeight - 8, area.bottom - 8);
      Object.assign(panel.style, {
        top: '0px',
        left: 'calc(100% + 10px)',
        maxHeight: `${Math.max(60, bottom - top)}px`,
        overflowY: 'auto',
        boxSizing: 'border-box',
      });
      const bounds = panel.getBoundingClientRect();
      if (bounds.right > document.documentElement.clientWidth - 8)
        panel.style.left = `${-bounds.width - 10}px`;
      panel.style.top = `${Math.max(top, Math.min(anchor.top, bottom - bounds.height)) - anchor.top}px`;
    }
    group.search?.focus({ preventScroll: true });
  }
  for (const definition of definitions) {
    const buttons = definition.tools.map((id) => root.querySelector(`#${id}`));
    if (buttons.some((button) => !button)) throw new Error(`Verktyg saknas i ${definition.id}`);
    const group = document.createElement('div');
    group.className = 'tool-group';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'tool-group-trigger';
    trigger.id =
      definitions === TOOL_GROUPS ? `tools-${definition.id}` : `${root.id}-group-${definition.id}`;
    trigger.setAttribute(
      'aria-label',
      definition.id === 'helpers' ? 'Hjälpgeometri' : definition.label,
    );
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute(
      'aria-controls',
      definitions === TOOL_GROUPS ? `tools-panel-${definition.id}` : `${trigger.id}-panel`,
    );
    trigger.append(root.querySelector(`#${definition.icon} svg`).cloneNode(true));
    trigger.querySelector('svg').setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = definition.label;
    trigger.append(label);
    const panel = document.createElement('div');
    panel.id = trigger.getAttribute('aria-controls');
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
    if (definition.categories) {
      items.classList.add('tool-group-categories');
      for (const category of definition.categories) {
        const section = document.createElement('div');
        section.className = 'tool-category';
        if (category.label) {
          section.setAttribute('role', 'group');
          section.setAttribute('aria-label', category.label);
          const title = document.createElement('div');
          title.className = 'tool-category-heading';
          title.textContent = category.label;
          section.append(title);
        }
        section.append(...category.tools.map((id) => buttons.find((button) => button.id === id)));
        items.append(section);
      }
    } else items.append(...buttons);
    panel.append(items);
    group.append(trigger, panel);
    root.append(group);
    const entry = { trigger, panel, group, buttons };
    if (definition.id === 'connections') {
      const search = document.createElement('input');
      search.type = 'search';
      search.className = 'tool-group-search';
      search.placeholder = 'Sök kopplingar…';
      search.setAttribute('aria-label', 'Sök kopplingar');
      search.setAttribute('aria-controls', (items.id = 'connection-search-results'));
      const empty = document.createElement('div');
      empty.className = 'tool-group-empty';
      empty.textContent = 'Inga träffar';
      empty.setAttribute('role', 'status');
      empty.hidden = true;
      panel.insertBefore(search, items);
      panel.append(empty);
      const normalize = (text) =>
        text
          .toLocaleLowerCase('sv-SE')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      entry.search = search;
      entry.filter = () => {
        const words = normalize(search.value).trim().split(/\s+/).filter(Boolean);
        for (const button of buttons) {
          const text = normalize(
            `${button.getAttribute('aria-label')} ${button.parentElement.getAttribute('aria-label') || ''}`,
          );
          button.hidden = !words.every((word) => text.includes(word));
        }
        for (const category of items.children)
          category.hidden = ![...category.querySelectorAll('button')].some(
            (button) => !button.hidden,
          );
        empty.hidden = buttons.some((button) => !button.hidden);
      };
      search.addEventListener('input', entry.filter);
      search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          buttons.find((button) => !button.hidden && !button.disabled)?.click();
        }
      });
    }
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
      if (e.target === entry.search && !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const enabled = buttons.filter((b) => !b.disabled && !b.hidden),
        index = enabled.indexOf(document.activeElement);
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? enabled.length - 1
              : index === -1
                ? e.key === 'ArrowUp'
                  ? enabled.length - 1
                  : 0
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
  window.addEventListener('resize', close);
  return {
    close,
    dispose() {
      close();
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', close);
      groups.forEach((g) => g.observer.disconnect());
    },
  };
}
