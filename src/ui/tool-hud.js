import { commandIcon } from './icons.js';

/** Shared bottom-centred stack. Adapters own drafts, tools and confirmation. */
export function createToolHUDStack(host) {
  const root = document.createElement('div');
  root.className = 'ui-tool-hud-stack';
  root.setAttribute('aria-label', 'Verktyg');
  host.append(root);
  return {
    add({ label, icon, content, activate, close }) {
      const row = document.createElement('form');
      row.className = 'ui-tool-hud';
      row.setAttribute('aria-label', label);
      const button = (title, symbol, run) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.title = title;
        node.setAttribute('aria-label', title);
        if (symbol === 'close') node.textContent = '×';
        else node.append(commandIcon(symbol));
        node.onclick = run;
        return node;
      };
      const select = button(label, icon, activate);
      select.className = 'ui-tool-hud-activate';
      const dismiss = button('Stäng ' + label.toLowerCase(), 'close', close);
      row.append(select, content, dismiss);
      root.prepend(row);
      row.addEventListener('pointerdown', (e) => {
        if (!row.classList.contains('is-active') && !e.target.closest('button')) activate();
      });
      row.addEventListener('focusin', (e) => {
        if (!row.classList.contains('is-active') && !e.target.closest('button')) activate();
      });
      return {
        root: row,
        active(value) {
          row.classList.toggle('is-active', value);
          select.setAttribute('aria-pressed', String(value));
        },
        remove: () => {
          const positions = [...root.children].map((node) => [
            node,
            node.getBoundingClientRect().top,
          ]);
          row.remove();
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            for (const [node, top] of positions) {
              if (node === row) continue;
              const dy = top - node.getBoundingClientRect().top;
              if (dy)
                node.animate(
                  [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
                  { duration: 180, easing: 'ease-out' },
                );
            }
        },
      };
    },
    dispose: () => root.remove(),
  };
}

