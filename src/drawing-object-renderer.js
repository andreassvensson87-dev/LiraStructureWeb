import { createSvgGrip } from './ui/grip.js';
import { insulationFrame, insulationPatternPath } from './drawing-insulation.js';
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
        item.shape === 'insulation'
          ? `M${insulationFrame(item).corners.map(project).join('L')}Z`
          : shapePath(item.shape, item.points, project) +
            (item.closed || item.shape === 'polygon' ? 'Z' : '');
      g.append(
        el('path', {
          d: path,
          fill: style.fill,
          'stroke-dasharray': style.dash,
          'stroke-linecap': style.lineType === 'dotted' ? 'round' : 'butt',
        }),
      );
      if (item.shape === 'insulation')
        g.append(el('path', { d: insulationPatternPath(item, project), fill: 'none' }));
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
        for (const [index, grip] of shapeGrips(item).entries()) {
          const q = project(grip.point);
          const role =
            grip.kind === 'move'
              ? 'move'
              : ['radius', 'thickness'].includes(grip.kind)
                ? 'parameter'
                : 'point';
          if (
            role === 'move' &&
            shapeGrips(item).some(
              (other) =>
                other !== grip &&
                other.kind !== 'move' &&
                Math.hypot(...project(other.point).map((v, i) => v - q[i])) *
                  editor.adapter.pixelScale() <
                  18,
            )
          )
            continue;
          const target = createSvgGrip({
            point: q,
            role,
            zoom: editor.adapter.pixelScale(),
            key: `${item.id}:shape:${index}`,
            label:
              grip.kind === 'move'
                ? 'Flytta objektet'
                : grip.kind === 'thickness'
                  ? 'Ändra isoleringstjockleken'
                  : grip.kind === 'radius'
                    ? 'Ändra radien'
                    : 'Ändra punkten',
            attrs: { 'data-shape-grip': index, class: 'cad-grip shape-grip-target' },
          });
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
      const handle = createSvgGrip({
        point: project(p),
        zoom: editor.adapter.pixelScale(),
        key: `${item.id}:anchor:${index}`,
        label: item.type === 'leader' ? 'Flytta hänvisningens fästpunkt' : 'Flytta måttpunkten',
        attrs: { 'data-anchor': index },
      });
      const helpers = el('g', {
        'data-annotation': item.id,
        'data-annotation-helper': 'selection',
      });
      (editor.overlay || root).append(helpers);
      helpers.append(handle);
    }
  }
}
