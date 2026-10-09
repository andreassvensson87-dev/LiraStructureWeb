import './model-chrome.css';

const icons = {
  properties: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  model: 'm12 3 8 4.5v9L12 21l-8-4.5v-9ZM4 7.5l8 4.5 8-4.5M12 12v9',
  filter: 'M3 4h18l-7 8v8l-4-2v-6Z',
  references: 'M5 3h11v14H5ZM9 17v4h11V7h-4M8 7h5M8 11h5',
};
const svg = (path) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;

/** Move existing controls so their command handlers and state stay connected. */
export function installModelChrome({ getSelectionMode, setSelectionMode, front, side }) {
  const $ = (id) => document.getElementById(id);
  const aside = document.querySelector('main > aside');
  const tabs = aside.querySelector('.inspector-tabs');
  const content = document.createElement('div');
  content.className = 'model-inspector-content';
  content.append(...[...aside.children].filter((child) => child !== tabs));
  aside.classList.add('model-inspector');
  aside.append(content, tabs);
  tabs.setAttribute('aria-orientation', 'vertical');
  for (const button of tabs.querySelectorAll('[data-inspector-tab]')) {
    const label = button.textContent.trim();
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = svg(icons[button.dataset.inspectorTab]);
  }
  tabs.addEventListener('keydown', (event) => {
    const buttons = [...tabs.querySelectorAll('[role=tab]')];
    const index = buttons.indexOf(event.target);
    if (index < 0 || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next].focus();
    buttons[next].click();
  });

  const footer = document.querySelector('body > footer');
  footer.classList.add('model-statusbar');
  const controls = document.createElement('div');
  controls.className = 'model-bottom-controls';
  const selection = document.createElement('div');
  selection.className = 'model-selection-switch';
  selection.setAttribute('role', 'group');
  selection.setAttribute('aria-label', 'Markeringsläge');
  const levels = document.querySelector('.level-controls');
  if (levels) controls.append(levels);
  controls.append(selection);
  const choices = ['assembly', 'part'].map((mode) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = mode === 'assembly' ? 'Assembly' : 'Part';
    button.title = mode === 'assembly' ? 'Markera hela assemblies' : 'Markera enskilda delar';
    button.dataset.selectionMode = mode;
    button.onclick = () => {
      setSelectionMode(mode);
      syncSelection();
    };
    selection.append(button);
    return button;
  });
  function syncSelection() {
    for (const button of choices)
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.selectionMode === getSelectionMode()),
      );
  }
  syncSelection();

  const view = document.createElement('div');
  view.className = 'model-view-menu';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'model-view-trigger';
  trigger.innerHTML = `Vy ${svg('m8 10 4 4 4-4')}`;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div');
  menu.id = 'model-view-menu';
  menu.className = 'model-view-popup';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Vy');
  menu.hidden = true;
  trigger.setAttribute('aria-controls', menu.id);
  const close = () => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };
  trigger.onclick = () => {
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('button').focus({ preventScroll: true });
  };
  const action = (label, icon, run) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.innerHTML = `${svg(icon)}<span>${label}</span>`;
    button.onclick = () => {
      close();
      run();
    };
    menu.append(button);
  };
  action('3D-vy', icons.model, () => $('iso').click());
  action('Ovanifrån', 'M4 4h16v16H4ZM4 9h16M9 4v16', () => $('top').click());
  action('Framifrån', 'M4 4h16v16H4ZM4 15h16M9 15v5', front);
  action('Från sidan', 'M4 4h16v16H4ZM15 4v16M4 9h11', side);
  action('Visa allt', 'M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4', () => $('fit').click());
  const quick = document.querySelector('.view-controls');
  for (const id of ['work-plane', 'work-plane-reset', 'work-plane-view', 'helpers-visible']) {
    const button = $(id);
    if (!button) continue;
    button.setAttribute('role', 'menuitem');
    const text = document.createElement('span');
    text.textContent = button.getAttribute('aria-label');
    button.append(text);
    button.addEventListener('click', close);
    menu.append(button);
  }
  quick.querySelectorAll('.view-divider').forEach((divider) => divider.remove());
  quick.append($('fit'), $('iso'), $('top'), $('transparent-view'));
  view.append(trigger, menu);
  controls.append(view, quick);
  footer.append(controls);
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!view.contains(event.target)) close();
    },
    true,
  );
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      trigger.focus();
    } else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const items = [...menu.querySelectorAll('button')].filter(
        (button) => !button.hidden && !button.disabled,
      );
      const index = items.indexOf(document.activeElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    }
  });
  view.addEventListener('focusout', (event) => {
    if (!view.contains(event.relatedTarget) && !view.matches(':hover')) close();
  });
}
