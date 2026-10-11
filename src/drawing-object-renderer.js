import { shapePath, shapeContours } from './drawing-shapes.js';
import { shapeGrips } from './drawing-shape-grips.js';
import { shapeStyle } from './drawing-shape-style.js';
import { chainGeometry, formatDimension } from './dimension-chain.js';
import { appendMaterialHatch } from './drawing-hatch.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};
export function paintDrawingObject(editor, root, item, selected) {
  const project = (p) => editor.adapter.project(p, item.view),
    unit = editor.adapter.unit(),
    fontSize =
      (item.textSize ??
        editor.record?.drawingPreset?.[item.type === 'leader' ? 'leaderSize' : 'dimensionSize'] ??
        2.5) * unit,
    g = el('g', {
      'data-annotation': item.id,
      class: 'drawing-annotation',
      fill: 'none',
      stroke: '#263a42',
      'stroke-width': (editor.record?.drawingPreset?.lineWidth ?? 0.22) * unit,
    });
  root.append(g);
  if (item.type === 'shape') {
    try {
      const style = shapeStyle(item, editor.record?.drawingPreset, unit);
      g.setAttribute('stroke', style.color);
      g.setAttribute('stroke-width', style.width);
      const path =
        shapePath(item.shape, item.points, project) +
        (item.closed || item.shape === 'polygon' ? 'Z' : '');
      g.append(
        el('path', {
          d: path,
          fill: style.fill,
          'stroke-dasharray': style.dash,
          'stroke-linecap': style.lineType === 'dotted' ? 'round' : 'butt',
        }),
      );
      if (item.hatch?.pattern !== 'none' && item.hatch)
        appendMaterialHatch(
          g,
          [{ contours: shapeContours(item), material: { id: item.id, hatch: item.hatch } }],
          project,
          unit,
        );
      g.append(
        el('path', {
          d: path,
          fill: shapeContours(item).length ? 'transparent' : 'none',
          stroke: 'transparent',
          'stroke-width': 5 * unit,
          class: 'annotation-hit',
        }),
      );
      const helpers = el('g', {
        'data-annotation': item.id,
        'data-annotation-helper': 'selection',
      });
      (editor.overlay || root).append(helpers);
      if (selected)
        helpers.append(
          el('path', {
            d: path,
            fill: 'none',
            stroke: '#317fc4',
            'stroke-width': 1.5,
            'vector-effect': 'non-scaling-stroke',
            'pointer-events': 'none',
          }),
        );
      if (selected && !editor.mode) {
        const size = 6 / editor.adapter.pixelScale();
        for (const [index, grip] of shapeGrips(item).entries()) {
          const q = project(grip.point);
          const target = el('g', {
            'data-shape-grip': index,
            class: 'shape-grip-target',
            role: 'img',
            'aria-label':
              grip.kind === 'move' ? 'Dra för att flytta objektet' : 'Dra för att ändra geometrin',
          });
          const hitSize = 18 / editor.adapter.pixelScale();
          target.append(
            el('rect', {
              x: q[0] - hitSize / 2,
              y: q[1] - hitSize / 2,
              width: hitSize,
              height: hitSize,
              fill: 'transparent',
              stroke: 'none',
              class: 'shape-grip-hit',
            }),
          );
          target.append(
            el('rect', {
              x: q[0] - size / 2,
              y: q[1] - size / 2,
              width: size,
              height: size,
              fill: '#287c65',
              stroke: 'white',
              'stroke-width': 1 / editor.adapter.pixelScale(),
              class: 'shape-grip',
            }),
          );
          helpers.append(target);
        }
      }
    } catch {
      /* Three-point arc preview can be collinear until the last point is picked. */
    }
    return;
  }
  const line = (a, b, hit = false) =>
    g.append(
      el('path', {
        d: `M${a}L${b}`,
        ...(hit
          ? { stroke: 'transparent', 'stroke-width': 5 * unit, class: 'annotation-hit' }
          : {}),
      }),
    );
  const text = (p, value, angle = 0) =>
    g.append(
      el(
        'text',
        {
          x: p[0],
          y: p[1],
          transform: `rotate(${angle} ${p[0]} ${p[1]})`,
          fill: '#263a42',
          stroke: 'white',
          'stroke-width': 0.8 * unit,
          'paint-order': 'stroke',
          'text-anchor': 'middle',
          'font-size': fontSize,
        },
        value,
      ),
    );
  if (item.type === 'leader') {
    const a = project(item.points[0]),
      b = project(item.line),
      sign = b[0] >= a[0] ? 1 : -1,
      mark = editor.adapter.mark(item.sourceId) || 'Ej numrerad',
      label = item.manual
        ? item.comment || ''
        : item.comment?.trim()
          ? `${item.comment.trim()} · ${mark}`
          : mark,
      labelWidth = Math.max(14 * unit, label.length * fontSize * 0.65 + 2 * unit),
      end = [b[0] + sign * labelWidth, b[1]];
    line(a, b);
    line(b, end);
    line(a, b, true);
    const d = [b[0] - a[0], b[1] - a[1]],
      len = Math.hypot(...d) || 1,
      u = d.map((v) => v / len),
      n = [-u[1], u[0]];
    g.append(
      el('path', {
        d: `M${a}L${[a[0] + u[0] * 2.5 * unit + n[0] * 0.65 * unit, a[1] + u[1] * 2.5 * unit + n[1] * 0.65 * unit]}L${[a[0] + u[0] * 2.5 * unit - n[0] * 0.65 * unit, a[1] + u[1] * 2.5 * unit - n[1] * 0.65 * unit]}Z`,
        fill: '#263a42',
      }),
    );
    text([(b[0] + end[0]) / 2, b[1] - unit], label);
  } else {
    let chain;
    try {
      chain = chainGeometry(item);
    } catch {
      return;
    }
    for (const p of chain.points) {
      const a = project(p.point),
        b = project(p.end),
        d = [b[0] - a[0], b[1] - a[1]],
        len = Math.hypot(...d) || 1;
      line(
        [a[0] + (d[0] / len) * 0.8 * unit, a[1] + (d[1] / len) * 0.8 * unit],
        [b[0] + (d[0] / len) * 1.2 * unit, b[1] + (d[1] / len) * 1.2 * unit],
      );
      line([b[0] - unit, b[1] + unit], [b[0] + unit, b[1] - unit]);
    }
    for (const segment of chain.segments) {
      const a = project(segment.a),
        b = project(segment.b);
      line(a, b);
      line(a, b, true);
      let angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      const rad = (angle * Math.PI) / 180;
      text(
        [(a[0] + b[0]) / 2 + Math.sin(rad) * unit, (a[1] + b[1]) / 2 - Math.cos(rad) * unit],
        formatDimension(segment.length, item.precision),
        angle,
      );
    }
    if (item.comment?.trim()) {
      const ends = chain.points.map((p) => project(p.end)),
        left = ends.reduce((a, b) => (b[0] < a[0] ? b : a)),
        vertical = Math.abs(ends[0][0] - ends.at(-1)[0]) < 0.001,
        y = vertical ? (ends[0][1] + ends.at(-1)[1]) / 2 : left[1] - unit;
      g.append(
        el(
          'text',
          {
            class: 'annotation-comment',
            x: left[0] - 3 * unit,
            y,
            fill: '#263a42',
            stroke: 'white',
            'stroke-width': 0.8 * unit,
            'paint-order': 'stroke',
            'text-anchor': 'end',
            'font-size': fontSize,
          },
          item.comment.trim(),
        ),
      );
    }
  }
  if (selected) {
    for (const [index, p] of item.points.entries()) {
      const q = project(p),
        r = 5 / editor.adapter.pixelScale();
      const handle = el('rect', {
        'data-anchor': index,
        class: 'annotation-anchor',
        x: q[0] - r,
        y: q[1] - r,
        width: 2 * r,
        height: 2 * r,
        rx: r * 0.3,
        fill: 'white',
        stroke: '#287c65',
        'stroke-width': 1.5,
        'vector-effect': 'non-scaling-stroke',
      });
      handle.append(
        el(
          'title',
          {},
          item.type === 'leader'
            ? 'Klicka för att flytta hänvisningens fästpunkt'
            : 'Klicka för att flytta måttpunkt',
        ),
      );
      const helpers = el('g', {
        'data-annotation': item.id,
        'data-annotation-helper': 'selection',
      });
      (editor.overlay || root).append(helpers);
      helpers.append(handle);
    }
  }
}
