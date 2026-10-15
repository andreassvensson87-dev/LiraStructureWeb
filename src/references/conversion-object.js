import * as THREE from 'three';
import { validateLineCut } from '../line-cut.js';

/** Adapt recovered geometry to existing model types, without library decisions or commits. */
export function extrusionObjects(result, part, model, kind) {
  const { axis, x, y, min, depth, loops, properties, origin } = result;
  const center = origin
    .clone()
    .addScaledVector(x, properties.cx)
    .addScaledVector(y, properties.cy)
    .addScaledVector(axis, min);
  const base = {
    name: part.mesh.userData.name || model.title,
    ifcSource: {
      fileName: model.fileName,
      globalId: part.mesh.userData.globalId,
      expressId: part.mesh.userData.ifcId,
    },
  };
  let object;
  if (kind === 'plate')
    object = {
      ...base,
      type: 'plate',
      frame: {
        origin: center.addScaledVector(axis, depth / 2).toArray(),
        u: x.toArray(),
        v: y.toArray(),
      },
      polygon: loops[0].map(([u, v]) => [u - properties.cx, v - properties.cy]),
      thickness: depth,
      side: 'center',
    };
  else
    object = {
      ...base,
      type: 'sweep',
      profile: 'custom',
      section: {
        id: `ifc-profile:${part.mesh.userData.globalId || model.fileName + ':' + part.mesh.userData.ifcId}`,
        revision: 1,
        name: base.name + ' · IFC-profil',
        family: 'IFC',
        profileType: 'custom',
        source: model.fileName,
        loops,
        properties,
        anchor: [properties.cx, properties.cy],
      },
      width: properties.bounds.width,
      height: properties.bounds.height,
      thickness: 0,
      rotation: 0,
      start: center.toArray(),
      end: center.clone().addScaledVector(axis, depth).toArray(),
    };

  const cuts = (result.endPlanes || []).map(({ point, normal }, index) => {
    const u = new THREE.Vector3(
      Math.abs(normal.z) < 0.9 ? 0 : 1,
      0,
      Math.abs(normal.z) < 0.9 ? 1 : 0,
    )
      .cross(normal)
      .normalize();
    const cut = {
      type: 'linecut',
      name: `IFC-ändkapning ${index + 1}`,
      frame: { origin: point.toArray(), u: u.toArray(), v: normal.clone().negate().toArray() },
      polygon: [
        [-150, 0],
        [150, 0],
      ],
      side: 'positive',
      targets: [],
    };
    const error = validateLineCut(cut);
    if (error) throw Error(error);
    return cut;
  });
  return { object, cuts };
}