/** Compact linear editor; callbacks report intentions without model mutations. */
export function createLinearHUD(stack, draft, callbacks) {
  const label = draft.mode === 'copy' ? 'Kopiera linjärt' : 'Flytta linjärt';
  const content = document.createElement('div');
  content.className = 'ui-linear-hud-fields';
  const iconButton = (name, title, run) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.append(commandIcon(name));
    b.setAttribute('aria-label', title);
    b.title = title;
    b.onclick = run;
    return b;
  };
  const picker = iconButton('origin', 'Välj start- och slutpunkt', callbacks.pick);
  content.append(picker);
  const inputs = [],
    checks = [];
  for (const [i, axis] of ['X', 'Y', 'Z'].entries()) {
    const group = document.createElement('label');
    group.className = 'ui-linear-hud-axis';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = draft.enabled[i];
    check.setAttribute('aria-label', `Använd ${axis}`);
    check.onchange = () => callbacks.enable(i, check.checked);
    const caption = document.createElement('span');
    caption.textContent = `d${axis}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'text';
    input.setAttribute('aria-label', `Avstånd ${axis}`);
    input.title = `Avstånd ${axis} · mm · + − * / ( )`;
    input.value = draft.values[i];
    input.oninput = () => callbacks.change(i, input.value);
    input.onfocus = () => {
      input.value = draft.values[i];
    };
    group.append(check, caption, input);
    content.append(group);
    inputs.push(input);
    checks.push(check);
  }
  let countInput;
  if (draft.mode === 'copy') {
    const group = document.createElement('label');
    group.className = 'ui-linear-hud-axis ui-linear-hud-count';
    const caption = document.createElement('span');
    caption.textContent = 'Antal';
    countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.min = '1';
    countInput.max = '1000';
    countInput.step = '1';
    countInput.value = draft.count;
    countInput.setAttribute('aria-label', 'Antal kopior');
    countInput.oninput = () => callbacks.count(countInput.value);
    group.append(caption, countInput);
    content.append(group);
  }
  const action = draft.mode === 'copy' ? 'Kopiera' : 'Flytta';
  const confirm = iconButton('check', action, callbacks.confirm);
  const caption = document.createElement('span');
  caption.textContent = action;
  confirm.append(caption);
  confirm.type = 'submit';
  confirm.onclick = null;
  confirm.className = 'ui-tool-hud-confirm';
  content.append(confirm);
  const row = stack.add({ label, icon: draft.mode, content, ...callbacks });
  row.root.onsubmit = (e) => {
    e.preventDefault();
    callbacks.confirm();
  };
  row.root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      callbacks.cancel();
    }
  });
  return {
    ...row,
    sync({ active, picking, error = '', ready = false, coordinateSystem }) {
      row.active(active);
      row.root.title = error || coordinateSystem || '';
      row.root.classList.toggle('has-error', !!error);
      picker.setAttribute('aria-pressed', String(picking));
      picker.title = picking ? 'Välj start- och slutpunkt i modellen' : 'Välj start- och slutpunkt';
      confirm.disabled = !ready || picking;
      if (countInput && countInput.value !== String(draft.count)) countInput.value = draft.count;
      if (countInput) countInput.setAttribute('aria-invalid', String(!!error && active));
      for (const [i, input] of inputs.entries()) {
        const raw = draft.values[i];
        const display =
          document.activeElement === input ||
          !String(raw).trim() ||
          !Number.isFinite(+String(raw).replace(',', '.'))
            ? raw
            : String(Math.round(+String(raw).replace(',', '.') * 1000) / 1000);
        if (input.value !== display) input.value = display;
        input.disabled = !draft.enabled[i];
        input.setAttribute('aria-invalid', String(!!error && active));
        checks[i].checked = draft.enabled[i];
      }
    },
  };
}

/** Three-point plane pickers in the same HUD stack as linear transforms. */
export function createPlaneHUD(stack, draft, callbacks) {
  const label = draft.mode === 'copy' ? 'Kopiera till plan' : 'Flytta till plan';
  const content = document.createElement('div');
  content.className = 'ui-plane-hud-fields';
  const buttons = ['start', 'target'].map((which) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'ui-plane-hud-picker';
    node.onclick = () => callbacks.pick(which);
    content.append(node);
    return node;
  });
  const confirm = document.createElement('button');
  confirm.type = 'submit';
  confirm.className = 'ui-tool-hud-confirm';
  confirm.append(commandIcon('check'));
  confirm.title = 'Bekräfta ' + label.toLowerCase();
  confirm.setAttribute('aria-label', confirm.title);
  content.append(confirm);
  const row = stack.add({ label, icon: draft.mode, content, ...callbacks });
  row.root.onsubmit = (e) => {
    e.preventDefault();
    callbacks.confirm();
  };
  row.root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      callbacks.cancel();
    }
  });
  return {
    ...row,
    sync({ active, start, target, picking, ready, error }) {
      row.active(active);
      row.root.title = error || label;
      row.root.classList.toggle('has-error', !!error);
      for (const [i, node] of buttons.entries()) {
        node.textContent = `${i ? 'Målplan' : 'Startplan'} ${i ? target : start}/3`;
        node.setAttribute('aria-label', `Välj ${i ? 'målplan' : 'startplan'} med tre punkter`);
        node.setAttribute('aria-pressed', String(active && picking === (i ? 'target' : 'start')));
      }
      confirm.disabled = !ready;
    },
  };
}

/** Compact point picker using the shared tool stack, with no parameter fields. */
export function createCornerHUD(stack, callbacks) {
  const content = document.createElement('div');
  content.className = 'ui-plane-hud-fields';
  const picker = document.createElement('button');
  picker.type = 'button';
  picker.className = 'ui-plane-hud-picker';
  picker.onclick = callbacks.pick;
  picker.setAttribute('aria-label', 'Välj motstående hörn i XY');
  const confirm = document.createElement('button');
  confirm.type = 'submit';
  confirm.className = 'ui-tool-hud-confirm';
  confirm.append(commandIcon('check'));
  confirm.setAttribute('aria-label', 'Bekräfta arbetsområde');
  content.append(picker, confirm);
  const row = stack.add({ label: 'Arbetsområde', icon: 'model', content, ...callbacks });
  row.root.onsubmit = (e) => {
    e.preventDefault();
    callbacks.confirm();
  };
  row.root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      callbacks.cancel();
    }
  });
  return {
    ...row,
    sync({ active, count, ready }) {
      row.active(active);
      picker.textContent = `Hörn ${count}/2`;
      confirm.disabled = !ready;
    },
  };
}
