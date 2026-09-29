/** Transient model interaction state; never serialized into the project. */
export function createToolSession() {
  return {
    operation: null,
    drawing: false,
    first: null,
    axisLock: null,
    activeSnap: null,
    lastPointer: null,
    lastDirection: null,
    typedDirection: null,
    typedPoint: null,
    directionLabel: '',
    temporaryPlane: null,
    workPlanePoints: [],
  };
}
export function resetToolLength(session) {
  session.lastDirection = null;
  session.typedDirection = null;
  session.typedPoint = null;
  session.directionLabel = '';
}
export function resetToolInteraction(session, drawing = false) {
  session.operation = null;
  session.drawing = drawing;
  session.first = null;
  session.axisLock = null;
  session.activeSnap = null;
  resetToolLength(session);
}
