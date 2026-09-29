// Overlay handles are siblings of the canvas. Route their wheel events to the
// same controls, and always cancel browser zoom, even while controls are busy.
export function installViewportWheel(host, canvas) {
  const wheel = (event) => {
    event.preventDefault();
    if (event.target === canvas) return;
    event.stopPropagation();
    const Wheel = canvas.ownerDocument.defaultView.WheelEvent;
    canvas.dispatchEvent(
      new Wheel('wheel', {
        bubbles: false,
        cancelable: true,
        view: canvas.ownerDocument.defaultView,
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      }),
    );
  };
  host.addEventListener('wheel', wheel, { capture: true, passive: false });
  return () => host.removeEventListener('wheel', wheel, { capture: true });
}
