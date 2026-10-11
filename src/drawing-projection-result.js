/** Lossless worker/cache representation. Float64 preserves projected coordinates. */
export function packDrawingProjection(result) {
  const coordinates = (items, width, points) => {
    const data = new Float64Array(items.length * width * points);
    let offset = 0;
    for (const item of items)
      for (const point of item)
        for (let axis = 0; axis < width; axis++) data[offset++] = point[axis];
    return data;
  };
  return {
    faces: coordinates(result.faces, 2, 3),
    edges: result.edges.map(({ visible, hidden, ...attributes }) => ({
      visible: coordinates(visible, 3, 2),
      hidden: coordinates(hidden, 3, 2),
      ...attributes,
    })),
  };
}

export function unpackDrawingProjection(result) {
  const coordinates = (data, width, points) => {
    const items = new Array(data.length / (width * points));
    let offset = 0;
    for (let i = 0; i < items.length; i++) {
      const item = new Array(points);
      for (let point = 0; point < points; point++) {
        const values = new Array(width);
        for (let axis = 0; axis < width; axis++) values[axis] = data[offset++];
        item[point] = values;
      }
      items[i] = item;
    }
    return items;
  };
  return {
    faces: coordinates(result.faces, 2, 3),
    edges: result.edges.map(({ visible, hidden, ...attributes }) => ({
      visible: coordinates(visible, 3, 2),
      hidden: coordinates(hidden, 3, 2),
      ...attributes,
    })),
  };
}

export function drawingProjectionBuffers(result) {
  return [result.faces.buffer, ...result.edges.flatMap((e) => [e.visible.buffer, e.hidden.buffer])];
}
