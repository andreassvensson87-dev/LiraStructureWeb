/** Dismissing a menu consumes the pointer gesture, not the command underneath. */
export function installContextMenuDismissal(eventRoot, { isOpen, contains, close }) {
  let pointer = null;
  let click = false;
  const stop = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const down = (event) => {
    click = false;
    if (!isOpen() || contains(event.target) || event.button === 2) return;
    pointer = event.pointerId;
    stop(event);
    close(true);
  };
  const up = (event) => {
    // A long press can open a menu after the model received pointerdown.
    if (event.pointerId !== pointer && !(isOpen() && !contains(event.target) && event.button === 0))
      return;
    stop(event);
    pointer = null;
    click = true;
  };
  const clicked = (event) => {
    if (!click) return;
    click = false;
    stop(event);
  };
  const cancel = () => {
    pointer = null;
    click = false;
  };
  const listeners = { pointerdown: down, pointerup: up, click: clicked, pointercancel: cancel };
  for (const [type, listener] of Object.entries(listeners))
    eventRoot.addEventListener(type, listener, { capture: true });
  return () => {
    for (const [type, listener] of Object.entries(listeners))
      eventRoot.removeEventListener(type, listener, { capture: true });
  };
}
