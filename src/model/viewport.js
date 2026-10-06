import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { installViewportWheel } from '../viewport-wheel.js';
import { installInputNavigation } from './input-navigation.js';
import { ModelNavigation } from './navigation.js';
import { createViewWidget } from './ui/view-widget.js';
/** Owns renderer, lighting, resize and browser events; no project or editor state. */
export function createModelViewport(host, onError) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eaf0f2');
  const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 1e8);
  camera.up.set(0, 0, 1);
  camera.position.set(6500, -8000, 6500);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (error) {
    onError('3D-vyn kräver WebGL. Aktivera grafikacceleration i webbläsaren.');
    throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;

  const createControls = () => {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons.LEFT = null;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    return controls;
  };
  const controls = createControls();
  controls.target.set(1500, 0, 0);
  Object.assign(controls, {
    enableDamping: true,
    zoomToCursor: true,
    minZoom: 0.001,
    maxZoom: 1000,
  });
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(4000, -3000, 7000);
  scene.add(sun);
  const navigation = new ModelNavigation({
    camera,
    controls,
    createControls,
    getSize: () => [host.clientWidth, host.clientHeight],
  });
  const viewWidget = createViewWidget(host, camera, (axis, sign) =>
    navigation.lookAlongAxis(axis, sign),
  );
  const removeInputNavigation = installInputNavigation(host, camera, () => navigation.controls);
  const removeWheel = installViewportWheel(host, renderer.domElement);
  const observer = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    navigation.updateProjection();
  });
  observer.observe(host);
  return {
    scene,
    camera,
    renderer,
    navigation,
    viewWidget,
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      removeInputNavigation();
      removeWheel();
      navigation.controls.dispose();
      viewWidget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
