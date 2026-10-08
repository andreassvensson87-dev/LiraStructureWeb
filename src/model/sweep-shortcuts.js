/** Move the profile anchor in its local 3 × 3 placement matrix, keeping the axis fixed. */
export function stepSweepPlacement(sweep, key) {
  const placement = {
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    ...sweep.placement,
  };
  const horizontal = ['left', 'center', 'right'],
    vertical = ['bottom', 'center', 'top'];
  const step = (values, value, delta) =>
    values[Math.max(0, Math.min(values.length - 1, values.indexOf(value) + delta))];
  if (key === 'ArrowLeft' || key === 'ArrowRight')
    placement.horizontalAlignment = step(
      horizontal,
      placement.horizontalAlignment,
      key === 'ArrowRight' ? 1 : -1,
    );
  if (key === 'ArrowUp' || key === 'ArrowDown')
    placement.verticalAlignment = step(
      vertical,
      placement.verticalAlignment,
      key === 'ArrowUp' ? 1 : -1,
    );
  return { ...sweep, placement };
}

export function quarterTurnSweep(sweep) {
  return { ...sweep, rotation: ((((sweep.rotation ?? 0) + 90) % 360) + 360) % 360 };
}
