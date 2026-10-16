export const MAX_PATTERN_FASTENERS = 100;

/** Distances are gaps, never coordinates. A single zero means one position. */
export function parseBoltDistances(text) {
  const tokens = String(text).trim().split(/\s+/);
  if (!tokens[0]) throw new Error('Ange delning eller 0 för en enda skruv.');
  const values = tokens.flatMap((token) => {
    const match = /^(?:(\d+)\*)?(\d+(?:[.,]\d+)?)$/.exec(token);
    if (!match) throw new Error('Ange delningar som 60 80 60 eller 3*60.');
    const count = Number(match[1] || 1),
      value = Number(match[2].replace(',', '.'));
    if (count < 1 || count >= MAX_PATTERN_FASTENERS || value > 100000)
      throw new Error('Ogiltig delning eller för många skruvar.');
    return Array(count).fill(value);
  });
  if (values.length === 1 && values[0] === 0) return [];
  if (values.length >= MAX_PATTERN_FASTENERS || values.some((v) => v <= 0))
    throw new Error('Delningar måste vara positiva. Använd 0 enbart för en enda position.');
  return values;
}

export function parseBoltCoordinates(text) {
  const values = String(text)
    .trim()
    .split(/\s+/)
    .map((v) => Number(v.replace(',', '.')));
  if (!String(text).trim() || values.some((v) => !Number.isFinite(v) || Math.abs(v) > 100000))
    throw new Error('Ange giltiga koordinater inom ±100 000.');
  return values;
}

export function patternPositions(group) {
  const shape = group.shape || 'array';
  let result;
  if (shape === 'array') {
    const offsets = (count, distances, spacing) => {
      const gaps = distances ?? Array(count - 1).fill(spacing);
      if (
        !Array.isArray(gaps) ||
        gaps.length !== count - 1 ||
        gaps.some((v) => !Number.isFinite(v) || v <= 0 || v > 100000)
      )
        throw new Error(
          'Ange positivt skruvavstånd och rätt antal delningar för rader och kolumner.',
        );
      return gaps.reduce((list, v) => [...list, list.at(-1) + v], [0]);
    };
    if (
      !Number.isInteger(group.rows) ||
      !Number.isInteger(group.columns) ||
      group.rows < 1 ||
      group.columns < 1 ||
      group.rows * group.columns > MAX_PATTERN_FASTENERS
    )
      throw new Error(`Mönstret får innehålla 1–${MAX_PATTERN_FASTENERS} skruvar.`);
    const xs = offsets(group.columns, group.distancesX, group.spacingX);
    const ys = offsets(group.rows, group.distancesY, group.spacingY);
    result = ys.flatMap((y, row) => xs.map((x, column) => ({ x, y, row, column })));
  } else if (shape === 'circle') {
    if (
      !Number.isInteger(group.columns) ||
      group.columns < 2 ||
      group.columns > MAX_PATTERN_FASTENERS ||
      group.rows !== 1 ||
      !Number.isFinite(group.diameter) ||
      group.diameter <= 0 ||
      group.diameter > 100000
    )
      throw new Error('Ange 2–100 skruvar och en positiv cirkeldiameter.');
    result = Array.from({ length: group.columns }, (_, column) => {
      const angle = (column * Math.PI * 2) / group.columns;
      return {
        x: (group.diameter / 2) * Math.cos(angle),
        y: (group.diameter / 2) * Math.sin(angle),
        row: 0,
        column,
      };
    });
  } else if (shape === 'list') {
    if (
      group.rows !== 1 ||
      !Array.isArray(group.positions) ||
      group.positions.length !== group.columns ||
      !group.positions.length ||
      group.positions.length > MAX_PATTERN_FASTENERS ||
      group.positions.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some((v) => !Number.isFinite(v) || Math.abs(v) > 100000),
      )
    )
      throw new Error('X och Y måste ha lika många giltiga koordinater.');
    result = group.positions.map(([x, y], column) => ({ x, y, row: 0, column }));
  } else throw new Error('Välj ett giltigt skruvmönster.');
  if (new Set(result.map(({ x, y }) => `${x}:${y}`)).size !== result.length)
    throw new Error('Två skruvar får inte ha samma position.');
  return result;
}
