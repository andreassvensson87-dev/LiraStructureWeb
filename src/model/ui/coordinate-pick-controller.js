/** One-point picking uses the model's ordinary point resolver and snap overlay. */
export function createCoordinatePicker({ tools, setDrawing, syncOperationUI, focus, status }) {
  let done = null;
  function suspend() {
    const resolve = done;
    done = null;
    resolve?.(null);
  }
  function finish(point) {
    const resolve = done;
    done = null;
    setDrawing(false);
    resolve?.(point);
  }
  return {
    suspend,
    start() {
      setDrawing(false);
      setDrawing(true);
      tools.operation = { mode: 'coordinatePoint' };
      syncOperationUI();
      status('Baspunkt · Välj lokal punkt · Esc avbryter');
      focus();
      return new Promise((resolve) => {
        done = resolve;
      });
    },
    pickPoint(p) {
      if (done && p?.length === 3 && p.every(Number.isFinite)) finish([...p]);
    },
    cancel() {
      finish(null);
    },
  };
}
