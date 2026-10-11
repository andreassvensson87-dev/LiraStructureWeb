import { partViewFrame } from './part-view-frame.js';
import { frameMatrix, sectionFrame } from './drawing-sections.js';
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

/** Create complete editable views for a new sheet, without reading obsolete sheet fields. */
export function createPartViews({ sourceId, type, drawingPreset }, bounds, scale = 10) {
  const middle = (bounds.min.x + bounds.max.x) / 2;
  const section = {
    label: 'A',
    points: [
      [middle, bounds.min.z - 40],
      [middle, bounds.max.z + 40],
    ],
    side: 1,
    depth: Math.max(100, bounds.max.x - bounds.min.x + 80),
  };
  return ['top', 'front', 'section'].map((id) => {
    const frame =
      id === 'section'
        ? sectionFrame(partViewFrame('front'), section.points, section.side, 'source')
        : partViewFrame(id);
    const box = bounds.clone().applyMatrix4(frameMatrix(frame));
    return {
      id,
      name: { top: 'Top', front: 'Front', section: 'Sektion A–A' }[id],
      kind: id === 'section' ? 'section' : 'view',
      projection: id,
      standard: id !== 'section',
      source: {
        type: 'part',
        objectId: sourceId,
        ...(id === 'section' ? { parentViewId: 'front' } : {}),
      },
      ...(id === 'section' ? { section } : {}),
      position: [10, 10],
      size: [
        Math.max(id === 'section' ? 48 : 25, (box.max.x - box.min.x) / scale + 12),
        Math.max(25, (box.max.y - box.min.y) / scale + 12),
      ],
      scale,
      camera: { center: [(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2] },
      settings: {
        profileDetail: type === 'GA' ? 'schematic' : 'exact',
        hiddenLines: drawingPreset?.hiddenLines ?? true,
      },
    };
  });
}
