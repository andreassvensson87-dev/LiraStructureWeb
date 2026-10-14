/** Reusable domain parameter descriptions; inspector layout is supplied separately. */
export function plateParameters({
  outstand = 'Utstick från profil',
  length = 'Höjd',
  thicknessMax = 1000,
} = {}) {
  return [
    {
      key: 'sizeMode',
      label: 'Plåtmått',
      options: [
        ['outstand', outstand],
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
    ...[
      ['width', 'Bredd'],
      ['length', length],
    ].map(([key, label]) => ({
      key,
      label: `${label} (mm)`,
      type: 'number',
      min: 1,
      max: 10000,
      hidden: (s) => s.sizeMode !== 'manual',
    })),
    { key: 'thickness', label: 'Plåttjocklek (mm)', type: 'number', min: 1, max: thicknessMax },
  ];
}
export function fastenerPatternParameters({ hidden } = {}) {
  return [
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
      ...(hidden ? { hidden } : {}),
    })),
    ...['X', 'Y'].map((axis) => ({
      key: `spacing${axis}`,
      label: `Skruvavstånd ${axis} (mm)`,
      type: 'number',
      min: 0,
      max: 10000,
      ...(hidden ? { hidden } : {}),
    })),
  ];
}
