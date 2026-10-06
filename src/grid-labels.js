export const GRID_LABEL_MAX_LENGTH = 40;

export function gridLabel(grid, axis, index) {
  return (
    grid.labels?.[axis]?.[index]?.trim() ||
    (axis === 'x' ? String(index + 1) : String.fromCharCode(65 + index))
  );
}

/** Labels follow the coordinate when positions are inserted, removed or sorted. */
export function gridLabelsAtPositions(grid, axis, positions) {
  const existing = new Map(
    grid[axis].map((position, index) => [
      position,
      grid.labels?.[axis]?.[index]?.trim() ?? gridLabel(grid, axis, index),
    ]),
  );
  return positions.map((position, index) => existing.get(position) || gridLabel({}, axis, index));
}

export function validateGridLabels(grid) {
  if (grid.labels === undefined) return;
  if (!grid.labels || typeof grid.labels !== 'object' || Array.isArray(grid.labels))
    throw new Error('Ogiltiga stomlinjebeteckningar.');
  for (const axis of ['x', 'y']) {
    const labels = grid.labels[axis];
    if (labels === undefined) continue;
    if (
      !Array.isArray(labels) ||
      labels.length !== grid[axis].length ||
      labels.some(
        (label) =>
          typeof label !== 'string' || !label.trim() || label.length > GRID_LABEL_MAX_LENGTH,
      )
    )
      throw new Error(`Ange en beteckning på högst ${GRID_LABEL_MAX_LENGTH} tecken per stomlinje.`);
  }
}
