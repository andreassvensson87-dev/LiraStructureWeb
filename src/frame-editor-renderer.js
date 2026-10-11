import { cadFeedback, paintCadSnap, paintCadGuide } from './ui/cad-feedback.js';
import { createSvgGrip, updateScreenGrips } from './ui/grip.js';

import { frameText } from './frame-text.js';

import { attributeDrawingValue } from './drawing-attributes.js';

import { frameEditGrips, moveFrameVertices } from './frame-grips.js';

import { transformFrameEntity } from './frame-model.js';

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
export function paintFrameEditor({
  view,
  dynamicInput,
  base,
  pending,
  tool,
  gripDrag,
  svg: root,
  frame,
  getContext,
  $,
  selected,
  cad,
  mode,
  attrs,
  displayEntities,
  cursor,
  vertexGrip,
  startGrip,
  activeGrip,
  selectionPress,
  trackHit,
  snap,
  paintReport,
}) {
  if (!view) return;
  dynamicInput.hidden = !(
    (base || pending.length) &&
    tool !== 'select' &&
    tool !== 'report-area' &&
    !gripDrag
  );
  root.setAttribute('viewBox', view.join(' '));
  root.setAttribute('preserveAspectRatio', 'none');
  root.replaceChildren(
    svg('rect', {
      x: 0,
      y: 0,
      width: frame.width,
      height: frame.height,
      fill: 'white',
      stroke: '#a4b5bc',
      'stroke-width': 0.3,
    }),
  );
  const g = svg('g', { transform: `translate(0 ${frame.height}) scale(1 -1)` });
  root.append(g);
  const context = getContext(),
    drawing = context.drawings.find((d) => d.id === $('preview').value),
    ctx = {
      project: context.project,
      drawing: drawing || {},
      custom: drawing?.attributes || frame.previewValues || {},
    };
  const paint = (e, ghost = false) => {
    const group = svg('g', {
      'data-entity': e.id,
      opacity: ghost ? cadFeedback.previewOpacity : 1,
    });
    g.append(group);
    const color = ghost
      ? cadFeedback.preview
      : selected.has(e.id)
        ? '#178268'
        : e.color || '#233940';
    if (e.type === 'line') {
      const points = e.points.map((p) => p.join(',')).join(' ');
      group.append(
        svg('polyline', {
          points,
          fill: 'none',
          stroke: 'transparent',
          'stroke-width': Math.max(e.stroke, (view[2] / root.clientWidth) * 10),
          'pointer-events': 'stroke',
        }),
        svg('polyline', {
          points,
          fill: 'none',
          stroke: color,
          'stroke-width': cad.get().lineweight ? e.stroke : view[2] / root.clientWidth,
          'pointer-events': 'none',
        }),
      );
    } else {
      group.setAttribute(
        'transform',
        `translate(${e.point.join(' ')}) rotate(${e.angle || 0}) scale(1 -1)`,
      );
      if (e.type === 'image') {
        group.append(
          svg('image', { href: e.src, x: 0, y: -e.height, width: e.width, height: e.height }),
        );
        if (selected.has(e.id))
          group.append(
            svg('rect', {
              x: 0,
              y: -e.height,
              width: e.width,
              height: e.height,
              fill: 'none',
              stroke: color,
              'stroke-width': 0.4,
            }),
          );
      } else {
        const rendered = frameText(
          e,
          {
            ...ctx,
            drawing: {
              ...ctx.drawing,
              ...(mode === 'layout' ? { paperFormat: frame.paperFormat } : {}),
            },
          },
          attributeDrawingValue,
        );
        const name = attrs().find((a) => a.key === e.key)?.name || e.key,
          value = e.type === 'attribute' ? (drawing ? rendered.value : `〈${name}〉`) : e.text;
        group.append(
          svg(
            'text',
            {
              'font-size': drawing ? rendered.size : e.size,
              'font-family': e.font || 'Arial, sans-serif',
              'text-anchor': e.align,
              fill: e.type === 'attribute' && !drawing ? '#397dc5' : color,
            },
            value || ' ',
          ),
        );
      }
    }
    if (ghost) group.setAttribute('pointer-events', 'none');
  };
  displayEntities().forEach((e) => paint(e));
  paintReport();
  if (mode === 'block') {
    const p = frame.origin || [0, 0];
    g.append(
      svg('path', {
        d: `M${p[0] - 4},${p[1]}h8 M${p[0]},${p[1] - 4}v8`,
        stroke: '#d25650',
        'stroke-width': 0.4,
        'pointer-events': 'none',
      }),
    );
  }
  if (pending.length)
    paint(
      {
        id: '',
        type: 'line',
        points: [...pending, ...(cursor ? [cursor] : [])],
        stroke: +$('stroke').value || 0.25,
      },
      true,
    );
  if (base && cursor && ['move', 'copy'].includes(tool))
    displayEntities()
      .filter((e) => selected.has(e.id))
      .forEach((e) =>
        paint(
          vertexGrip
            ? moveFrameVertices(e, vertexGrip, cursor)
            : transformFrameEntity(e, base, cursor),
          true,
        ),
      );
  if (tool === 'select') {
    for (const entity of frame.entities.filter((e) => selected.has(e.id)))
      frameEditGrips(entity, frame).forEach(({ point: p, index }) => {
        const grip = createSvgGrip({
          point: p,
          role: entity.type !== 'line' || index === -1 ? 'move' : 'point',
          key: `${entity.id}:${index}`,
          label:
            index === -1
              ? 'Flytta hela linjeobjektet'
              : `Flytta ${entity.type === 'line' ? 'linjepunkt' : entity.type === 'text' ? 'text' : entity.type === 'attribute' ? 'attributtext' : entity.type === 'block' ? 'ramblock' : 'bild'} ${index + 1}`,
          attrs: { 'data-grip': entity.id, 'data-index': index, role: 'button', tabindex: 0 },
        });
        grip.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            startGrip(entity.id, index);
          }
        });
        g.append(grip);
      });
  }
  if (activeGrip && cursor && tool === 'move') {
    const grip = createSvgGrip({
      point: cursor,
      role: activeGrip.role,
      key: `${activeGrip.id}:${activeGrip.index}`,
      label: 'Aktivt grepp',
    });
    grip.classList.add('is-active');
    grip.style.pointerEvents = 'none';
    g.append(grip);
  }
  updateScreenGrips(root);
  if (selectionPress?.dragging) {
    const p = selectionPress,
      r = root.getBoundingClientRect(),
      a = p.start,
      b = p.end,
      crossing = b[0] < a[0];
    root.append(
      svg('rect', {
        'data-selection-window': crossing ? 'crossing' : 'window',
        x: view[0] + ((Math.min(a[0], b[0]) - r.left) / r.width) * view[2],
        y: view[1] + ((Math.min(a[1], b[1]) - r.top) / r.height) * view[3],
        width: (Math.abs(a[0] - b[0]) / r.width) * view[2],
        height: (Math.abs(a[1] - b[1]) / r.height) * view[3],
        fill: crossing ? '#20a56e' : '#397dc5',
        'fill-opacity': 0.12,
        stroke: crossing ? '#16845a' : '#397dc5',
        'stroke-width': 1,
        'stroke-dasharray': crossing ? '5 3' : 'none',
        'vector-effect': 'non-scaling-stroke',
        'pointer-events': 'none',
      }),
    );
  }
  if (cursor && tool !== 'select') {
    const matrix = g.getScreenCTM();
    const pixelScale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
    for (const { anchor } of trackHit?.guides || [])
      paintCadGuide(g, anchor, cursor, { role: 'tracking', dashed: true, pixelScale });
    if (['Polar', 'Ortho'].includes(snap?.kind) && (base || pending.length))
      paintCadGuide(g, base || pending.at(-1), cursor, {
        role: 'polar',
        dashed: true,
        pixelScale,
      });
    if (snap?.kind && !['Fritt', 'Rutsteg', 'Polar', 'Ortho'].includes(snap.kind))
      paintCadSnap(g, cursor, { kind: snap.kind, pixelScale });
  }
}
