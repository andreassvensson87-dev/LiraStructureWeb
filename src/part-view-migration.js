// Preserve the old model-to-paper mapping, including its asymmetric frame margins.
export function migrateIndependentPartViews(sheet, bounds) {
  for (const id of ['top', 'front']) {
    const view = sheet.views.find((v) => v.id === id);
    if (!view || view.standard) continue;
    const axis = id === 'top' ? 'y' : 'z',
      scale = view.scale;
    const width = Math.max((bounds.max.x - bounds.min.x) / scale + 10, 42);
    const height = (bounds.max[axis] - bounds.min[axis]) / scale + 18;
    const x = sheet.layout.x,
      y = id === 'top' ? sheet.layout.topY : sheet.layout.y;
    view.position = [x - 5, y - height / 2 + 1];
    view.size = [width, height];
    view.camera.center = [
      bounds.min.x + (width / 2 - 5) * scale,
      (bounds.min[axis] + bounds.max[axis]) / 2 - scale,
    ];
    view.standard = true;
    view.projection = id;
  }
  sheet.independentViews = true;
}

export function arrangePartViews(views, paperWidth, contentArea = null) {
  const [left, top, right] = contentArea || [10, 10, paperWidth - 10];
  let x = left,
    y = top,
    rowHeight = 0;
  for (const view of views) {
    if (x > left && x + view.size[0] > right) {
      x = left;
      y += rowHeight + 12;
      rowHeight = 0;
    }
    view.position = [x, y];
    x += view.size[0] + 10;
    rowHeight = Math.max(rowHeight, view.size[1]);
  }
}
