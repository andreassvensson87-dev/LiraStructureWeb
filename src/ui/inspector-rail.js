import { commandIcon } from './icons.js';

/** Presentation only. Panels and commands remain owned by the workspace. */
export function installInspectorRail(host, panels, prefix) {
  host.classList.add('ui-inspector-with-rail');
  const content = document.createElement('div');
  content.className = 'ui-inspector-content';
  const rail = document.createElement('nav');
  rail.className = 'ui-inspector-rail';
  rail.setAttribute('role', 'tablist');
  rail.setAttribute('aria-label', 'Inspektor');
  rail.setAttribute('aria-orientation', 'vertical');
  const buttons = panels.map(({ id, label, icon, panel }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `${prefix}-${id}-tab`;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('role', 'tab');
    panel.id = `${prefix}-${id}-panel`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    button.setAttribute('aria-controls', panel.id);
    button.append(commandIcon(icon));
    button.onclick = () => show(id);
    content.append(panel);
    rail.append(button);
    return button;
  });
  function show(id) {
    panels.forEach((entry, i) => {
      const selected = entry.id === id;
      entry.panel.hidden = !selected;
      buttons[i].setAttribute('aria-selected', String(selected));
      buttons[i].tabIndex = selected ? 0 : -1;
    });
  }
  rail.addEventListener('keydown', (event) => {
    const index = buttons.indexOf(event.target);
    if (index < 0 || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next].click();
    buttons[next].focus();
  });
  host.append(content, rail);
  show(panels[0].id);
  return { show };
}
