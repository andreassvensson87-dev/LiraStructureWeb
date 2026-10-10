/** A library window owns presentation/geometry only; callers own data and actions. */
export function installFloatingWindow(dialog) {
  dialog.classList.add('ui-library-window');
  const constrain = () => {
    if (!dialog.open || !dialog.classList.contains('ui-library-window')) return;
    const r = dialog.getBoundingClientRect();
    dialog.style.left = `${Math.max(0, Math.min(r.left, window.innerWidth - Math.min(r.width, window.innerWidth)))}px`;
    dialog.style.top = `${Math.max(0, Math.min(r.top, window.innerHeight - Math.min(r.height, window.innerHeight)))}px`;
  };
  let drag;
  dialog.addEventListener('pointerdown', (e) => {
    if (
      !dialog.classList.contains('ui-library-window') ||
      e.target.closest('header,.panel-title')?.parentElement !== dialog
    )
      return;
    if (e.button !== 0 || e.target.closest('button,input,select,summary,a')) return;
    const r = dialog.getBoundingClientRect();
    drag = { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top };
    dialog.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  dialog.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    dialog.style.margin = '0';
    dialog.style.left = `${e.clientX - drag.x}px`;
    dialog.style.top = `${e.clientY - drag.y}px`;
    constrain();
  });
  const stop = () => {
    drag = null;
  };
  dialog.addEventListener('pointerup', stop);
  dialog.addEventListener('lostpointercapture', stop);
  dialog.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      dialog.close();
    }
  });
  window.addEventListener('resize', constrain);
  const observer = new ResizeObserver(constrain);
  observer.observe(dialog);
  return {
    open() {
      if (!dialog.open) {
        // A window launched from a modal editor must join the browser's top layer.
        if (document.querySelector('dialog:modal')) dialog.showModal();
        else dialog.show();
      }
      constrain();
      dialog.querySelector('input[type="search"],input')?.focus();
    },
  };
}
