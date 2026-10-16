/** Overlay markers are siblings of the canvas; start the existing camera gesture there.
 * OrbitControls then captures the real pointer, including movement and release outside the marker.
 * Left clicks, grip dragging, keyboard activation and marker menus keep their own event owners.
 */
export function installOverlayNavigation(host, canvas) {
  let rightGesture = null;
  const forwarded = new WeakSet();
  const down = (event) => {
    if (forwarded.has(event)) return;
    rightGesture = null;
    if (
      event.target === canvas ||
      event.pointerType === 'touch' ||
      ![1, 2].includes(event.button) ||
      !event.target.closest?.('.insertion-point, .connection-marker')
    )
      return;
    if (event.button === 2)
      rightGesture = {
        target: event.target.closest('.insertion-point, .connection-marker'),
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
    else rightGesture = null;
    const view = canvas.ownerDocument.defaultView;
    const next = new view.PointerEvent('pointerdown', {
      bubbles: false,
      cancelable: true,
      view,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      button: event.button,
      buttons: event.buttons,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    forwarded.add(next);
    canvas.dispatchEvent(next);
  };
  const move = (event) => {
    if (
      rightGesture?.id === event.pointerId &&
      Math.hypot(event.clientX - rightGesture.x, event.clientY - rightGesture.y) > 5
    )
      rightGesture.moved = true;
  };
  const context = (event) => {
    const gesture = rightGesture;
    rightGesture = null;
    if (!gesture) return;
    // Pointer capture retargets the stationary right-click to canvas. Keep the vertex menu.
    if (event.target === gesture.target && !gesture.moved) return;
    if (!gesture.moved && !gesture.target.matches('.insertion-point')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (gesture.moved || !gesture.target.isConnected) return;
    const view = canvas.ownerDocument.defaultView;
    gesture.target.dispatchEvent(
      new view.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view,
        button: 2,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      }),
    );
  };
  const cancel = () => {
    rightGesture = null;
  };
  host.addEventListener('pointerdown', down, true);
  host.addEventListener('pointermove', move, true);
  host.addEventListener('pointercancel', cancel, true);
  host.addEventListener('contextmenu', context, true);
  return () => {
    host.removeEventListener('pointerdown', down, true);
    host.removeEventListener('pointermove', move, true);
    host.removeEventListener('pointercancel', cancel, true);
    host.removeEventListener('contextmenu', context, true);
  };
}
