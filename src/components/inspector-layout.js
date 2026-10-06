import { componentDefinition } from './definitions.js';
import { fastenerSeriesKey } from '../fasteners/assembly.js';

const group = (id, label, keys, collapsed = false) => ({ id, label, keys, collapsed });
const layouts = {
  fit: [
    group('fit', 'Anslutning', ['mode', 'gap']),
    group('placement', 'Anslutna ändar', ['endA', 'endB'], true),
  ],
  endplate: [
    group('plate', 'Plåt', ['sizeMode', 'thickness', 'outstandX', 'outstandY', 'width', 'length']),
    group('placement', 'Placering', ['endA', 'gap', 'plateRotation'], true),
  ],
  stiffener: [
    group('plate', 'Plåt', ['sides', 'thickness']),
    group('placement', 'Placering', ['referenceEnd', 'distance']),
    group('fit', 'Passning', ['gap', 'cornerRelief'], true),
  ],
  baseplate: [
    group('plate', 'Plåt', ['sizeMode', 'thickness', 'outstandX', 'outstandY', 'width', 'length']),
    group('anchors', 'Förankring', [
      'anchorKind',
      'anchorSpec',
      'rows',
      'columns',
      'spacingX',
      'spacingY',
    ]),
    group(
      'placement',
      'Placering',
      ['endA', 'elevationOffset', 'plateRotation', 'anchorRotation'],
      true,
    ),
    group(
      'anchor-details',
      'Hål och tillbehör',
      ['holeDiameter', 'embedment', 'useWasher', 'doubleNut'],
      true,
    ),
  ],
  boltedEndplate: [
    group('plate', 'Plåt', ['sizeMode', 'thickness', 'outstandX', 'outstandY', 'width', 'length']),
    group('bolts', 'Skruvar', ['boltSpec', 'rows', 'columns', 'spacingX', 'spacingY']),
    group('placement', 'Placering', ['endB', 'gap', 'offsetX', 'offsetY'], true),
    group('length', 'Skruvlängd', ['lengthMode', 'extraLength'], true),
    group(
      'holes',
      'Hål och tillbehör',
      ['holeDiameter', 'edgeDistance', 'clearance', 'nearWasher', 'farWasher'],
      true,
    ),
  ],
};
layouts.beamSplice = layouts.boltedEndplate.map((section) =>
  section.id === 'placement' ? { ...section, keys: ['endA', ...section.keys] } : section,
);
/** The same disclosure layout works for every connection without changing its parameter schema. */
export function componentInspectorSections(kind) {
  const parameters = componentDefinition(kind).parameters;
  const layout = layouts[kind] || [
    group(
      'parameters',
      'Inställningar',
      parameters.map((p) => p.key),
    ),
  ];
  return layout.map((section) => ({
    ...section,
    parameters: section.keys.map((key) => parameters.find((p) => p.key === key)),
  }));
}
export function componentFastenerOptions(records, snapshot, seriesMode = false) {
  const choices = [...records];
  if (snapshot && !choices.some((s) => s.id === snapshot.id && s.revision === snapshot.revision))
    choices.unshift(snapshot);
  if (!seriesMode) return choices.map((spec) => ({ spec, label: spec.name }));
  const selected = snapshot ? fastenerSeriesKey(snapshot) : null;
  const series = new Map();
  for (const spec of choices) {
    const key = fastenerSeriesKey(spec);
    if (!series.has(key)) series.set(key, key === selected ? snapshot : spec);
  }
  const options = [...series.values()].map((spec) => ({
    spec,
    label:
      spec.standard || spec.series
        ? [
            spec.standard,
            spec.series,
            `M${spec.diameter}`,
            spec.grade,
            spec.coating,
            spec.manufacturer,
          ]
            .filter(Boolean)
            .join(' · ')
        : spec.name,
  }));
  const labels = new Map();
  for (const option of options) labels.set(option.label, (labels.get(option.label) || 0) + 1);
  return options.map((option) =>
    labels.get(option.label) > 1
      ? { ...option, label: `${option.label} · ${option.spec.name}` }
      : option,
  );
}
export function componentInspectorSummary(s) {
  const plate = Number.isFinite(s.plateWidth)
    ? `${+s.plateWidth.toFixed(1)} × ${+s.plateLength.toFixed(1)} × ${s.thickness} mm`
    : '';
  if (['boltedEndplate', 'beamSplice'].includes(s.kind)) {
    const sizes = [...new Set(s.boltLayout.map((b) => `M${b.spec.diameter}×${b.spec.length}`))];
    return `${s.kind === 'beamSplice' ? '2 plåtar · ' : ''}${plate} · ${s.boltLayout.length} × ${sizes.join(', ')}`;
  }
  if (s.kind === 'endplate' || s.kind === 'baseplate') return plate;
  if (s.kind === 'stiffener')
    return `${s.profileType === 'u' || s.sides !== 'both' ? '1 plåt' : '2 plåtar'} · ${s.thickness} mm`;
  return (componentDefinition(s.kind).notices?.(s) || []).join('. ');
}
