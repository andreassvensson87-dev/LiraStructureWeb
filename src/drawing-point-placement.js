import { chooseSnap, snapType, isTrackingAnchor, SNAP_PIXELS } from './snap-priority.js';
import { curveSnapCandidates } from './drawing-snap-curves.js';
import { nearbySnapEntities } from './drawing-snap-geometry.js';
import { defaultCadSettings } from './cad-statusbar.js';
import { cadDirectionSnap, polarTrackingIntersection } from './cad-tracking.js';
import { snapFrame } from './frame-model.js';
import { shapeSnapPoints, arcGeometry } from './drawing-shapes.js';

export function locateDrawingPoint(editor, e, view, snap = true, excludeId = null) {
  editor.lastCadPosition = { clientX: e.clientX, clientY: e.clientY };
  const hit = editor.adapter.locate(e, view);
  if (!hit) return null;
  const settings = editor.cad?.get() || defaultCadSettings;
  const ortho = settings.ortho || (e.shiftKey && editor.workflow === 'shape');
  const base =
    (editor.transform?.active() && editor.transform.base) ||
    editor.draft?.points.at(-1) ||
    editor.grips?.session?.base;
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
  const context = JSON.stringify([hit.view, editor.mode, base || null]);
  const previous = editor.previousPointSnap?.context === context ? editor.previousPointSnap : null;
  const distancePixels = (candidate) => {
    const a = editor.adapter.project(candidate, hit.view),
      b = editor.adapter.project(rawPoint, hit.view);
    return Math.hypot(a[0] - b[0], a[1] - b[1]) * editor.adapter.pixelScale();
  };
  let pointChoice = null,
    gridChoice = null;
  if (snap && settings.snap) {
    const best = SNAP_PIXELS.exact + SNAP_PIXELS.retention;
    const drawn = editor.items
      .filter(
        (item) =>
          item.type === 'shape' &&
          item.view === hit.view &&
          item.id !== excludeId &&
          !(
            ['move-shapes', 'rotate-shapes'].includes(editor.mode) &&
            editor.transform?.ids.includes(item.id)
          ),
      )
      .flatMap((item) =>
        item.shape === 'circle'
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
          !(
            ['move-shapes', 'rotate-shapes'].includes(editor.mode) &&
            editor.transform?.ids.includes(item.id)
          ) &&
          ['line', 'polyline', 'polygon', 'rectangle', 'insulation'].includes(item.shape),
      )
      .map((item) => {
        const points = shapeSnapPoints(item);
        return {
          type: 'line',
          points:
            item.closed || ['polygon', 'rectangle', 'insulation'].includes(item.shape)
              ? [...points, points[0]]
              : points,
        };
      });
    const additional = snapFrame(rawPoint, {
      entities: nearbySnapEntities(
        [...lines, ...(editor.adapter.snapEntities?.(hit.view, rawPoint, pixelSize * best) || [])],
        rawPoint,
        pixelSize * best,
      ),
      base,
      tolerance: pixelSize * SNAP_PIXELS.exact,
      previous,
      endpoints: false,
      midpoints: settings.midpoints,
      intersections: settings.intersections,
      perpendicular: settings.perpendicular,
      nearest: settings.nearest !== false,
      ortho,
    });
    const candidates = editor.adapter
      .candidates(hit.view, rawPoint, pixelSize * best)
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
      (item) =>
        item.type === 'shape' &&
        item.view === hit.view &&
        item.id !== excludeId &&
        !(
          ['move-shapes', 'rotate-shapes'].includes(editor.mode) &&
          editor.transform?.ids.includes(item.id)
        ),
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
    for (const item of editor.items.filter(
      (item) =>
        item.type === 'shape' &&
        item.view === hit.view &&
        item.id !== excludeId &&
        !(
          ['move-shapes', 'rotate-shapes'].includes(editor.mode) &&
          editor.transform?.ids.includes(item.id)
        ),
    ))
      candidates.push(...curveSnapCandidates(item, rawPoint, base, settings));
    pointChoice = chooseSnap(
      candidates
        .filter(
          ({ point }) =>
            !ortho ||
            !base ||
            Math.min(Math.abs(point[0] - base[0]), Math.abs(point[1] - base[1])) <= 1e-6,
        )
        .map((candidate) => ({
          ...candidate,
          type: snapType(candidate.kind),
          distance: distancePixels(candidate.point),
          snapped: true,
        })),
      previous,
    );
    if (
      (!pointChoice || snapType(pointChoice.kind) === 'nearest') &&
      hit.view !== 'paper' &&
      editor.adapter.gridSnap
    ) {
      const point = editor.adapter.gridSnap(rawPoint);
      if (
        point &&
        (!ortho ||
          !base ||
          Math.min(Math.abs(point[0] - base[0]), Math.abs(point[1] - base[1])) <= 1e-6)
      )
        gridChoice = {
          point,
          kind: 'Stomlinje',
          type: 'tracking',
          distance: distancePixels(point),
          reference: editor.adapter.gridReference?.(point) || null,
          snapped: true,
        };
    }
  }
  editor.trackHit =
    snap && settings.snap && settings.otrack
      ? editor.tracking.locate(rawPoint, {
          view: hit.view,
          snapped: !!pointChoice && isTrackingAnchor(pointChoice.type),
          point: pointChoice?.point || rawPoint,
          tolerance: pixelSize * SNAP_PIXELS.tracking,
        })
      : null;
  let trackingChoice = null,
    directionChoice = null;
  if (editor.trackHit?.guides.length) {
    const intersection = polarTrackingIntersection(rawPoint, base, editor.trackHit, {
      polar: ortho ? 90 : settings.polar,
      tolerance: pixelSize * SNAP_PIXELS.tracking,
    });
    const point = intersection || editor.trackHit.point;
    trackingChoice = {
      point,
      kind: intersection ? 'Skärning' : 'Otrack',
      type: intersection ? 'trackingIntersection' : 'tracking',
      distance: distancePixels(point),
      snapped: !!intersection,
      guideBase: intersection ? base : null,
    };
  }
  if (snap) {
    const direction = cadDirectionSnap(rawPoint, base, {
      ortho,
      polar: settings.polar,
      tolerance: pixelSize * SNAP_PIXELS.tracking,
    });
    if (direction)
      directionChoice = {
        ...direction,
        type: 'tracking',
        distance: distancePixels(direction.point),
        snapped: false,
        guideBase: base,
      };
  }
  const choices = [pointChoice, gridChoice, trackingChoice, directionChoice].filter(
    (candidate) =>
      candidate &&
      (!ortho ||
        !base ||
        Math.min(Math.abs(candidate.point[0] - base[0]), Math.abs(candidate.point[1] - base[1])) <=
          1e-6),
  );
  // Ortho is a hard constraint, even when the pointer lies far from the allowed axis.
  const chosen =
    chooseSnap(choices, previous) || (directionChoice?.kind === 'Ortho' ? directionChoice : null);
  if (chosen) {
    hit.point = chosen.point;
    hit.kind = chosen.kind;
    hit.snapped = chosen.snapped;
    hit.reference = chosen.reference || chosen.point.reference || null;
    if (chosen.guideBase) hit.guideBase = chosen.guideBase;
    if (chosen === trackingChoice) editor.trackHit.point = chosen.point;
  }
  if (editor.trackHit?.guides.length && chosen !== trackingChoice)
    editor.trackHit = { ...editor.trackHit, guides: [] };
  editor.previousPointSnap =
    chosen && isTrackingAnchor(chosen.type)
      ? { point: [...chosen.point], type: chosen.type, context }
      : null;
  editor.cad?.coordinates(hit.point);
  if (editor.dynamicInput && !editor.transform?.active())
    editor.dynamicInput.hidden = !(
      editor.workflow === 'shape' &&
      editor.draft?.points.length &&
      ['line', 'polyline', 'polygon', 'circle', 'insulation'].includes(editor.mode) &&
      !editor.drag
    );
  if (editor.dynamicInput && !editor.dynamicInput.hidden && !editor.transform?.active()) {
    editor.dynamicInput.querySelector('.ui-exact-length-label span').textContent =
      editor.mode === 'circle' ? 'Radie · mm' : 'Längd · mm';
  }
  return hit;
}
