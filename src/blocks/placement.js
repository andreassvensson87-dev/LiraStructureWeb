/** Instance frames are data, independent of editor, camera and storage. */
export function identityPlacement(dimension, origin = Array(dimension).fill(0)) {
  return {
    origin: [...origin],
    axes: Array.from({ length: dimension }, (_, i) =>
      Array.from({ length: dimension }, (entry, j) => Number(i === j)),
    ),
  };
}
export function blockPoint(placement, point) {
  return placement.origin.map(
    (v, i) => v + point.reduce((sum, value, j) => sum + value * placement.axes[j][i], 0),
  );
}
export function transformBlockMetadata(source, turn) {
  if (!source.parametricBlock) return {};
  const block = source.parametricBlock,
    origin = turn(block.placement.origin);
  return {
    parametricBlock: {
      ...block,
      placement: {
        origin,
        axes: block.placement.axes.map((axis) =>
          turn(axis.map((v, i) => v + block.placement.origin[i])).map((v, i) => v - origin[i]),
        ),
      },
    },
  };
}
export function blockSelection(objects, ids) {
  const result = new Set(ids),
    instances = new Set(
      objects
        .filter((o) => result.has(o.id) && o.parametricBlock)
        .map((o) => o.parametricBlock.instanceId),
    );
  for (const object of objects)
    if (instances.has(object.parametricBlock?.instanceId)) result.add(object.id);
  return result;
}
export function selectedBlock(objects, ids) {
  const chosen = objects.filter((o) => ids.has(o.id));
  return chosen.length &&
    chosen[0].parametricBlock &&
    chosen.every((o) => o.parametricBlock?.instanceId === chosen[0].parametricBlock.instanceId)
    ? chosen
    : [];
}
export function validateBlockPlacement(placement, dimension) {
  const point = (p) =>
    Array.isArray(p) &&
    p.length === dimension &&
    p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e7);
  if (
    !placement ||
    !point(placement.origin) ||
    !Array.isArray(placement.axes) ||
    placement.axes.length !== dimension ||
    !placement.axes.every(point)
  )
    throw Error('Ogiltigt koordinatsystem för blocket.');
  placement.axes.forEach((axis, i) => {
    if (
      Math.abs(Math.hypot(...axis) - 1) > 1e-6 ||
      placement.axes.some(
        (other, j) => j !== i && Math.abs(axis.reduce((sum, v, k) => sum + v * other[k], 0)) > 1e-6,
      )
    )
      throw Error('Blockets axlar måste vara vinkelräta enhetsvektorer.');
  });
}
export function instanceMetadata(
  definition,
  values,
  placement,
  instanceId,
  memberId,
  anchorId = definition.anchors[0].id,
) {
  validateBlockPlacement(placement, definition.dimension);
  return {
    definition,
    values: { ...values },
    placement: structuredClone(placement),
    instanceId,
    memberId,
    anchorId,
  };
}
export function anchoredPlacement(block, oldResult, newResult) {
  const oldAnchor = oldResult.anchors.find((a) => a.id === block.anchorId),
    nextAnchor = newResult.anchors.find((a) => a.id === block.anchorId);
  if (!oldAnchor || !nextAnchor) throw Error('Blockets valda insättningspunkt saknas i versionen.');
  const world = blockPoint(block.placement, oldAnchor.point);
  return {
    ...block.placement,
    origin: world.map(
      (v, i) => v - nextAnchor.point.reduce((sum, p, j) => sum + p * block.placement.axes[j][i], 0),
    ),
  };
}
/** Native point tools supply snapped points; this only derives a local frame. */
export function blockPlacementAt(result, anchorId, start, target, plane) {
  const anchor = result.anchors.find((a) => a.id === anchorId);
  if (!anchor) throw Error('Välj en giltig insättningspunkt.');
  const placement = identityPlacement(anchor.point.length);
  if (target) {
    const delta = target.map((v, i) => v - start[i]),
      length = Math.hypot(...delta);
    if (length < 1e-6) throw Error('Välj en riktning från insättningspunkten.');
    const x = delta.map((v) => v / length);
    if (x.length === 2) placement.axes = [x, [-x[1], x[0]]];
    else {
      const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const up = plane ? cross(plane.u, plane.v) : [0, 0, 1];
      let y = cross(up, x);
      if (Math.hypot(...y) < 1e-6) y = cross([0, 1, 0], x);
      y = y.map((v) => v / Math.hypot(...y));
      placement.axes = [x, y, cross(x, y)];
    }
  }
  placement.origin = start.map(
    (v, i) => v - anchor.point.reduce((sum, p, j) => sum + p * placement.axes[j][i], 0),
  );
  validateBlockPlacement(placement, anchor.point.length);
  return placement;
}
