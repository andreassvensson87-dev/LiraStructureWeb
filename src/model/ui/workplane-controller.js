import * as THREE from 'three';
import { WorkPlaneGuide, workPlaneFromPoints } from '../../work-plane.js';
export function createWorkplaneController({
  scene,
  tools,
  renderer,
  getInspector,
  setDrawing,
  syncOperationUI,
}) {
  const $ = (id) => document.getElementById(id);
  const workPlaneGuide = new WorkPlaneGuide(scene);
  const workPlaneButton = document.createElement('button');
  workPlaneButton.type = 'button';
  workPlaneButton.id = 'work-plane';
  workPlaneButton.innerHTML =
    '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m3 15 6-10 12 4-6 10Z"/><circle cx="3" cy="15" r="1.5" fill="currentColor"/><circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="21" cy="9" r="1.5" fill="currentColor"/></svg>';
  workPlaneButton.title = 'Arbetsplan från tre punkter';
  workPlaneButton.setAttribute('aria-label', 'Arbetsplan från tre punkter');
  const resetPlaneButton = document.createElement('button');
  resetPlaneButton.type = 'button';
  resetPlaneButton.id = 'work-plane-reset';
  resetPlaneButton.textContent = '↺';
  resetPlaneButton.title = 'Återgå till aktiv nivå';
  resetPlaneButton.setAttribute('aria-label', 'Återgå till aktiv nivå');
  resetPlaneButton.hidden = true;
  const planeViewButton = document.createElement('button');
  planeViewButton.type = 'button';
  planeViewButton.id = 'work-plane-view';
  planeViewButton.title = 'Visa arbetsplanet rakt ovanifrån';
  planeViewButton.setAttribute('aria-label', 'Vy mot arbetsplanet');
  planeViewButton.innerHTML =
    '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v10h16V10M12 3v11m-4-4 4 4 4-4M8 20v-3m12-1h-3"/></svg>';
  document
    .querySelector('.view-controls')
    .prepend(workPlaneButton, resetPlaneButton, planeViewButton);
  function syncWorkPlane() {
    const picking = tools.operation?.mode === 'workPlane';
    workPlaneButton.classList.toggle('active', picking || !!tools.temporaryPlane);
    workPlaneButton.setAttribute('aria-pressed', String(picking || !!tools.temporaryPlane));
    resetPlaneButton.hidden = !tools.temporaryPlane;
    workPlaneGuide.show(tools.temporaryPlane ? tools.workPlanePoints : [], tools.temporaryPlane);
  }
  function workPlanePrompt() {
    return [
      'Arbetsplan · Välj origo (1/3)',
      'Arbetsplan · Välj punkt i X-riktningen (2/3)',
      'Arbetsplan · Välj punkt på planets Y-sida (3/3)',
    ][tools.operation.points.length];
  }
  workPlaneButton.onclick = () => {
    getInspector()?.finish();
    setDrawing(true);
    tools.operation = { mode: 'workPlane', points: [] };
    syncOperationUI();
    syncWorkPlane();
    $('status').textContent = workPlanePrompt();
    renderer.domElement.focus({ preventScroll: true });
  };
  resetPlaneButton.onclick = () => {
    setDrawing(false);
    tools.temporaryPlane = null;
    tools.workPlanePoints = [];
    syncWorkPlane();
    $('status').textContent = 'Arbetsplan återställt till aktiv nivå';
  };
  function pickWorkPlane(p) {
    const points = [...tools.operation.points, p];
    if (
      points.length === 2 &&
      new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...points[0])) < 1
    ) {
      $('status').textContent = 'Välj en punkt minst 1 mm från origo.';
      return;
    }
    if (points.length === 3) {
      try {
        tools.temporaryPlane = workPlaneFromPoints(points);
        tools.workPlanePoints = points;
        setDrawing(false);
        $('status').textContent = 'Temporärt arbetsplan aktivt · Sweep och Plate ritas i planet';
      } catch (error) {
        $('status').textContent = error.message;
      }
      return;
    }
    tools.operation.points = points;
    workPlaneGuide.show(points);
    $('status').textContent = workPlanePrompt();
  }

  return { workPlaneGuide, planeViewButton, syncWorkPlane, workPlanePrompt, pickWorkPlane };
}
