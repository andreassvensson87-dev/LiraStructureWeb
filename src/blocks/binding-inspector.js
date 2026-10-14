import { createEditorSection } from '../ui/editor-surface.js';
import { blockField, blockButton } from './editor-fields.js';
import { blockPoints, pointBindingStates } from './point-bindings.js';
/** Reports selection and batch binding intentions to the existing block session. */
export function renderPointBindings({
  panel,
  definition,
  points,
  draft,
  selectPoint,
  stage,
  apply,
  release,
}) {
  const heading = document.createElement('h3');
  heading.textContent = 'Låsningar';
  panel.append(heading);
  const choices = blockPoints(definition),
    selected = choices.filter((p) => points.has(p.key));
  panel.append(
    blockField(
      'Lägg till punkt',
      '',
      (key) => {
        if (!points.has(key)) selectPoint(key, true, true);
      },
      { options: [['', 'Välj punkt…'], ...choices.map((p) => [p.key, p.name])] },
    ),
  );
  const title = document.createElement('p');
  title.textContent = selected.length
    ? `${selected.length} ${selected.length === 1 ? 'punkt vald' : 'punkter valda'}`
    : 'Välj punkter i förhandsvisningen. Shift-klick väljer fler.';
  panel.append(title);
  if (!selected.length) return;
  const list = document.createElement('div');
  list.className = 'block-selected-points';
  for (const p of selected) {
    const row = blockButton(p.name, () => selectPoint(p.key, true, true));
    row.title = 'Ta bort punkten från urvalet';
    list.append(row);
  }
  panel.append(list);
  const reference = definition.references.find((r) => r.id === draft.referenceId),
    axis = reference?.axis;
  const direction = document.createElement('p');
  direction.textContent = reference
    ? `Låst axel: ${['X', 'Y', 'Z'][axis]} · Övriga axlars låsningar behålls`
    : 'Välj en referens för kopplingen.';
  const lock = blockButton(
    `Lås ${selected.length} ${selected.length === 1 ? 'punkt' : 'punkter'}`,
    apply,
  );
  lock.className = 'primary';
  lock.disabled = !reference;
  const nodes = [
    blockField(
      definition.dimension === 3 ? 'Referensplan' : 'Referenslinje',
      draft.referenceId || '',
      (id) => stage({ referenceId: id }),
      {
        options: [
          ['', 'Välj referens…'],
          ...definition.references.map((r) => [r.id, `${r.name} · ${r.value}`]),
        ],
      },
    ),
    direction,
    blockField('Offset / uttryck', draft.offset, (offset) => stage({ offset })),
    lock,
  ];
  if (reference) nodes.push(blockButton(`Frigör ${['X', 'Y', 'Z'][axis]}`, () => release(axis)));
  panel.append(createEditorSection('Koppling', nodes));
  const states = pointBindingStates(definition, [...points]);
  panel.append(
    createEditorSection(
      'Befintliga låsningar',
      states.map((state) => {
        const row = document.createElement('div');
        const existingReference = definition.references.find((r) => r.id === state.referenceId);
        row.textContent = `${['X', 'Y', 'Z'][state.axis]}: ${state.mixed ? 'Blandat' : existingReference ? `${existingReference.name} · offset ${state.offset}` : 'Fri'}`;
        return row;
      }),
    ),
  );
}
