import { stepString as str, stepNumber as num, stepList as list } from './step.js';
/** IFC4 shape encoding; geometry is supplied by the model adapter. */
export function writeRepresentation(w, context, shape, profileName, asMap = false) {
  let item, type;
  if (shape.kind === 'extrusion') {
    let profile;
    if (shape.round) {
      const position = w.add('IFCAXIS2PLACEMENT2D', w.point(shape.anchor.map((v) => -v)), '$');
      const args = ['.AREA.', str(profileName), position, num(shape.round.outer)];
      profile = shape.round.inner
        ? w.add('IFCCIRCLEHOLLOWPROFILEDEF', ...args, num(shape.round.outer - shape.round.inner))
        : w.add('IFCCIRCLEPROFILEDEF', ...args);
    } else {
      const curves = shape.loops.map((loop) => {
        const points = loop.map((p) => w.point(p));
        return w.add('IFCPOLYLINE', list([...points, points[0]]));
      });
      profile =
        curves.length > 1
          ? w.add(
              'IFCARBITRARYPROFILEDEFWITHVOIDS',
              '.AREA.',
              str(profileName),
              curves[0],
              list(curves.slice(1)),
            )
          : w.add('IFCARBITRARYCLOSEDPROFILEDEF', '.AREA.', str(profileName), curves[0]);
    }
    item = w.add(
      'IFCEXTRUDEDAREASOLID',
      profile,
      w.axis(),
      w.direction([0, 0, 1]),
      num(shape.depth),
    );
    type = 'SweptSolid';
  } else {
    const points = w.add(
      'IFCCARTESIANPOINTLIST3D',
      list(shape.points.map((p) => list(p.map(num)))),
    );
    item = w.add(
      'IFCTRIANGULATEDFACESET',
      points,
      '$',
      shape.closed ? '.T.' : '$',
      list(shape.triangles.map((t) => list(t))),
      '$',
    );
    type = 'Tessellation';
  }
  const representation = w.add(
    'IFCSHAPEREPRESENTATION',
    context,
    str('Body'),
    str(type),
    list([item]),
  );
  return {
    item,
    representation,
    definition: asMap ? null : w.add('IFCPRODUCTDEFINITIONSHAPE', '$', '$', list([representation])),
  };
}

/** Uncut library Items share one representation map; occurrence placement and colour stay separate. */
export function writeMappedRepresentation(w, context, shape, profileName, cache) {
  let map = cache.get(shape.reuse);
  if (!map) {
    const source = writeRepresentation(w, context, shape, profileName, true);
    map = w.add('IFCREPRESENTATIONMAP', w.axis(), source.representation);
    cache.set(shape.reuse, map);
  }
  const transform = w.add(
    'IFCCARTESIANTRANSFORMATIONOPERATOR3D',
    '$',
    '$',
    w.point([0, 0, 0]),
    '1.',
    '$',
  );
  const item = w.add('IFCMAPPEDITEM', map, transform);
  const representation = w.add(
    'IFCSHAPEREPRESENTATION',
    context,
    str('Body'),
    str('MappedRepresentation'),
    list([item]),
  );
  return { item, definition: w.add('IFCPRODUCTDEFINITIONSHAPE', '$', '$', list([representation])) };
}
