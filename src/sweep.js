import { roundProfile, roundContours, roundGeometryTemplate } from './round-profile.js';
import * as THREE from 'three';
import { isRound, hasWall } from './profile-forms.js';
import { validateContours } from './section-profile.js';
export function validateSweep(s) {
  if (![...s.start, ...s.end, s.width, s.height, s.thickness, s.rotation].every(Number.isFinite))
    return 'Ange giltiga tal i alla fält.';
  if (
    s.profileUp &&
    (!Array.isArray(s.profileUp) ||
      s.profileUp.length !== 3 ||
      !s.profileUp.every(Number.isFinite) ||
      Math.hypot(...s.profileUp) < 1e-8)
  )
    return 'Ogiltig profilriktning.';
  if ([...s.start, ...s.end].some((v) => Math.abs(v) > 1e7))
    return 'Koordinater måste ligga inom ±10 000 000 mm.';
  if (Math.hypot(...s.end.map((v, i) => v - s.start[i])) < 1)
    return 'Start- och slutpunkt måste ligga minst 1 mm från varandra.';
  if (s.width < 1 || s.height < 1 || s.width > 10000 || s.height > 10000)
    return 'Bredd och höjd måste vara 1–10 000 mm.';
  if (s.profile === 'custom') {
    try {
      validateContours(s.section.loops);
    } catch (error) {
      return error.message;
    }
    return '';
  }
  if (
    hasWall(s.profile) &&
    (s.thickness <= 0 ||
      2 * s.thickness >= Math.min(s.width, isRound(s.profile) ? s.width : s.height))
  )
    return 'Tjockleken måste vara positiv och mindre än halva bredden och höjden.';
  return '';
}
export function contours(s) {
  const round = roundProfile(s);
  if (round) return roundContours(round);
  if (s.profile === 'custom' && s.section)
    return s.section.loops.map((loop, i) => {
      const area = loop.reduce((a, p, j) => {
        const q = loop[(j + 1) % loop.length];
        return a + p[0] * q[1] - q[0] * p[1];
      }, 0);
      return (i ? area > 0 : area < 0) ? [...loop].reverse() : loop;
    });
  const w = s.width / 2,
    h = s.height / 2,
    t = s.thickness;
  if (isRound(s.profile)) {
    const circle = (r) =>
      Array.from({ length: 96 }, (_, i) => [
        r * Math.cos((i * Math.PI) / 48),
        r * Math.sin((i * Math.PI) / 48),
      ]);
    return s.profile === 'chs' ? [circle(w), circle(w - t).reverse()] : [circle(w)];
  }
  if (s.profile === 'triangle')
    return [
      [
        [-w, -h],
        [w, -h],
        [0, h],
      ],
    ];
  const rect = (x, y) => [
    [-x, -y],
    [x, -y],
    [x, y],
    [-x, y],
  ];
  if (s.profile === 'i')
    return [
      [
        [-w, -h],
        [w, -h],
        [w, -h + t],
        [t / 2, -h + t],
        [t / 2, h - t],
        [w, h - t],
        [w, h],
        [-w, h],
        [-w, h - t],
        [-t / 2, h - t],
        [-t / 2, -h + t],
        [-w, -h + t],
      ],
    ];
  return s.profile === 'rhs' ? [rect(w, h), rect(w - t, h - t).reverse()] : [rect(w, h)];
}
export function profileAnchor(s) {
  const h = s.placement?.horizontalAlignment ?? 'center',
    v = s.placement?.verticalAlignment ?? 'center';
  if (s.profile === 'custom' && s.section) {
    const b = s.section.properties.bounds;
    return [
      h === 'left' ? b.minX : h === 'right' ? b.maxX : s.section.anchor[0],
      v === 'bottom' ? b.minY : v === 'top' ? b.maxY : s.section.anchor[1],
    ];
  }
  return [
    ({ left: -1, center: 0, right: 1 }[h] * s.width) / 2,
    ({ bottom: -1, center: 0, top: 1 }[v] * (isRound(s.profile) ? s.width : s.height)) / 2,
  ];
}
function placedContours(s) {
  const [ax, ay] = profileAnchor(s);
  return contours(s).map((loop) => loop.map(([x, y]) => [x - ax, y - ay]));
}
export function sweepFrame(s) {
  const start = new THREE.Vector3(...s.start),
    end = new THREE.Vector3(...s.end),
    axis = end.clone().sub(start).normalize();
  // The stored plane normal makes profile height follow its creation workplane.
  let x = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(...(s.profileUp ?? [0, 0, 1])));
  if (x.lengthSq() <= 1e-8) x.crossVectors(axis, new THREE.Vector3(0, 0, 1));
  if (x.lengthSq() <= 1e-8) x.set(1, 0, 0);
  else x.normalize();
  const y = new THREE.Vector3().crossVectors(x, axis).normalize(),
    q = new THREE.Quaternion().setFromAxisAngle(axis, (s.rotation * Math.PI) / 180);
  x.applyQuaternion(q);
  y.applyQuaternion(q);
  return { start, end, axis, x, y };
}
export function sweepCorners(s) {
  const { start, end, x, y } = sweepFrame(s);
  const round = roundProfile(s),
    [ax, ay] = profileAnchor(s);
  const loops = round
    ? [round.outer, ...(round.inner ? [round.inner] : [])].map((r) => [
        [r - ax, -ay],
        [-ax, r - ay],
        [-r - ax, -ay],
        [-ax, -r - ay],
      ])
    : placedContours(s);
  return [start, end].flatMap((origin) =>
    loops
      .flat()
      .map(([px, py]) => origin.clone().addScaledVector(x, px).addScaledVector(y, py).toArray()),
  );
}
export function sweepGeometry(s) {
  const { start, end, axis, x, y } = sweepFrame(s),
    round = roundProfile(s);
  let geometry;
  if (round) {
    const [ax, ay] = profileAnchor(s);
    geometry = roundGeometryTemplate(round).clone();
    geometry.scale(1, 1, start.distanceTo(end));
    geometry.translate(-ax, -ay, 0);
  } else {
    const loops = placedContours(s),
      shape = new THREE.Shape(loops[0].map((p) => new THREE.Vector2(...p)));
    loops
      .slice(1)
      .forEach((loop) =>
        shape.holes.push(new THREE.Path(loop.map((p) => new THREE.Vector2(...p)))),
      );
    geometry = new THREE.ExtrudeGeometry(shape, {
      depth: start.distanceTo(end),
      bevelEnabled: false,
      steps: 1,
    });
  }
  // Swift's (profileX, profileY, lengthAxis) basis is left-handed. Reverse
  // extrusion direction to preserve outward normals with a right-handed basis.
  const basis = new THREE.Matrix4().makeBasis(x, y, axis.clone().negate());
  basis.setPosition(end);
  geometry.applyMatrix4(basis);
  return geometry;
}
