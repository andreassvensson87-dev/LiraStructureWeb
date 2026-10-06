/** Routes completed clicks to the active tool. Pointer capture/box selection stays in its adapter. */
export function pointerCommand({ mode, picking, drawing, hasStart, plateLength, hasLength }) {
  if (mode === 'fit') return picking ? 'fit-reference' : null;
  if (mode === 'fastenerDepth') return null;
  if (mode === 'fastenerTargets') return 'fastener-target';
  if (mode === 'assemblyMain') return 'assembly-main';
  if (mode === 'helperpoint') return 'helperpoint';
  if (mode === 'workPlane') return 'workplane';
  if (mode === 'plateCreate' || mode === 'plateVertex')
    return plateLength && hasLength ? 'plate-length' : 'plate';
  if (mode === 'rotate') return picking ? 'rotation' : null;
  if (!drawing) return 'select';
  if (hasStart && hasLength) return 'length';
  return hasStart ? 'finish' : 'start';
}
export function installModelPointer(
  surface,
  { getState, beginBox, orbit, point, actions, move, leave },
) {
  let down = null;
  const start = (e) => {
    down = { id: e.pointerId, x: e.clientX, y: e.clientY };
    const s = getState();
    if (
      e.button === 0 &&
      e.pointerType !== 'touch' &&
      !s.drawing &&
      s.mode !== 'assemblyMain' &&
      (!s.mode || s.boxMode || e.shiftKey)
    ) {
      down = null; // The selection controller owns the entire gesture, including release.
      e.stopImmediatePropagation();
      beginBox(e);
      return;
    }
    orbit(e);
  };
  const end = (e) => {
    const start = down;
    down = null;
    if (
      e.button !== 0 ||
      !start ||
      e.pointerId !== start.id ||
      Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5
    )
      return;
    const command = pointerCommand(getState());
    if (!command) return;
    if (
      [
        'select',
        'length',
        'plate-length',
        'fastener-target',
        'assembly-main',
        'fit-reference',
      ].includes(command)
    ) {
      actions[command](e);
      return;
    }
    const p = point(e);
    if (p) actions[command](p, e);
  };
  const cancel = () => {
    down = null;
  };
  surface.addEventListener('pointerdown', start, true);
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', cancel);
  surface.addEventListener('lostpointercapture', cancel);
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerleave', leave);
  return () => {
    surface.removeEventListener('pointerdown', start, true);
    surface.removeEventListener('pointerup', end);
    surface.removeEventListener('pointercancel', cancel);
    surface.removeEventListener('lostpointercapture', cancel);
    surface.removeEventListener('pointermove', move);
    surface.removeEventListener('pointerleave', leave);
  };
}
