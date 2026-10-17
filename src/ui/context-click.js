/** Wait for a stationary release across press- and release-based browser menus. */
export function installContextClick(surface, open, { accepts = () => true } = {}) {
  const eventRoot = surface.ownerDocument;
  let gesture = null;
  surface.addEventListener(
    'pointerdown',
    (event) => {
      if (!accepts(event)) return;
      if (event.button === 2)
        gesture = { x: event.clientX, y: event.clientY, down: true, moved: false };
      else gesture = null;
    },
    true,
  );
  eventRoot.addEventListener(
    'pointermove',
    (event) => {
      if (gesture?.down && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5)
        gesture.moved = true;
    },
    true,
  );
  eventRoot.addEventListener(
    'pointerup',
    (event) => {
      if (event.button !== 2 || !gesture) return;
      gesture.down = false;
      if (gesture.pending && !gesture.moved) open(gesture.pending);
    },
    true,
  );
  surface.addEventListener('pointercancel', () => {
    gesture = null;
  });
  surface.addEventListener('contextmenu', (event) => {
    if (!accepts(event)) return;
    event.preventDefault();
    if (event.button !== 2) open(event);
    else if (gesture?.down) gesture.pending = event;
    else if (!gesture?.moved) open(event);
  });
}
