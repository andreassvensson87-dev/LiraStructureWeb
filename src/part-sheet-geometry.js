import { drawingProfileDetail } from './profile-detail.js';

import { objectGeometry, displayGeometry } from './model-object.js';

import { assemblyGeometry } from './assembly-geometry.js';

export function resolvePartDrawingGeometry(
  {
    record,
    geometry,
    snapGeometry,
    assemblyEntries,
    profileVariants,
    profileGeometryAssembly,
    profileGeometryModel,
    profileGeometrySource,
    profileLocalMatrix,
    drawingReflection,
  },
  view,
) {
  const detail = drawingProfileDetail(view, record.type);
  if (detail === 'exact')
    return {
      geometry,
      snapGeometry,
      entries: assemblyEntries,
    };
  let variant = profileVariants.get(detail);
  if (!variant) {
    variant = profileGeometryAssembly
      ? assemblyGeometry(profileGeometryAssembly, profileGeometryModel, detail)
      : {
          geometry: objectGeometry(
            profileGeometrySource,
            profileGeometryModel,
            detail,
          ).applyMatrix4(profileLocalMatrix),
          snapGeometry: displayGeometry(
            profileGeometrySource,
            profileGeometryModel,
            'schematic',
          ).applyMatrix4(profileLocalMatrix),
        };
    if (drawingReflection) {
      variant.geometry.applyMatrix4(drawingReflection);
      variant.snapGeometry.applyMatrix4(drawingReflection);
      for (const entry of variant.entries || []) {
        entry.geometry.applyMatrix4(drawingReflection);
        entry.snapGeometry.applyMatrix4(drawingReflection);
      }
    }
    profileVariants.set(detail, variant);
  }
  return variant;
}
