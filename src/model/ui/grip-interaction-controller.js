/** Pointer ownership for native grips. All geometry, snap and commits stay in placement. */
export function createGripInteraction({
  host,
  getGrip,
  canStart,
  select,
  beginBox,
  begin,
  preview,
  commit,
  cancel,
  getControls,
}) {
  const root = host.ownerDocument;
  let gesture = null;
  const consume = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  function release() {
    const current = gesture;
    gesture = null;
    if (!current) return;
    getControls().enabled = current.controlsEnabled;
    if (host.hasPointerCapture?.(current.id)) host.releasePointerCapture(current.id);
  }
  function abort() {
    const active = gesture?.dragging;
    release();
    if (active) cancel();
  }
  function down(e) {
    const grip = getGrip(e.target);
    if (e.button !== 0 || !grip || !canStart()) return;
    consume(e);
    if (e.altKey) {
      beginBox(e);
      return;
    }
    gesture = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      grip,
      event: { shiftKey: e.shiftKey },
      dragging: false,
      controlsEnabled: getControls().enabled,
    };
    getControls().enabled = false;
    host.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!gesture || e.pointerId !== gesture.id) return;
    consume(e);
    if (!gesture.dragging && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) >= 4) {
      if (!begin(gesture.grip)) {
        release();
        return;
      }
      gesture.dragging = true;
      // setDrawing may reconfigure navigation while starting the common tool.
      getControls().enabled = false;
    }
    if (gesture.dragging) preview(e);
  }
  function up(e) {
    if (!gesture || e.pointerId !== gesture.id || e.button !== 0) return;
    // A fast drag may release before the first coalesced pointermove arrives.
    if (!gesture.dragging && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) >= 4) move(e);
    if (!gesture) return;
    consume(e);
    const current = gesture;
    release();
    if (!current.dragging) select(current.grip, current.event);
    else {
      const r = host.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom ||
        !commit(e)
      )
        cancel();
    }
  }
  function cancelled(e) {
    if (e.pointerId === gesture?.id) abort();
  }
  function key(e) {
    if (e.key === 'Escape' && gesture) {
      consume(e);
      abort();
    }
  }
  host.addEventListener('pointerdown', down, true);
  root.addEventListener('pointermove', move, true);
  root.addEventListener('pointerup', up, true);
  root.addEventListener('pointercancel', cancelled, true);
  host.addEventListener('lostpointercapture', cancelled);
  root.addEventListener('keydown', key, true);
  root.defaultView?.addEventListener('blur', abort);
  return {
    cancel: abort,
    dispose() {
      abort();
      host.removeEventListener('pointerdown', down, true);
      root.removeEventListener('pointermove', move, true);
      root.removeEventListener('pointerup', up, true);
      root.removeEventListener('pointercancel', cancelled, true);
      host.removeEventListener('lostpointercapture', cancelled);
      root.removeEventListener('keydown', key, true);
      root.defaultView?.removeEventListener('blur', abort);
    },
  };
}

export function installModelGripInteraction({
  $,
  host,
  insertionPoints,
  tools,
  actions,
  controllers,
  navigation,
}) {
  controllers.gripInteraction = createGripInteraction({
    host,
    getGrip: (target) => insertionPoints.gripAtTarget(target),
    canStart: () => !tools.operation && !tools.drawing,
    select: (grip, event) => controllers.pointUI.activate(grip, event),
    beginBox: (event) => actions.beginBox(event),
    begin: (grip) => actions.startGrip(controllers.pointUI.moving(grip)),
    preview: (event) => actions.updatePointer(event),
    commit: (event) => {
      const point = actions.point(event);
      return !!point && actions.commitPoint(point);
    },
    cancel: () => {
      const reason = $('draw-length-error').textContent;
      actions.setDrawing(false, { keepPoints: true });
      actions.render({ selectionOnly: true });
      $('status').textContent = reason || 'Förflyttning avbruten';
    },
    getControls: () => navigation.controls,
  });
}
