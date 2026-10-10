import { commandIcon } from './icons.js';

// Adopt actual controls: their identity, handlers and controller-owned state survive.
export function ribbonCommand(node, { size = 'small', label, icon } = {}) {
  if (!node) throw new Error('Ribbon command is missing');
  node.classList.add('ui-command', `ui-command-${size}`);
  if (node.tagName === 'BUTTON') {
    node.type ||= 'button';
    const text = label || node.getAttribute('aria-label') || node.textContent.trim();
    node.setAttribute('aria-label', text);
    node.title ||= text;
    if (!node.querySelector('svg')) {
      const name =
        icon ||
        node.dataset.tool ||
        {
          poly: 'polyline',
          rect: 'rectangle',
          hole: 'circle',
          anchor: 'origin',
          start: 'origin',
          end: 'origin',
          helper: 'line',
        }[node.dataset.mode] ||
        node.dataset.mode ||
        ('fit' in node.dataset ? 'fit' : 'clearGuides' in node.dataset ? 'delete' : null) ||
        { save: 'save', undo: 'undo', redo: 'redo', fit: 'fit', finish: 'check' }[
          node.dataset.action
        ] ||
        (/spar/i.test(text)
          ? 'save'
          : /ny/i.test(text)
            ? 'plus'
            : /numrering/i.test(text)
              ? 'number'
              : /koppling/i.test(text)
                ? 'layers'
                : /redigera|layout/i.test(text)
                  ? 'layout'
                  : 'page');
      node.prepend(commandIcon(name));
    }
    if (!node.querySelector('span')) {
      const span = document.createElement('span');
      span.textContent = label || node.textContent.trim() || text;
      for (const child of [...node.childNodes])
        if (child.nodeType === Node.TEXT_NODE) child.remove();
      node.append(span);
    } else if (label) node.querySelector('span').textContent = label;
  }
  return node;
}

/** Same group/command/menu layout for every workspace, independent of its domain. */
export function createRibbon(root, groups) {
  root.classList.add('ui-ribbon');
  const menus = [];
  const close = () =>
    menus.forEach(({ panel }) => panel.matches(':popover-open') && panel.hidePopover());
  const dispose = () => {
    close();
    menus.forEach(({ observer }) => observer.disconnect());
  };
  const appendItem = (host, item) => {
    if (item.node) {
      host.append(ribbonCommand(item.node, item));
      return;
    }
    if (item.stack) {
      const stack = document.createElement('div');
      stack.className = 'ui-command-stack';
      item.stack.forEach((entry) => appendItem(stack, entry));
      host.append(stack);
      return;
    }
    if (item.menu) {
      const wrapper = document.createElement('div');
      wrapper.className = 'ui-command-menu';
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.textContent = item.label;
      ribbonCommand(trigger, item);
      const arrow = document.createElement('i');
      arrow.className = 'ui-command-arrow';
      arrow.textContent = '⌄';
      trigger.append(arrow);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-haspopup', 'true');
      const panel = document.createElement('div');
      panel.id = `${root.id || 'ribbon'}-menu-${menus.length}`;
      panel.className = 'ui-command-panel';
      panel.setAttribute('popover', 'auto');
      panel.setAttribute('aria-label', item.label);
      trigger.setAttribute('aria-controls', panel.id);
      item.menu.forEach((entry) => appendItem(panel, entry));
      const commands = item.menu.flatMap((entry) => (entry.node ? [entry.node] : []));
      const sync = () => {
        trigger.disabled = commands.length > 0 && commands.every((b) => b.disabled || b.hidden);
        trigger.hidden = commands.length > 0 && commands.every((b) => b.hidden);
        trigger.classList.toggle(
          'active',
          commands.some(
            (b) => b.classList.contains('active') || b.getAttribute('aria-pressed') === 'true',
          ),
        );
      };
      const observer = new MutationObserver(sync);
      commands.forEach((b) =>
        observer.observe(b, {
          attributes: true,
          attributeFilter: ['disabled', 'hidden', 'class', 'aria-pressed'],
        }),
      );
      sync();
      const position = () => {
        const r = trigger.getBoundingClientRect();
        panel.style.left = `${Math.max(6, Math.min(r.left, window.innerWidth - panel.offsetWidth - 6))}px`;
        panel.style.top = `${Math.max(6, Math.min(r.bottom + 3, window.innerHeight - panel.offsetHeight - 6))}px`;
      };
      trigger.onclick = () => {
        if (panel.matches(':popover-open')) panel.hidePopover();
        else {
          close();
          panel.showPopover();
          position();
        }
      };
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.matches(':popover-open')) {
          e.preventDefault();
          e.stopPropagation();
          close();
          trigger.focus();
          return;
        }
        if (e.key !== 'ArrowDown') return;
        e.preventDefault();
        close();
        panel.showPopover();
        position();
        panel.querySelector('button:not(:disabled):not([hidden])')?.focus();
      });
      panel.addEventListener('toggle', () =>
        trigger.setAttribute('aria-expanded', String(panel.matches(':popover-open'))),
      );
      panel.addEventListener('click', (e) => {
        if (e.target.closest('button') && !e.target.closest('button').disabled) close();
      });
      panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
          trigger.focus();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const buttons = [...panel.querySelectorAll('button:not(:disabled):not([hidden])')];
          const index = buttons.indexOf(document.activeElement);
          buttons[
            (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          ]?.focus();
        }
      });
      if (item.primary) {
        wrapper.classList.add('ui-command-split');
        wrapper.classList.toggle('ui-command-split-small', item.size !== 'large');
        wrapper.append(ribbonCommand(item.primary, { size: item.size, label: item.label }));
        trigger.classList.add('ui-command-split-arrow');
        trigger.replaceChildren(arrow);
        trigger.setAttribute('aria-label', 'Fler alternativ för ' + item.label.toLowerCase());
        trigger.title = trigger.getAttribute('aria-label');
      }
      wrapper.append(trigger, panel);
      host.append(wrapper);
      menus.push({ panel, observer });
    }
  };
  const buildGroup = ({ label, items }) => {
    const section = document.createElement('section');
    section.className = 'ui-ribbon-group';
    section.setAttribute('aria-label', label);
    const body = document.createElement('div');
    body.className = 'ui-ribbon-commands';
    items.forEach((item) => appendItem(body, item));
    const caption = document.createElement('small');
    caption.className = 'ui-ribbon-caption';
    caption.textContent = label;
    section.append(body, caption);
    return section;
  };
  root.replaceChildren(...groups.map(buildGroup));
  root.closest('dialog')?.addEventListener('close', close);
  return { close, dispose, addGroup: (group) => root.append(buildGroup(group)) };
}
