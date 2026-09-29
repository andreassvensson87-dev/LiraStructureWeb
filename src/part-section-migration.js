/** Convert the former fixed A–A viewport once; keep its id and annotation ownership. */
export function migratePartSection(record, bounds) {
  const sheet = record.sheet,
    view = sheet.views.find((v) => v.id === 'section');
  if (!view || view.section) return;
  const bottom = bounds.min.z - 40,
    top = bounds.max.z + 40;
  const scale = view.scale;
  view.section = {
    label: 'A',
    points: [
      [sheet.section, bottom],
      [sheet.section, top],
    ],
    side: 1,
    depth: Math.max(100, bounds.max.x - bounds.min.x + 80),
  };
  view.source.parentViewId = 'front';
  view.camera.center = [
    (bounds.min.y + bounds.max.y) / 2,
    (bounds.min.z + bounds.max.z) / 2 - bottom,
  ];
  if (view.size[0] <= 1) {
    view.size = [
      Math.max(48, (bounds.max.y - bounds.min.y) / scale + 10),
      (bounds.max.z - bounds.min.z) / scale + 14,
    ];
    view.position = [sheet.layout.sectionX - 5, sheet.layout.y - view.size[1] / 2];
  }
  for (const annotation of record.annotations || []) {
    if (annotation.view !== view.id) continue;
    annotation.points = annotation.points.map(([x, y]) => [x, y - bottom]);
    annotation.line = [annotation.line[0], annotation.line[1] - bottom];
  }
}
