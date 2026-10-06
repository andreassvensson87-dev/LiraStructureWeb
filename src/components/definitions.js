import { beamSpliceDefaults, resolveBeamSplice } from './beam-splice.js';
import { boltedEndplateDefaults, resolveBoltedEndplate } from './bolted-endplate.js';
import { endplateDefaults, resolveEndplate } from './endplate.js';
import { stiffenerDefaults, resolveStiffener } from './stiffener.js';
import { baseplateDefaults, resolveBaseplate } from './baseplate.js';
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
      notices: (s) => (s.profileOverlap === false ? ['Ingen gemensam kontaktyta'] : []),
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
  [
    'baseplate',
    {
      kind: 'baseplate',
      label: 'Fotplåt',
      defaults: baseplateDefaults,
      references: ['Pelare'],
      notices: (s) =>
        s.anchorKind === 'concrete' && s.anchorSpec
          ? [
              `Produktens förankringsdjup ${s.anchorSpec.anchor.embedment} mm · borr Ø${s.anchorSpec.anchor.drillDiameter} × ${s.anchorSpec.anchor.drillDepth} mm`,
            ]
          : [],
      resolve: resolveBaseplate,
      parameters: [
        {
          key: 'sizeMode',
          label: 'Plåtmått',
          options: [
            ['outstand', 'Utstick från pelare'],
            ['manual', 'Fasta mått'],
          ],
        },
        ...['X', 'Y'].map((axis) => ({
          key: `outstand${axis}`,
          label: `Utstick ${axis} (mm)`,
          type: 'number',
          min: 0,
          max: 10000,
          hidden: (s) => s.sizeMode !== 'outstand',
        })),
        {
          key: 'width',
          label: 'Bredd (mm)',
          type: 'number',
          min: 1,
          max: 10000,
          hidden: (s) => s.sizeMode !== 'manual',
        },
        {
          key: 'length',
          label: 'Längd (mm)',
          type: 'number',
          min: 1,
          max: 10000,
          hidden: (s) => s.sizeMode !== 'manual',
        },
        { key: 'thickness', label: 'Plåttjocklek (mm)', type: 'number', min: 1, max: 10000 },
        {
          key: 'elevationOffset',
          label: 'Nivåjustering (mm)',
          type: 'number',
          min: -10000,
          max: 10000,
        },
        { key: 'plateRotation', label: 'Plåtrotation (°)', type: 'number' },
        {
          key: 'anchorKind',
          label: 'Förankring',
          options: [
            ['none', 'Utan skruvar'],
            ['rod', 'Gängstång med mutter'],
            ['concrete', 'Betongskruv'],
          ],
        },
        {
          key: 'anchorSpec',
          label: 'Skruv ur biblioteket',
          type: 'fastener',
          hidden: (s) => s.anchorKind === 'none',
        },
        ...[
          ['rows', 'Rader'],
          ['columns', 'Kolumner'],
        ].map(([key, label]) => ({
          key,
          label,
          type: 'number',
          min: 1,
          max: 100,
          step: 1,
          hidden: (s) => s.anchorKind === 'none',
        })),
        ...['X', 'Y'].map((axis) => ({
          key: `spacing${axis}`,
          label: `Skruvavstånd ${axis} (mm)`,
          type: 'number',
          min: 0,
          max: 10000,
          hidden: (s) => s.anchorKind === 'none',
        })),
        {
          key: 'anchorRotation',
          label: 'Skruvmönstrets rotation (°)',
          type: 'number',
          hidden: (s) => s.anchorKind === 'none',
        },
        {
          key: 'holeDiameter',
          label: 'Håldiameter (mm)',
          type: 'number',
          min: 1,
          max: 1000,
          hidden: (s) => s.anchorKind === 'none',
        },
        {
          key: 'embedment',
          label: 'Förankringsdjup (mm)',
          type: 'number',
          min: 1,
          max: 10000,
          hidden: (s) => s.anchorKind !== 'rod',
        },
        {
          key: 'useWasher',
          label: 'Bricka mot plåt',
          type: 'checkbox',
          hidden: (s) => s.anchorKind === 'none',
        },
        {
          key: 'doubleNut',
          label: 'Dubbel mutter',
          type: 'checkbox',
          hidden: (s) => s.anchorKind !== 'rod',
        },
        {
          key: 'endA',
          label: 'Pelarände',
          advanced: true,
          options: [
            ['start', 'Start'],
            ['end', 'Slut'],
          ],
        },
      ],
    },
  ],
  [
    'stiffener',
    {
      kind: 'stiffener',
      label: 'Avstyvning',
      defaults: stiffenerDefaults,
      references: ['Balk / pelare'],
      resolve: resolveStiffener,
      notices: (s) => [
        s.profileType === 'u' ? 'Plåt inne i U-profilen' : 'Plåtar anpassas till liv och flänsar',
      ],
      parameters: [
        {
          key: 'sides',
          label: 'Sida om livet',
          options: [
            ['both', 'Båda sidor · plåtpar'],
            ['positive', 'Positiv profilsida'],
            ['negative', 'Negativ profilsida'],
          ],
          hidden: (s) => s.profileType === 'u',
          section: 'Plåt',
        },
        {
          key: 'thickness',
          label: 'Plåttjocklek (mm)',
          type: 'number',
          min: 1,
          max: 1000,
          section: 'Plåt',
        },
        {
          key: 'gap',
          label: 'Passningsspalt (mm)',
          type: 'number',
          min: 0,
          max: 1000,
          section: 'Plåt',
        },
        {
          key: 'cornerRelief',
          label: 'Extra hörnurtag (mm)',
          type: 'number',
          min: 0,
          max: 1000,
          section: 'Plåt',
        },
        {
          key: 'referenceEnd',
          label: 'Mät från',
          options: [
            ['start', 'Startpunkt'],
            ['end', 'Slutpunkt'],
          ],
          section: 'Placering',
        },
        {
          key: 'distance',
          label: 'Avstånd från vald ände (mm)',
          wide: true,
          type: 'number',
          min: 0,
          max: 10000000,
          section: 'Placering',
        },
      ],
    },
  ],
  [
    'endplate',
    {
      kind: 'endplate',
      label: 'Ändplåt',
      defaults: endplateDefaults,
      references: ['Balk / pelare'],
      resolve: resolveEndplate,
      notices: (s) => [
        `Plåt ${s.plateWidth.toFixed(1)} × ${s.plateLength.toFixed(1)} × ${s.thickness} mm`,
      ],
      parameters: [
        {
          key: 'endA',
          label: 'Objektände',
          options: [
            ['start', 'Startpunkt'],
            ['end', 'Slutpunkt'],
          ],
          section: 'Placering',
        },
        {
          key: 'gap',
          label: 'Spalt mot objekt (mm)',
          type: 'number',
          min: 0,
          max: 1000,
          wide: true,
          section: 'Placering',
        },
        {
          key: 'sizeMode',
          label: 'Plåtmått',
          options: [
            ['outstand', 'Utstick från profil'],
            ['manual', 'Fasta mått'],
          ],
          section: 'Plåt',
        },
        ...['X', 'Y'].map((axis) => ({
          key: `outstand${axis}`,
          label: `Utstick ${axis} (mm)`,
          type: 'number',
          min: 0,
          max: 10000,
          hidden: (s) => s.sizeMode !== 'outstand',
          section: 'Plåt',
        })),
        {
          key: 'width',
          label: 'Bredd (mm)',
          type: 'number',
          min: 1,
          max: 10000,
          hidden: (s) => s.sizeMode !== 'manual',
          section: 'Plåt',
        },
        {
          key: 'length',
          label: 'Höjd (mm)',
          type: 'number',
          min: 1,
          max: 10000,
          hidden: (s) => s.sizeMode !== 'manual',
          section: 'Plåt',
        },
        {
          key: 'thickness',
          label: 'Plåttjocklek (mm)',
          type: 'number',
          min: 1,
          max: 1000,
          section: 'Plåt',
        },
        { key: 'plateRotation', label: 'Plåtrotation (°)', type: 'number', section: 'Plåt' },
      ],
    },
  ],
  [
    'boltedEndplate',
    {
      kind: 'boltedEndplate',
      label: 'Ändplåtskoppling',
      defaults: boltedEndplateDefaults,
      references: ['Pelare', 'Balk'],
      resolve: resolveBoltedEndplate,
      snapshotKeys: ['lengthOptions'],
      notices: (s) => [
        `Plåt ${s.plateWidth.toFixed(1)} × ${s.plateLength.toFixed(1)} × ${s.thickness} mm`,
        `${s.boltLayout.length} skruvar · ${[...new Set(s.boltLayout.map((b) => b.spec.name))].join(', ')}`,
      ],
      parameters: [
        {
          key: 'endB',
          label: 'Balkände',
          options: [
            ['start', 'Startpunkt'],
            ['end', 'Slutpunkt'],
          ],
          section: 'Placering',
        },
        {
          key: 'gap',
          label: 'Spalt mot pelarfläns (mm)',
          type: 'number',
          min: 0,
          max: 1000,
          wide: true,
          section: 'Placering',
        },
        {
          key: 'sizeMode',
          label: 'Plåtmått',
          options: [
            ['outstand', 'Utstick från balk'],
            ['manual', 'Fasta mått'],
          ],
          section: 'Plåt',
        },
        ...['X', 'Y'].map((axis) => ({
          key: `outstand${axis}`,
          label: `Utstick ${axis} (mm)`,
          type: 'number',
          min: 0,
          max: 10000,
          hidden: (s) => s.sizeMode !== 'outstand',
          section: 'Plåt',
        })),
        ...[
          ['width', 'Bredd'],
          ['length', 'Höjd'],
        ].map(([key, label]) => ({
          key,
          label: `${label} (mm)`,
          type: 'number',
          min: 1,
          max: 10000,
          hidden: (s) => s.sizeMode !== 'manual',
          section: 'Plåt',
        })),
        {
          key: 'thickness',
          label: 'Plåttjocklek (mm)',
          type: 'number',
          min: 1,
          max: 1000,
          section: 'Plåt',
        },
        {
          key: 'boltSpec',
          label: 'Skruv ur biblioteket',
          type: 'fastener',
          fastenerKind: 'bolt',
          section: 'Skruvar',
        },
        {
          key: 'lengthMode',
          label: 'Skruvlängd',
          options: [
            ['auto', 'Automatisk ur biblioteket'],
            ['manual', 'Vald bibliotekslängd'],
          ],
          section: 'Skruvar',
        },
        {
          key: 'extraLength',
          label: 'Extra längd efter mutter (mm)',
          type: 'number',
          min: 0,
          max: 1000,
          section: 'Skruvar',
        },
        ...[
          ['rows', 'Rader'],
          ['columns', 'Kolumner'],
        ].map(([key, label]) => ({
          key,
          label,
          type: 'number',
          min: 1,
          max: 100,
          step: 1,
          section: 'Skruvmönster',
        })),
        ...['X', 'Y'].map((axis) => ({
          key: `spacing${axis}`,
          label: `Skruvavstånd ${axis} (mm)`,
          type: 'number',
          min: 0,
          max: 10000,
          section: 'Skruvmönster',
        })),
        ...['X', 'Y'].map((axis) => ({
          key: `offset${axis}`,
          label: `Förskjutning ${axis} (mm)`,
          type: 'number',
          min: -10000,
          max: 10000,
          section: 'Skruvmönster',
        })),
        {
          key: 'holeDiameter',
          label: 'Håldiameter (mm)',
          type: 'number',
          min: 1,
          max: 1000,
          section: 'Hål och passning',
        },
        {
          key: 'edgeDistance',
          label: 'Minsta kantavstånd (mm)',
          type: 'number',
          min: 1,
          max: 1000,
          section: 'Hål och passning',
        },
        {
          key: 'clearance',
          label: 'Fri plats vid tillbehör (mm)',
          type: 'number',
          min: 0,
          max: 1000,
          section: 'Hål och passning',
        },
        { key: 'nearWasher', label: 'Bricka under huvud', type: 'checkbox', section: 'Tillbehör' },
        { key: 'farWasher', label: 'Bricka vid mutter', type: 'checkbox', section: 'Tillbehör' },
      ],
    },
  ],
]);
// Share the established bolt/plate fields; each connection supplies its own geometry and references.
const spliceParameters = definitions.get('boltedEndplate').parameters.map((p) => ({
  ...p,
  ...(p.key === 'endB' ? { label: 'Andra balkänden' } : {}),
  ...(p.key === 'gap' ? { label: 'Spalt mellan plåtar (mm)' } : {}),
}));
definitions.set('beamSplice', {
  kind: 'beamSplice',
  label: 'Balkskarv',
  defaults: beamSpliceDefaults,
  references: ['Första balk', 'Andra balk'],
  resolve: resolveBeamSplice,
  snapshotKeys: ['lengthOptions'],
  parameters: [
    {
      key: 'endA',
      label: 'Första balkänden',
      options: [
        ['start', 'Startpunkt'],
        ['end', 'Slutpunkt'],
      ],
    },
    ...spliceParameters,
  ],
});
export function componentDefinition(kind) {
  const definition = definitions.get(kind);
  if (!definition) throw new Error(`Okänd koppling: ${kind}`);
  return definition;
}
export function resolveComponentDraft(source, changes, objects) {
  const definition = componentDefinition(source.kind);
  const allowed = new Set([
    'references',
    ...(definition.snapshotKeys || []),
    ...definition.parameters.map((p) => p.key),
  ]);
  if (Object.keys(changes).some((key) => !allowed.has(key)))
    throw new Error('Ogiltig kopplingsparameter.');
  return definition.resolve({ ...structuredClone(source), ...structuredClone(changes) }, objects);
}
export function componentDraftChanged(source, draft) {
  const definition = componentDefinition(source.kind);
  return [
    'references',
    ...(definition.snapshotKeys || []),
    ...definition.parameters.map((p) => p.key),
  ].some((key) => JSON.stringify(source[key]) !== JSON.stringify(draft[key]));
}
