import * as THREE from 'three';
let pointTexture;
function texture() {
  if (pointTexture) return pointTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const c = canvas.getContext('2d');
  c.strokeStyle = 'white';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(5, 16);
  c.lineTo(27, 16);
  c.moveTo(16, 5);
  c.lineTo(16, 27);
  c.stroke();
  return (pointTexture = new THREE.CanvasTexture(canvas));
}
export function helperMesh(s, { selectedIds, ghost = false }) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    [s.start, ...(s.end ? [s.end] : [])].map((p) => new THREE.Vector3(...p)),
  );
  const color = selectedIds.has(s.id) || ghost ? 0x258e79 : 0x8765ad;
  const object =
    s.type === 'helperpoint'
      ? new THREE.Points(
          geometry,
          new THREE.PointsMaterial({
            color,
            size: 16,
            sizeAttenuation: false,
            map: texture(),
            transparent: true,
            alphaTest: 0.1,
            depthTest: false,
          }),
        )
      : new THREE.Line(
          geometry,
          new THREE.LineDashedMaterial({
            color,
            dashSize: 100,
            gapSize: 65,
            depthTest: false,
            transparent: true,
            opacity: ghost ? 0.5 : 0.85,
          }),
        );
  if (object.isLine) object.computeLineDistances();
  object.userData = { id: s.id, helper: true, ghost };
  object.renderOrder = 15;
  return object;
}
