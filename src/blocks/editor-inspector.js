import { createEditorSection } from '../ui/editor-surface.js';
import { blockField, blockButton } from './editor-fields.js';
import { renderPointBindings } from './binding-inspector.js';
import { renameBlockParameter } from './definition.js';
export function renderBlockInspector({
  panels,
  definition,
  result,
  points,
  draft,
  stage,
  apply,
  release,
  change,
  test,
  selectPoint,
}) {
  Object.values(panels).forEach((panel) => panel.replaceChildren());
  panels.parameters.append(
    blockField('Namn', definition.name, (value) => change((d) => (d.name = value))),
  );
  if (definition.dimension === 2)
    panels.parameters.append(
      blockField('Måttenhet', definition.units, (value) => change((d) => (d.units = value)), {
        options: [
          ['model', 'Modell · mm'],
          ['paper', 'Papper · mm'],
        ],
      }),
    );
  for (const [i, parameter] of definition.parameters.entries()) {
    const nodes = [
      blockField('Parameter', parameter.name, (value) =>
        change((d) => renameBlockParameter(d, parameter.name, value)),
      ),
      blockField('Standard / uttryck', parameter.value, (value) =>
        change((d) => (d.parameters[i].value = value)),
      ),
      blockField('Beskrivning', parameter.description || '', (value) =>
        change((d) => (d.parameters[i].description = value)),
      ),
      blockField(
        'Enhet',
        parameter.unit,
        (value) => change((d) => (d.parameters[i].unit = value)),
        {
          options: [
            ['mm', 'mm'],
            ['°', '°'],
            ['', 'Utan enhet'],
          ],
        },
      ),
      blockField('Min', parameter.min ?? '', (value) =>
        change((d) => (d.parameters[i].min = value === '' ? undefined : Number(value))),
      ),
      blockField('Max', parameter.max ?? '', (value) =>
        change((d) => (d.parameters[i].max = value === '' ? undefined : Number(value))),
      ),
      blockField('Testvärde', result.values[parameter.name], (value) =>
        test(parameter.name, value),
      ),
      blockButton('Ta bort parameter', () => change((d) => d.parameters.splice(i, 1))),
    ];
    const section = createEditorSection(`${parameter.name} · ${parameter.unit}`, nodes);
    section.dataset.blockParameter = parameter.name;
    panels.parameters.append(section);
  }
  panels.parameters.append(
    blockButton('Ny parameter', () =>
      change((d) => {
        let i = 1;
        while (d.parameters.some((p) => p.name === `P${i}`)) i++;
        d.parameters.push({ name: `P${i}`, value: 100, unit: 'mm' });
      }),
    ),
  );
  for (const [i, reference] of definition.references.entries()) {
    const section = createEditorSection(reference.name, [
      blockField('Namn', reference.name, (value) => change((d) => (d.references[i].name = value))),
      blockField(
        'Riktning',
        reference.axis,
        (value) => change((d) => (d.references[i].axis = Number(value))),
        {
          options: Array.from({ length: definition.dimension }, (_, axis) => [
            axis,
            ['X', 'Y', 'Z'][axis],
          ]),
        },
      ),
      blockField('Position / uttryck', reference.value, (value) =>
        change((d) => (d.references[i].value = value)),
      ),
      blockButton('Ta bort referens', () =>
        change((d) => {
          d.bindings = d.bindings.filter((b) => b.referenceId !== reference.id);
          d.references.splice(i, 1);
        }),
      ),
    ]);
    section.dataset.blockReference = reference.id;
    panels.references.append(section);
  }
  panels.references.append(
    blockButton(definition.dimension === 3 ? 'Nytt referensplan' : 'Ny referenslinje', () =>
      change((d) =>
        d.references.push({ id: crypto.randomUUID(), name: 'Ny referens', axis: 0, value: '0' }),
      ),
    ),
  );
  renderPointBindings({
    panel: panels.bindings,
    definition,
    points,
    draft,
    selectPoint,
    stage,
    apply,
    release,
  });
  const point = [...points].at(-1),
    separator = point?.lastIndexOf(':'),
    memberId = point?.slice(0, separator);
  const member = definition.members.find((m) => m.id === memberId);
  const propertyKeys =
    points.size === 1 && (member?.source.type === 'plate' || member?.source.shape === 'insulation')
      ? ['thickness']
      : [];
  for (const key of propertyKeys) {
    const property = definition.properties.find((p) => p.memberId === memberId && p.key === key);
    panels.bindings.append(
      blockField('Tjocklek / uttryck', property?.value || '', (value) =>
        change((d) => {
          d.properties = d.properties.filter((p) => !(p.memberId === memberId && p.key === key));
          if (value.trim()) d.properties.push({ memberId, key, value });
        }),
      ),
    );
  }
  for (const [i, anchor] of definition.anchors.entries())
    panels.anchors.append(
      createEditorSection(anchor.name, [
        blockField('Namn', anchor.name, (value) => change((d) => (d.anchors[i].name = value))),
        ...result.anchors[i].point.map((coordinate, axis) =>
          blockField(
            ['X', 'Y', 'Z'][axis],
            coordinate,
            (value) =>
              change((d) => {
                const binding = d.bindings.find(
                  (b) =>
                    b.memberId === anchor.id &&
                    d.references.find((r) => r.id === b.referenceId)?.axis === axis,
                );
                if (binding)
                  binding.offset = String(
                    value - result.references.find((r) => r.id === binding.referenceId).coordinate,
                  );
                else d.anchors[i].point[axis] = value;
              }),
            { type: 'number' },
          ),
        ),
        blockButton('Lås insättningspunkten…', () => selectPoint(`${anchor.id}:0`, true)),
        ...(definition.anchors.length > 1
          ? [
              blockButton('Ta bort insättningspunkt', () =>
                change((d) => {
                  d.anchors.splice(i, 1);
                  d.bindings = d.bindings.filter((b) => b.memberId !== anchor.id);
                }),
              ),
            ]
          : []),
      ]),
    );
  panels.anchors.append(
    blockButton('Ny insättningspunkt', () =>
      change((d) =>
        d.anchors.push({
          id: crypto.randomUUID(),
          name: 'Insättning',
          point: Array(d.dimension).fill(0),
        }),
      ),
    ),
  );
}
