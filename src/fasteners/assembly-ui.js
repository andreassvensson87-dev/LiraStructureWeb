import { assemblyDefaults } from './assembly.js';

const choices = [
  ['nearNut', 'Mutter före delarna', 22],
  ['nearWasher', 'Bricka före delarna', 42],
  ['farWasher', 'Bricka efter delarna', 124],
  ['nut', 'Mutter', 145],
  ['extraNut', 'Extra mutter', 166],
];
/** A schematic section is controlled by the same choices used by the geometry resolver. */
export function createAssemblyPicker(root, changed) {
  root.className = 'fastener-assembly-picker';
  root.innerHTML = `<div class="fastener-assembly-picture"><svg viewBox="0 0 140 205" aria-label="Schematisk bild av förbandet" role="group">
    <rect x="54" y="10" width="32" height="185" rx="2" class="assembly-shaft"/>
    <rect data-head x="43" y="3" width="54" height="20" class="assembly-metal"/>
    <rect x="14" y="58" width="112" height="26" class="assembly-part"/>
    <rect x="14" y="88" width="112" height="26" class="assembly-part assembly-part-second"/>
    ${choices.map(([key, label, y]) => `<g data-assembly-part="${key}" role="button" tabindex="0" aria-label="${label}"><rect x="${key.toLowerCase().includes('washer') ? 28 : 43}" y="${y}" width="${key.toLowerCase().includes('washer') ? 84 : 54}" height="${key.toLowerCase().includes('washer') ? 7 : 17}" rx="1"/></g>`).join('')}
    </svg></div><div class="fastener-assembly-choices">${choices.map(([key, label]) => `<label class="fastener-check"><input type="checkbox" data-assembly-choice="${key}">${label}</label>`).join('')}</div>`;
  let value = {},
    spec = null;
  function render() {
    root.querySelector('[data-head]').style.display = spec?.kind === 'rod' ? 'none' : '';
    for (const [key] of choices) {
      const input = root.querySelector(`[data-assembly-choice="${key}"]`);
      const part = root.querySelector(`[data-assembly-part="${key}"]`);
      const nut = ['nearNut', 'nut', 'extraNut'].includes(key);
      const available = nut ? !!spec?.nut : !!spec?.washer;
      const allowed =
        available &&
        (key !== 'nearNut' || spec?.kind === 'rod') &&
        (key !== 'nearWasher' || spec?.head?.kind !== 'countersunk') &&
        (key !== 'extraNut' || value.nut);
      input.checked = !!value[key];
      input.disabled = !allowed;
      input.parentElement.hidden = key === 'nearNut' && spec?.kind !== 'rod';
      part.style.display = key === 'nearNut' && spec?.kind !== 'rod' ? 'none' : '';
      part.setAttribute('data-active', String(!!value[key]));
      part.setAttribute('aria-pressed', String(!!value[key]));
      part.setAttribute('aria-disabled', String(!allowed));
      part.setAttribute('tabindex', allowed ? '0' : '-1');
    }
  }
  function toggle(key) {
    if (root.querySelector(`[data-assembly-choice="${key}"]`).disabled) return;
    value[key] = !value[key];
    if (key === 'nut' && !value.nut) value.extraNut = false;
    render();
    changed({ ...value });
  }
  for (const [key] of choices) {
    root.querySelector(`[data-assembly-choice="${key}"]`).onchange = () => toggle(key);
    const part = root.querySelector(`[data-assembly-part="${key}"]`);
    part.onclick = () => toggle(key);
    part.onkeydown = (e) => {
      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        toggle(key);
      }
    };
  }
  return {
    set(nextSpec, nextValue) {
      spec = nextSpec;
      value = { ...(nextValue || (spec ? assemblyDefaults(spec) : {})) };
      render();
    },
    get: () => ({ ...value }),
  };
}
