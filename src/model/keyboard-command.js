/** Pure key routing: UI actions and project mutations are handled by the caller. */
export function modelKeyboardCommand(
  e,
  {
    propertyCopy,
    linear,
    planeTransform,
    editing,
    settingsOpen,
    modalOpen,
    hasSelection,
    hasEditableSweeps,
    mode,
    picking,
    hasStart,
    drawing,
    plateLength,
  },
) {
  if (settingsOpen || modalOpen) return null;
  if (e.key === 'Escape') return 'cancel';
  if (editing) return null;
  if (mode === 'coordinatePoint') return null;
  if (propertyCopy) return e.key === 'Enter' ? 'confirm-property-copy' : null;
  if (mode === 'fit') return e.key === 'Enter' && !picking ? 'confirm-fit' : null;
  if (mode === 'assemblyMain') return null;
  const modifier = e.ctrlKey || e.metaKey,
    axis = ['x', 'y', 'z'].includes(e.key.toLowerCase());
  if (e.shiftKey && !modifier && !e.altKey && hasEditableSweeps && !mode && !drawing) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
      return 'sweep-placement';
    if (e.key === ' ') return e.repeat ? 'consume' : 'sweep-profile-rotation';
  }
  if (modifier && !e.altKey && !e.shiftKey && hasSelection) {
    const transform = { m: 'move', c: 'copy', r: 'rotate' }[e.key.toLowerCase()];
    if (transform) return e.repeat ? 'consume' : transform;
  }
  if (mode === 'fastenerTargets') return e.key === 'Enter' ? 'confirm-fastener-targets' : null;
  if (mode === 'workArea') return e.key === 'Enter' ? 'confirm-work-area' : null;
  if (mode === 'workPlane') return e.key === 'Backspace' ? 'remove-workplane-point' : null;
  if (mode === 'polysweepCreate' && !modifier) {
    if (e.key === 'Enter') return 'finish-polysweep';
    if (e.key === 'Backspace') return 'remove-polysweep-point';
  }
  if (['plateCreate', 'plateVertex'].includes(mode) && !modifier) {
    if (plateLength && /^\d$/.test(e.key)) return 'length';
    if (e.key === 'Enter') return mode === 'plateCreate' ? 'finish-plate' : 'consume';
    if (hasStart && axis) return 'axis';
    return e.key === 'Backspace' && mode === 'plateCreate' ? 'remove-plate-point' : null;
  }
  if (mode === 'rotate') {
    if (picking) {
      if (hasStart && axis && !modifier) return 'axis';
    } else {
      if (!modifier && /^[0-9+.,-]$/.test(e.key)) return 'angle';
      if (e.key === 'Enter') return 'finish-rotation';
    }
    if (!modifier && !['Delete', 'Backspace'].includes(e.key)) return null;
  }
  if (planeTransform && !modifier) {
    if (e.key === 'Enter') return 'confirm-plane-transform';
    return e.key === 'Backspace' ? 'remove-plane-transform-point' : null;
  }
  if (linear && !modifier)
    return e.key === 'Enter' && !picking ? (e.repeat ? 'consume' : 'confirm-linear') : null;
  if (drawing && hasStart && !modifier) {
    if (!e.altKey && /^\d$/.test(e.key)) return 'length';
    if (axis) return 'axis';
  }
  if (modifier && e.key.toLowerCase() === 'z') return e.shiftKey ? 'redo' : 'undo';
  return ['Delete', 'Backspace'].includes(e.key) ? 'delete' : null;
}

/** Canvas completion shares Enter's tool policy, without dispatching keyboard events. */
export function modelCompletionCommand(state) {
  const command = modelKeyboardCommand({ key: 'Enter' }, state);
  return command?.startsWith('confirm-') || command?.startsWith('finish-') ? command : null;
}
