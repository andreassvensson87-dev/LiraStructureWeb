import * as THREE from 'three';
import { updateObjectMeshTransparency } from '../object-mesh.js';
import { levelElevation } from '../../levels.js';

export function installModelViewControls({
  $,
  actions,
  controllers,
  frameGate,
  grid,
  instanceBatches,
  navigation,
  objects,
  project,
  tools,
  ui,
}) {
  const updatePointer = (...args) => actions.updatePointer(...args);
  Object.assign(actions, { fit });
  function fit(direction, referenceBounds = null) {
    const bounds =
      referenceBounds ||
      new THREE.Box3()
        .setFromObject(objects)
        .union(grid.bounds)
        .union(controllers.referenceModels?.bounds() || new THREE.Box3());
    navigation.fit(bounds, direction);
  }
  $('transparent-view').onclick = () => {
    ui.transparentView = !ui.transparentView;
    const button = $('transparent-view');
    button.setAttribute('aria-pressed', String(ui.transparentView));
    button.title = ui.transparentView
      ? 'Transparent · byt till homogent'
      : 'Homogent · byt till transparent';
    for (const object of objects.children) updateObjectMeshTransparency(object, ui.transparentView);
    instanceBatches.setTransparentView(ui.transparentView);
    frameGate.invalidate();
  };
  controllers.planeViewButton.onclick = () => {
    const frame = tools.temporaryPlane ?? {
      origin: [0, 0, levelElevation(project.levels)],
      u: [1, 0, 0],
      v: [0, 1, 0],
    };
    const normal = new THREE.Vector3(...frame.u).cross(new THREE.Vector3(...frame.v)).normalize();
    const center = tools.temporaryPlane
      ? tools.workPlanePoints
          .reduce((sum, p) => sum.add(new THREE.Vector3(...p)), new THREE.Vector3())
          .multiplyScalar(1 / tools.workPlanePoints.length)
      : navigation.controls.target.clone().setZ(levelElevation(project.levels));
    navigation.lookAtPlane(center, normal, new THREE.Vector3(...frame.v));
    if (tools.lastPointer && tools.drawing) updatePointer(tools.lastPointer);
    $('status').textContent = tools.temporaryPlane
      ? 'Vy rakt mot arbetsplanet'
      : 'Vy rakt mot aktiv nivå';
  };
  $('fit').onclick = () => fit();
  $('top').onclick = () => {
    navigation.setViewUp(new THREE.Vector3(0, 0, 1));
    fit(new THREE.Vector3(0, -0.0001, 1).normalize());
  };
  $('iso').onclick = () => {
    navigation.setViewUp(new THREE.Vector3(0, 0, 1));
    fit(new THREE.Vector3(1, -1, 1).normalize());
  };
}
