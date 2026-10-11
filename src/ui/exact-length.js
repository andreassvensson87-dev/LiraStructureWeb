// Presentation only: tool controllers retain input, submit and validation ownership.
export function installExactLength(
  footer,
  { form = document.createElement('form'), input, label },
) {
  form.classList.add('ui-exact-length');
  input ||= document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.placeholder = '0';
  input.setAttribute('aria-label', 'Exakt längd eller radie · mm');
  input.title = 'Skriv ett mått · Enter bekräftar';
  const field = document.createElement('div');
  field.className = 'ui-exact-length-field';
  field.innerHTML =
    '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 3h20v10H2zM6 3v5m4-5v3m4-3v5m4-5v3"/></svg>';
  const unit = document.createElement('span');
  unit.textContent = 'mm';
  field.append(input, unit);
  if (label) {
    label.classList.add('ui-exact-length-label');
    form.prepend(label);
  }
  for (const submit of form.querySelectorAll('[type="submit"]')) submit.hidden = true;
  form.prepend(field);
  const slot = document.createElement('div');
  slot.className = 'ui-exact-length-slot';
  slot.append(form);
  footer.classList.add('ui-length-statusbar');
  const hint = footer.querySelector('.cad-hint') || footer.firstElementChild;
  hint.after(slot);
  return { form, input };
}
