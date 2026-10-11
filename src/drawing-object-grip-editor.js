import { shapeGrips, shapeWithGrip } from './drawing-shape-grips.js';
import { insulationFrame } from './drawing-insulation.js';
import { moveDimensionPoint } from './dimension-chain.js';

export function beginDrawingObjectGrip(editor, event, node) {
  const id = node.closest('[data-annotation]')?.dataset.annotation;
  const item = editor.items.find((item) => item.id === id);
  if (!item || item.type === 'richtext') return null;
  const before = structuredClone(item),
    history = structuredClone(editor.items);
  const index = Number(node.dataset.shapeGrip ?? node.dataset.anchor);
  const grip =
    item.type === 'shape'
      ? shapeGrips(before)[index]
      : { kind: 'point', index, point: before.points[index] };
  if (!grip) return null;
  editor.selected = id;
  editor.selectedIds = new Set([id]);
  editor.ui();
  const session = {
    label: node.getAttribute('aria-label'),
    base: grip.kind === 'radius' ? before.points[0] : grip.point,
    locate: (event) => editor.location(event, item.view, true, item.id),
    apply: (hit) => {
      if (item.type === 'shape') Object.assign(item, shapeWithGrip(before, grip, hit.point));
      else {
        const next = structuredClone(before);
        if (!editor.validAnchor(next, hit.point))
          throw Error('Fästpunkten måste ligga på samma objekt.');
        if (next.type === 'dimension') {
          if (!moveDimensionPoint(next, index, hit.point))
            throw Error('Punkten sammanfaller med ett annat delmått.');
        } else next.points[index] = [...hit.point];
        next.references ??= Array(next.points.length).fill(null);
        next.references[index] = editor.referenceFor(hit, next.sourceId);
        Object.assign(item, next);
      }
    },
    preview: () => editor.redrawFeedback(true),
    commit: () => {
      if (JSON.stringify(item) !== JSON.stringify(before)) {
        editor.history.push(history);
        editor.future = [];
      }
    },
    cancel: () => {
      for (const key of Object.keys(item)) if (!(key in before)) delete item[key];
      Object.assign(item, before);
    },
  };
  if (grip.kind === 'thickness') {
    const frame = insulationFrame(before);
    session.numeric = {
      label: 'Tjocklek · mm',
      hit: (value) => ({ point: frame.point(frame.length / 2, value) }),
    };
  } else if (grip.kind === 'radius') {
    const center = before.points[0],
      direction = grip.point.map((v, i) => v - center[i]);
    const length = Math.hypot(...direction);
    session.numeric = {
      label: 'Radie · mm',
      hit: (value) => ({ point: center.map((v, i) => v + (direction[i] * value) / length) }),
    };
  }
  return session;
}
