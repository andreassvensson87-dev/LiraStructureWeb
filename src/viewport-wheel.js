import { zoomDirection } from './input-device.js';

// Overlay handles are siblings of the canvas. Route their wheel events to the
// same controls, and always cancel browser zoom, even while controls are busy.
export function installViewportWheel(host, canvas) {
  const forwarded = new WeakSet();
  const wheel = (event) => {
    event.preventDefault();
    if (forwarded.has(event)) return;
    const direction = zoomDirection(event);
    if (event.target === canvas && direction === 1) return;
    event.stopPropagation();
    const Wheel = canvas.ownerDocument.defaultView.WheelEvent;
    const next = new Wheel('wheel', {
      bubbles: false,
      cancelable: true,
      view: canvas.ownerDocument.defaultView,
      clientX: event.clientX,
      clientY: event.clientY,
      deltaX: event.deltaX,
      deltaY: event.deltaY * direction,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    });
    forwarded.add(next);
    canvas.dispatchEvent(next);
  };
  host.addEventListener('wheel', wheel, { capture: true, passive: false });
  return () => host.removeEventListener('wheel', wheel, { capture: true });
}
