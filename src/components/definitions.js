import { resolveFit } from './fit.js';

/** Component-specific fields plug into the same references, preview and Modify transaction. */
const definitions = new Map([
  [
    'fit',
    {
      kind: 'fit',
      label: 'Fit',
      defaults: { mode: 'miter', gap: 0, endA: 'end', endB: 'end' },
      references: ['Första sweep', 'Andra sweep'],
      parameters: [
        {
          key: 'mode',
          label: 'Utförande',
          options: [
            ['miter', 'Gerning'],
            ['abut', 'Genomgående'],
          ],
        },
        { key: 'gap', label: 'Spalt (mm)', type: 'number', min: 0, max: 1000 },
        {
          key: 'endA',
          advanced: true,
          label: 'Ände på första sweep',
          options: [
            ['start', 'Start'],
            ['end', 'Slut'],
          ],
          hidden: (s) => s.mode === 'abut',
        },
        {
          key: 'endB',
          advanced: true,
          label: 'Ände på andra sweep',
          options: [
            ['start', 'Start'],
            ['end', 'Slut'],
          ],
        },
      ],
      resolve: resolveFit,
    },
  ],
]);
export function componentDefinition(kind) {
  const definition = definitions.get(kind);
  if (!definition) throw new Error(`Okänd koppling: ${kind}`);
  return definition;
}
export function resolveComponentDraft(source, changes, objects) {
  const definition = componentDefinition(source.kind);
  const allowed = new Set(['references', ...definition.parameters.map((p) => p.key)]);
  if (Object.keys(changes).some((key) => !allowed.has(key)))
    throw new Error('Ogiltig kopplingsparameter.');
  return definition.resolve({ ...structuredClone(source), ...structuredClone(changes) }, objects);
}
export function componentDraftChanged(source, draft) {
  const definition = componentDefinition(source.kind);
  return ['references', ...definition.parameters.map((p) => p.key)].some(
    (key) => JSON.stringify(source[key]) !== JSON.stringify(draft[key]),
  );
}
