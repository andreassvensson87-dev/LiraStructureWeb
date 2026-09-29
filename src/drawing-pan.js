// Secondary click-drag (including a trackpad's two-finger click) moves the sheet workspace.
export function installDrawingPan(workspace, { blocked = () => false } = {}) {
  let gesture = null;
  const stop = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const cancel = () => {
    const previous = gesture;
    gesture = null;
    workspace.classList.remove('drawing-panning');
    if (previous && workspace.hasPointerCapture(previous.id))
      workspace.releasePointerCapture(previous.id);
  };
  workspace.addEventListener('contextmenu', (e) => e.preventDefault());
  workspace.addEventListener(
    'pointerdown',
    (e) => {
      if (
        e.button === 2 &&
        e.target?.closest?.(
          '[data-annotation],.viewport-grip,[data-section-crop],.ga-viewport-grip,.ga-crop-grip,.ga-view-snapshot',
        )
      )
        return;
      if (gesture || blocked() || !(e.button === 1 || e.button === 2)) return;
      stop(e);
      gesture = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: workspace.scrollLeft,
        top: workspace.scrollTop,
      };
      workspace.setPointerCapture(e.pointerId);
      workspace.classList.add('drawing-panning');
    },
    true,
  );
  workspace.addEventListener(
    'pointermove',
    (e) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      stop(e);
      workspace.scrollLeft = gesture.left - (e.clientX - gesture.x);
      workspace.scrollTop = gesture.top - (e.clientY - gesture.y);
    },
    true,
  );
  for (const type of ['pointerup', 'pointercancel'])
    workspace.addEventListener(
      type,
      (e) => {
        if (!gesture || e.pointerId !== gesture.id) return;
        stop(e);
        cancel();
      },
      true,
    );
  workspace.addEventListener('lostpointercapture', (e) => {
    if (gesture?.id === e.pointerId) cancel();
  });
  return {
    cancel,
    get active() {
      return !!gesture;
    },
  };
}
