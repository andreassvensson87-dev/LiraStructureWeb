import { adoptAttributeLabel } from '../inspector/attributes.js';

/** Presentation only: adapters supply existing controls and retain all handlers. */
export function createEditorSection(label, nodes, { open = true } = {}) {
  const section = document.createElement('details');
  section.className = 'ui-editor-section';
  section.open = open;
  const summary = document.createElement('summary');
  summary.textContent = label;
  section.append(summary, ...nodes);
  return section;
}

export function installEditorSurface(
  dialog,
  {
    layout,
    inspector,
    tracking,
    command,
    status,
    footer: existingFooter,
    labels = 'label.field',
    observe = false,
  },
) {
  dialog.classList.add('ui-standard-editor');
  layout.classList.add('ui-editor-body');
  inspector.classList.add('ui-editor-inspector');
  inspector.setAttribute('aria-label', 'Egenskaper');
  const footer = existingFooter || document.createElement('footer');
  footer.classList.add('ui-editor-footer');
  const controls = document.createElement('div');
  controls.className = 'ui-editor-quick-controls';
  if (tracking) controls.append(tracking);
  if (command) controls.append(command);
  if (tracking || command) footer.append(controls);
  if (status) {
    footer.append(status);
    status.classList.add('ui-editor-instruction');
  }
  dialog.append(footer);
  const refreshFields = () => {
    inspector.querySelectorAll(labels).forEach(adoptAttributeLabel);
    inspector
      .querySelectorAll('details')
      .forEach((node) => node.classList.add('ui-editor-section'));
  };
  refreshFields();
  if (observe) {
    const observer = new MutationObserver(refreshFields);
    observer.observe(inspector, { childList: true, subtree: true });
  }
  return { footer, refreshFields };
}
