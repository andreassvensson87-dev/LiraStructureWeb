import { installDialogPresentation } from './dialog-presentation.js';
import { createAttributeRow } from '../inspector/attributes.js';
import './mark-change-dialog.css';

export function createMarkChangeButton(onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mark-change-button';
  button.textContent = 'Byt mark…';
  button.onclick = onClick;
  return button;
}

/** Shared presentation for both numbering types; the caller owns validation/commit. */
export function createMarkChangeDialog({ preview, commit }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'mark-change-dialog';
  dialog.setAttribute('aria-labelledby', 'mark-change-title');
  dialog.innerHTML = `<form novalidate>
    <div class="panel-title"><h2 id="mark-change-title"></h2><button type="button" data-close aria-label="Stäng Byt mark">×</button></div>
    <div class="mark-change-fields"></div>
    <section class="mark-change-impact"><h3>Påverkan</h3><dl>
      <div><dt data-kind></dt><dd data-count></dd></div>
      <div><dt>Ritningsnummer och namn</dt><dd data-drawings></dd></div>
      <div><dt>Nästa numrering</dt><dd data-next></dd></div>
    </dl></section>
    <p role="status"></p><p role="alert"></p>
    <div class="settings-actions"><button type="button" data-cancel>Avbryt</button><button type="submit" class="primary">Byt mark</button></div>
  </form>`;
  const $ = (selector) => dialog.querySelector(selector);
  const oldRow = createAttributeRow({ key: 'current-mark', label: 'Nuvarande mark', type: 'text' });
  const newRow = createAttributeRow({ key: 'new-mark', label: 'Ny mark', type: 'text' });
  const oldInput = oldRow.querySelector('input'),
    input = newRow.querySelector('input');
  oldInput.readOnly = true;
  input.maxLength = 32;
  $('.mark-change-fields').append(oldRow, newRow);
  document.body.append(dialog);
  installDialogPresentation(dialog);
  let plan;
  const refresh = () => {
    plan = null;
    $('[role="status"]').textContent = '';
    $('[role="alert"]').textContent = '';
    $('button[type="submit"]').disabled = true;
    $('[data-drawings]').textContent = `${oldInput.value} → ${input.value.trim() || '—'}`;
    $('[data-next]').textContent = '—';
    try {
      plan = preview(input.value);
      $('[data-count]').textContent = `${plan.count} st`;
      $('[data-next]').textContent = `Behåller ${plan.mark}`;
      $('[role="status"]').textContent = plan.unchanged ? '' : '✓ Marken är ledig';
      $('button[type="submit"]').disabled = plan.unchanged;
    } catch (error) {
      $('[role="alert"]').textContent = error.message;
    }
  };
  input.addEventListener('input', refresh);
  $('form').onsubmit = (event) => {
    event.preventDefault();
    if (!plan || plan.unchanged) return;
    try {
      commit(plan);
      dialog.close();
    } catch (error) {
      $('[role="alert"]').textContent = error.message;
      $('button[type="submit"]').disabled = true;
    }
  };
  for (const selector of ['[data-close]', '[data-cancel]'])
    $(selector).onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    plan = null;
  });
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  return {
    open(kind, current) {
      $('#mark-change-title').textContent = kind === 'part' ? 'Byt partmark' : 'Byt assemblymark';
      $('[data-kind]').textContent =
        kind === 'part' ? 'Parter med samma mark' : 'Assemblies med samma mark';
      oldInput.value = input.value = current;
      refresh();
      dialog.showModal();
      input.focus();
      input.select();
    },
  };
}
