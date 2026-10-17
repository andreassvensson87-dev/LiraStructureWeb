import { createInspectorDraft, setInspectorFieldState } from '../inspector/field-state.js';
import { createEditorSection } from '../ui/editor-surface.js';
import { createAttributeRow } from '../inspector/attributes.js';
import { blockButton } from './editor-fields.js';
/** Shared fields; callbacks own preview, rollback, update and definition editing. */
export function renderBlockInstance(
  root,
  { members, preview, commit, reset, edit, detach, update, message },
) {
  root.replaceChildren();
  root.hidden = !members.length;
  if (!members.length) return;
  const block = members[0].parametricBlock,
    values = { ...block.values };
  const rows = block.definition.parameters.map((parameter) => {
    const row = createAttributeRow(
      {
        key: parameter.name,
        label: parameter.description || parameter.name,
        unit: parameter.unit,
        type: 'text',
      },
      { value: block.values[parameter.name] ?? parameter.value },
    );
    const input = row.querySelector('input');
    input.setAttribute('aria-label', `Blockparameter ${parameter.name}`);
    input.oninput = () => {
      values[parameter.name] = input.value;
      try {
        preview(values);
        message.textContent = '';
        input.setCustomValidity('');
        fieldDraft.sync();
      } catch (error) {
        message.textContent = error.message;
        input.setCustomValidity(error.message);
        setInspectorFieldState(input, { changed: true, invalid: true });
        apply.disabled = true;
      }
    };
    return row;
  });
  const note = document.createElement('p');
  note.className = 'inspector-note';
  note.textContent = `${block.definition.name} · v${block.definition.revision} · ${members.length} ${members.length === 1 ? 'del' : 'delar'}`;
  const apply = blockButton('Uppdatera block', () => {
    try {
      commit(values);
      fieldDraft.accept();
    } catch (error) {
      message.textContent = error.message;
    }
  });
  const safely = (action) => () => {
    try {
      action();
    } catch (error) {
      message.textContent = error.message;
    }
  };
  apply.className = 'primary';
  root.append(
    createEditorSection('Parametriskt block', [
      note,
      ...rows,
      apply,
      blockButton('Återställ', reset),
      blockButton('Redigera block…', safely(edit)),
      blockButton('Uppdatera till senaste version', safely(update)),
      blockButton('Frigör delar', safely(detach)),
      message,
    ]),
  );
  const fieldDraft = createInspectorDraft(root, {
    onChange: (changed) => {
      apply.disabled = !changed || !!message.textContent;
    },
  });
}
