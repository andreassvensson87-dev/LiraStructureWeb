const drafts = new WeakMap();

/** Pending presentation only. Owners decide when a value has actually been committed. */
export function setInspectorFieldState(control, { changed = false, invalid = false } = {}) {
  const targets = [
    control,
    ...(control.closest?.('label')?.querySelectorAll('[data-inspector-value]') || []),
  ];
  for (const target of targets) {
    target.toggleAttribute('data-inspector-pending', changed);
    target.toggleAttribute('data-inspector-invalid', invalid);
    if (invalid) target.setAttribute('aria-invalid', 'true');
    else target.removeAttribute('aria-invalid');
  }
}

export function inspectorFieldValue(control, value = control.value) {
  if (control.hasAttribute('data-inspector-choice')) return control.getAttribute('aria-pressed');
  if (control.type === 'checkbox' || control.type === 'radio')
    return value === control.value ? !!control.checked : !!value;
  if (control.type === 'number' && String(value).trim() && Number.isFinite(Number(value)))
    return Number(value);
  return String(value ?? '');
}

/** For fields which commit on change: typing is pending; successful commits clear it. */
export function bindInspectorField(control, committed) {
  const sync = () => {
    setInspectorFieldState(control, {
      changed: inspectorFieldValue(control) !== inspectorFieldValue(control, committed()),
      invalid: control.validity?.valid === false,
    });
  };
  for (const event of ['input', 'change', 'blur']) control.addEventListener(event, sync);
  sync();
  return sync;
}

/** Explicit draft forms snapshot their baseline on load/reset/success, never on submit alone. */
export function createInspectorDraft(
  root,
  {
    selector = 'input,select,textarea,[data-inspector-choice]',
    filter = () => true,
    onChange,
  } = {},
) {
  drafts.get(root)?.dispose();
  let baseline = new Map();
  const controls = () =>
    [...root.querySelectorAll(selector)].filter(
      (control) =>
        filter(control) &&
        !control.matches(
          '.property-copy-check,input[type=search],input[type=file],input[type=hidden]',
        ),
    );
  const key = (control) => control.dataset.inspectorKey || control.id || control.name || control;
  function sync() {
    const current = controls();
    const identities = new Set(current.map(key));
    let changed = [...baseline.keys()].some((identity) => !identities.has(identity));
    for (const control of current) {
      const identity = key(control);
      const pending =
        baseline.size > 0 &&
        (!baseline.has(identity) || baseline.get(identity) !== inspectorFieldValue(control));
      changed ||= pending;
      setInspectorFieldState(control, {
        changed: pending,
        invalid: !control.disabled && control.validity?.valid === false,
      });
    }
    onChange?.(changed);
    return changed;
  }
  function accept() {
    baseline = new Map(controls().map((control) => [key(control), inspectorFieldValue(control)]));
    sync();
  }
  // Capture also sees nested widgets that intentionally stop bubbling to the object inspector.
  root.addEventListener('input', sync, { capture: true });
  root.addEventListener('change', sync, { capture: true });
  root.addEventListener('input', sync);
  root.addEventListener('change', sync);
  accept();
  const draft = {
    sync,
    accept,
    dispose() {
      root.removeEventListener('input', sync, { capture: true });
      root.removeEventListener('change', sync, { capture: true });
      root.removeEventListener('input', sync);
      root.removeEventListener('change', sync);
      for (const control of controls()) setInspectorFieldState(control);
      baseline.clear();
      drafts.delete(root);
    },
  };
  drafts.set(root, draft);
  return draft;
}
