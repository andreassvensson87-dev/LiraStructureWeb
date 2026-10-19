/** Enter uses the owning form/action; multiline content retains its ordinary line breaks. */
export function installInspectorEnter(root, confirm) {
  const key = (event) => {
    const control = event.target;
    if (
      event.defaultPrevented ||
      event.key !== 'Enter' ||
      event.isComposing ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !control.matches?.('input:not([type=button]):not([type=submit]),select') ||
      ['search', 'file', 'hidden', 'button', 'submit'].includes(control.type) ||
      control.getAttribute?.('role') === 'combobox' ||
      control.disabled ||
      control.closest('[contenteditable=true]')
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (control.checkValidity && !control.checkValidity()) {
      control.reportValidity();
      return;
    }
    if (confirm) confirm(control);
    else {
      const form = control.form;
      if (form) {
        const submit = form.querySelector('[type=submit]');
        if (!submit?.disabled) form.requestSubmit(submit || undefined);
      } else control.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  root.addEventListener('keydown', key);
  return () => root.removeEventListener('keydown', key);
}
