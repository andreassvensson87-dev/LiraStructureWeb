import { nearbySnapEntities } from './drawing-snap-geometry.js';
import { defaultCadSettings } from './cad-statusbar.js';
import { constrainCadPoint } from './cad-tracking.js';
import { snapFrame } from './frame-model.js';
import { shapeGrips } from './drawing-shape-grips.js';
import { shapeSnapPoints, arcGeometry } from './drawing-shapes.js';

export function locateDrawingPoint(editor, e, view, snap = true, excludeId = null) {
  editor.lastCadPosition = { clientX: e.clientX, clientY: e.clientY };
  const hit = editor.adapter.locate(e, view);
  if (!hit) return null;
  const settings = editor.cad?.get() || defaultCadSettings;
  const base =
    (editor.transform?.active() && editor.transform.base) ||
    editor.draft?.points.at(-1) ||
    editor.drag?.grip?.point;
  const rawPoint = [...hit.point];
  const originPixel = editor.adapter.project(hit.point, hit.view),
    unitPixel = editor.adapter.project([hit.point[0] + 1, hit.point[1]], hit.view);
  const pixelSize =
    1 /
    Math.max(
      1e-9,
      Math.hypot(unitPixel[0] - originPixel[0], unitPixel[1] - originPixel[1]) *
        editor.adapter.pixelScale(),
    );
  if (snap && settings.snap) {
    const p = editor.adapter.project(hit.point, hit.view);
    const magnetic = excludeId && editor.drag?.shapeBefore;
    if (magnetic && editor.drag.magnetPoint) {
      const q = editor.adapter.project(editor.drag.magnetPoint, hit.view);
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) * editor.adapter.pixelScale() < 18) {
        return { ...hit, point: [...editor.drag.magnetPoint], snapped: true, kind: 'Ändpunkt' };
      }
      editor.drag.magnetPoint = null;
    }
    let best = magnetic ? 14 : 10;
    const drawn = editor.items
      .filter((item) => item.type === 'shape' && item.view === hit.view && item.id !== excludeId)
      .flatMap((item) =>
        magnetic
          ? shapeGrips(item).map((grip) => grip.point)
          : item.shape === 'circle'
            ? []
            : item.shape === 'arc'
              ? [item.points[0], item.points[2]]
              : shapeSnapPoints(item),
      );
    const lines = editor.items
      .filter(
        (item) =>
          item.type === 'shape' &&
          item.view === hit.view &&
          item.id !== excludeId &&
          ['line', 'polyline', 'polygon', 'rectangle'].includes(item.shape),
      )
      .map((item) => {
        const points = shapeSnapPoints(item);
        return {
          type: 'line',
          points:
            item.closed || ['polygon', 'rectangle'].includes(item.shape)
              ? [...points, points[0]]
              : points,
        };
      });
    const additional = snapFrame(rawPoint, {
      entities: nearbySnapEntities(
        [...lines, ...(editor.adapter.snapEntities?.(hit.view) || [])],
        rawPoint,
        pixelSize * best,
      ),
      base,
      tolerance: pixelSize * best,
      endpoints: false,
      midpoints: settings.midpoints,
      intersections: settings.intersections,
      perpendicular: settings.perpendicular,
    });
    const candidates = editor.adapter
      .candidates(hit.view)
      .filter(
        (p) =>
          p.reference?.kind !== 'bore' &&
          (p.snapKind === 'Mittpunkt' ? settings.midpoints : settings.endpoints),
      )
      .map((point) => ({ point, kind: point.snapKind || 'Ändpunkt' }));
    if (settings.endpoints) candidates.push(...drawn.map((point) => ({ point, kind: 'Ändpunkt' })));
    if (settings.centers)
      candidates.push(
        ...editor.adapter
          .candidates(hit.view)
          .filter((p) => p.reference?.kind === 'bore')
          .map((point) => ({ point, kind: 'Centrum' })),
      );
    if (additional.kind !== 'Fritt') candidates.push(additional);
    for (const item of editor.items.filter(
      (item) => item.type === 'shape' && item.view === hit.view && item.id !== excludeId,
    )) {
      if (!['circle', 'arc'].includes(item.shape)) continue;
      try {
        const geometry =
          item.shape === 'arc'
            ? arcGeometry(item.points)
            : {
                center: item.points[0],
                radius: Math.hypot(
                  item.points[1][0] - item.points[0][0],
                  item.points[1][1] - item.points[0][1],
                ),
              };
        if (settings.centers) candidates.push({ point: geometry.center, kind: 'Centrum' });
        if (settings.quadrants && item.shape === 'circle')
          for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
            candidates.push({
              point: [
                geometry.center[0] + geometry.radius * Math.cos(angle),
                geometry.center[1] + geometry.radius * Math.sin(angle),
              ],
              kind: 'Kvadrant',
            });
      } catch {
        /* A draft arc may not have a center yet. */
      }
    }
    if (hit.view === 'paper' && settings.endpoints)
      for (const item of editor.items.filter(
        (item) => item.type === 'richtext' && !editor.transform?.ids.includes(item.id),
      )) {
        const [x, y] = item.points[0],
          height = editor.richText.layout(item).height,
          angle = ((item.rotation || 0) * Math.PI) / 180;
        for (const [dx, dy] of [
          [0, 0],
          [item.width, 0],
          [item.width, height],
          [0, height],
        ])
          candidates.push({
            point: [
              x + dx * Math.cos(angle) - dy * Math.sin(angle),
              y + dx * Math.sin(angle) + dy * Math.cos(angle),
            ],
            kind: 'Ändpunkt',
          });
      }
    if (editor.draft?.points.length >= 3 && ['polyline', 'polygon'].includes(editor.mode))
      candidates.push({ point: editor.draft.points[0], kind: 'Ändpunkt' });
    for (const { point: candidate, kind } of candidates) {
      if (
        settings.ortho &&
        base &&
        Math.min(Math.abs(candidate[0] - base[0]), Math.abs(candidate[1] - base[1])) > 1e-6
      )
        continue;
      const q = editor.adapter.project(candidate, hit.view),
        distance = Math.hypot(q[0] - p[0], q[1] - p[1]) * editor.adapter.pixelScale();
      if (distance < best) {
        best = distance;
        hit.point = candidate;
        hit.reference = candidate.reference || null;
        hit.snapped = true;
        hit.kind = kind;
      }
    }
    if (!hit.snapped && hit.view !== 'paper' && editor.adapter.gridSnap) {
      const gridPoint = editor.adapter.gridSnap(hit.point);
      if (
        gridPoint &&
        (!settings.ortho ||
          !base ||
          Math.min(Math.abs(gridPoint[0] - base[0]), Math.abs(gridPoint[1] - base[1])) <= 1e-6)
      ) {
        hit.point = gridPoint;
        hit.reference = editor.adapter.gridReference?.(gridPoint) || null;
        hit.snapped = true;
        hit.kind = 'Stomlinje';
      }
    }
    if (magnetic && hit.snapped) editor.drag.magnetPoint = [...hit.point];
  }
  editor.trackHit =
    snap && settings.snap && settings.otrack
      ? editor.tracking.locate(rawPoint, {
          view: hit.view,
          snapped: !!hit.snapped,
          point: hit.point,
          tolerance: pixelSize * 8,
        })
      : null;
  if (editor.trackHit?.guides.length) {
    hit.point = editor.trackHit.point;
    hit.reference = null;
    hit.kind = 'Otrack';
  } else if (!hit.snapped && snap)
    hit.point = constrainCadPoint(hit.point, base, {
      ortho: settings.ortho || (e.shiftKey && editor.workflow === 'shape'),
      polar: settings.polar,
      tolerance: pixelSize * 8,
    });
  if (
    !hit.snapped &&
    snap &&
    base &&
    !editor.trackHit?.guides.length &&
    (settings.ortho || settings.polar || e.shiftKey)
  ) {
    if (Math.hypot(hit.point[0] - rawPoint[0], hit.point[1] - rawPoint[1]) > 1e-9) {
      hit.kind = settings.ortho || e.shiftKey ? 'Ortho' : 'Polar';
      hit.guideBase = base;
    }
  }
  editor.cad?.coordinates(hit.point);
  if (editor.dynamicInput && !editor.transform?.active())
    editor.dynamicInput.hidden = !(
      editor.workflow === 'shape' &&
      editor.draft?.points.length &&
      ['line', 'polyline', 'polygon', 'circle'].includes(editor.mode) &&
      !editor.drag
    );
  if (editor.dynamicInput && !editor.dynamicInput.hidden && !editor.transform?.active()) {
    editor.dynamicInput.querySelector('.ui-exact-length-label span').textContent =
      editor.mode === 'circle' ? 'Radie · mm' : 'Längd · mm';
  }
  return hit;
}
