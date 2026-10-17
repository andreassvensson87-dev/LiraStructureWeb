import { assemblyDefaults } from './assembly.js';
import { paintFastenerAssemblyPreview } from './assembly-preview-inspector.js';

const choices = [
  ['bolt', 'Skruv', 'Skruv', 20],
  ['nearWasher', 'Bricka', 'Bricka under huvud', 62],
  ['farWasher', 'Bricka', 'Bricka vid mutter', 191],
  ['nut', 'Mutter', 'Första muttern', 226],
  ['extraNut', 'Mutter', 'Andra muttern', 270],
  ['nearNut', 'Mutter', 'Mutter före delarna', 39],
];
/** Native checkboxes and drawing control the same assembly values as the geometry resolver. */
export function createAssemblyPicker(root, changed) {
  root.className = 'fastener-assembly-picker';
  root.innerHTML = `<div class="fastener-assembly-choices">${choices.map(([key, label, description]) => `<label class="fastener-check" title="${description}"><input type="checkbox" aria-label="${description}" data-assembly-choice="${key}">${label}</label>`).join('')}</div>
    <svg viewBox="0 0 310 105" aria-label="Skruv, brickor och muttrar i förbandet" role="img">
    <defs><pattern id="fastener-section-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 1 1-1M0 6 6 0M5 7 7 5" stroke="currentColor" stroke-width=".5"/></pattern></defs>
    <path d="M70 34h60v45H70zM130 34h60v45h-60z" fill="url(#fastener-section-hatch)" stroke="currentColor"/>
    <g data-assembly-part="bolt"><path data-assembly-head d="M12 44h25v25H12z"/><path d="M37 49h255v15H37z"/><path d="M228 49l8 15m0-15 8 15m0-15 8 15m0-15 8 15m0-15 8 15m0-15 8 15" fill="none"/></g>
    <g data-assembly-part="nearWasher"><path d="M62 39h7v35h-7z"/></g>
    <g data-assembly-part="farWasher"><path d="M191 39h7v35h-7z"/></g>
    <g data-assembly-part="nut"><path d="M201 42h27l5 7v15l-5 7h-27l-4-7V49z"/></g>
    <g data-assembly-part="extraNut"><path d="M243 42h27l5 7v15l-5 7h-27l-4-7V49z"/></g>
    <g data-assembly-part="nearNut"><path d="M38 42h19v29H38z"/></g>
    <path d="M5 57h295" class="assembly-axis"/>
    ${choices.map(([key, , , x]) => `<path data-assembly-leader="${key}" d="M${x} 6v20" class="assembly-leader"/>`).join('')}
    </svg>`;
  const diagram = root.querySelector('svg');
  const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  preview.dataset.assemblyPreview = '';
  preview.setAttribute('role', 'img');
  preview.style.display = 'none';
  root.append(preview);
  let value = {},
    spec = null;
  function render() {
    root.querySelector('[data-assembly-head]').style.display = spec?.kind === 'rod' ? 'none' : '';
    for (const [key] of choices) {
      const input = root.querySelector(`[data-assembly-choice="${key}"]`);
      const part = root.querySelector(`[data-assembly-part="${key}"]`);
      const nearNut = key === 'nearNut';
      const nut = ['nearNut', 'nut', 'extraNut'].includes(key);
      const available = key === 'bolt' ? !!spec : nut ? !!spec?.nut : !!spec?.washer;
      const allowed =
        available &&
        (!nearNut || spec?.kind === 'rod') &&
        (key !== 'nearWasher' || spec?.head?.kind !== 'countersunk') &&
        (key !== 'extraNut' || value.nut);
      input.checked = key === 'bolt' ? value.bolt !== false : !!value[key];
      input.disabled = !allowed;
      input.parentElement.hidden = nearNut && spec?.kind !== 'rod';
      part.style.display = nearNut && spec?.kind !== 'rod' ? 'none' : '';
      root.querySelector(`[data-assembly-leader="${key}"]`).style.display = nearNut ? 'none' : '';
      part.setAttribute('data-active', String(input.checked));
      part.setAttribute('aria-hidden', 'true');
    }
  }
  for (const [key] of choices)
    root.querySelector(`[data-assembly-choice="${key}"]`).onchange = (e) => {
      value[key] = e.target.checked;
      if (key === 'nut' && !value.nut) value.extraNut = false;
      render();
      changed({ ...value });
    };
  return {
    set(nextSpec, nextValue) {
      spec = nextSpec;
      value = { ...assemblyDefaults(spec || { kind: 'wood' }), ...nextValue };
      if (!spec?.nut) value.nearNut = value.nut = value.extraNut = false;
      if (spec?.kind !== 'rod') value.nearNut = false;
      if (!spec?.washer) value.nearWasher = value.farWasher = false;
      if (spec?.head?.kind === 'countersunk') value.nearWasher = false;
      if (!value.nut) value.extraNut = false;
      render();
    },
    get: () => ({ ...value }),
    preview(source, reversed = false) {
      diagram.style.display = source ? 'none' : '';
      diagram.style.transform = reversed ? 'scaleX(-1)' : '';
      preview.style.display = source ? '' : 'none';
      if (source) paintFastenerAssemblyPreview(preview, source);
    },
  };
}
