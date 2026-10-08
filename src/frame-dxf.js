import DxfParser from 'dxf-parser';
import { blankFrame } from './frame-model.js';

export const dxfUnits = [
  { name: 'Millimeter', code: 4, factor: 1 },
  { name: 'Centimeter', code: 5, factor: 10 },
  { name: 'Meter', code: 6, factor: 1000 },
  { name: 'Tum', code: 1, factor: 25.4 },
  { name: 'Fot', code: 2, factor: 304.8 },
];
export function parseFrameDXF(source) {
  if (source.startsWith('AutoCAD Binary DXF')) throw Error('Välj en DXF i textformat (ASCII).');
  if (source.length > 10 * 1024 * 1024) throw Error('DXF-filen får vara högst 10 MB.');
  try {
    const doc = new DxfParser().parseSync(source.replace(/^\uFEFF/, ''));
    if (!doc?.entities?.length) throw Error();
    const lines = source.split(/\r?\n/);
    const omitted = new Set();
    let section = '';
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = Number(lines[i].trim()),
        value = lines[i + 1].trim();
      if (code === 0 && value === 'SECTION') section = lines[i + 3]?.trim() || '';
      if (code === 0 && value === 'ENDSEC') section = '';
      if (
        code === 0 &&
        ['ENTITIES', 'BLOCKS'].includes(section) &&
        ![
          'SECTION',
          'BLOCK',
          'ENDBLK',
          'VERTEX',
          'SEQEND',
          'LINE',
          'LWPOLYLINE',
          'POLYLINE',
          'CIRCLE',
          'ARC',
          'TEXT',
          'MTEXT',
          'INSERT',
        ].includes(value)
      )
        omitted.add(value);
    }
    doc.omittedTypes = [...omitted];
    return doc;
  } catch {
    throw Error('Kunde inte läsa DXF-filen. Kontrollera att den innehåller ritade objekt.');
  }
}
const xy = (p) => {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y))
    throw Error('Ogiltiga koordinater i DXF.');
  return [p.x, p.y];
};
const cleanText = (s) =>
  String(s || '')
    .replace(/\\U\+([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/%%d/gi, '°')
    .replace(/%%p/gi, '±')
    .replace(/%%c/gi, 'Ø')
    .replace(/\\P/g, '\n')
    .replace(/\\~/g, ' ')
    .replace(/\\[ACFHQTW][^;]*;/gi, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/[{}]/g, '');
function curve(center, radius, start, sweep) {
  if (!(radius > 0) || ![radius, start, sweep].every(Number.isFinite))
    throw Error('Ogiltig båge i DXF.');
  const n = Math.min(
    2048,
    Math.max(
      2,
      Math.ceil(
        Math.abs(sweep) / Math.min(Math.PI / 36, 2 * Math.acos(Math.max(-1, 1 - 0.02 / radius))),
      ),
    ),
  );
  return Array.from({ length: n + 1 }, (_, i) => [
    center[0] + radius * Math.cos(start + (sweep * i) / n),
    center[1] + radius * Math.sin(start + (sweep * i) / n),
  ]);
}
function polyline(e) {
  const points = [];
  const vertices = e.vertices || [];
  for (let i = 0; i < vertices.length; i++) {
    const a = xy(vertices[i]),
      b = vertices[i + 1] || (e.shape ? vertices[0] : null);
    points.push(a);
    if (!b || !vertices[i].bulge) continue;
    const end = xy(b),
      bulge = vertices[i].bulge,
      dx = end[0] - a[0],
      dy = end[1] - a[1];
    const distance = Math.hypot(dx, dy);
    if (!distance) continue;
    const center = [
      (a[0] + end[0]) / 2 - (dy * (1 - bulge * bulge)) / (4 * bulge),
      (a[1] + end[1]) / 2 + (dx * (1 - bulge * bulge)) / (4 * bulge),
    ];
    points.push(
      ...curve(
        center,
        (distance * (1 + bulge * bulge)) / (4 * Math.abs(bulge)),
        Math.atan2(a[1] - center[1], a[0] - center[0]),
        4 * Math.atan(bulge),
      ).slice(1, -1),
    );
  }
  if (e.shape && vertices.length) points.push(xy(vertices[0]));
  return points;
}
export function frameFromDXF(
  doc,
  {
    name = 'Importerat ramblock',
    factor = 1,
    scale = 1,
    origin = [0, 0],
    maxSize = 5000,
    maxEntities = 20000,
    normalizeOrigin = true,
  } = {},
) {
  const unit = factor * scale;
  if (!(unit > 0) || !Number.isFinite(unit) || !origin.every(Number.isFinite))
    throw Error('Ange giltig skala och insättningspunkt.');
  const entities = [],
    skipped = new Set(doc.omittedTypes || []);
  const push = (e) => {
    if (entities.length >= maxEntities)
      throw Error(`DXF-filen innehåller för många objekt (högst ${maxEntities}).`);
    entities.push({ id: crypto.randomUUID(), ...e });
  };
  function visit(
    e,
    transform = { point: [0, 0], scale: unit, angle: 0 },
    stack = [],
    parentLayer = '0',
  ) {
    const layerName = !e.layer || e.layer === '0' ? parentLayer : e.layer;
    const extrusion = e.extrusionDirection || {
      x: e.extrusionDirectionX || 0,
      y: e.extrusionDirectionY || 0,
      z: e.extrusionDirectionZ ?? 1,
    };
    if (
      extrusion.x ||
      extrusion.y ||
      extrusion.z !== 1 ||
      e.is3dPolyline ||
      e.is3dPolygonMesh ||
      e.isPolyfaceMesh ||
      e.includesCurveFitVertices ||
      e.includesSplineFitVertices
    ) {
      skipped.add(`${e.type} (3D)`);
      return;
    }
    const radians = (transform.angle * Math.PI) / 180;
    const point = (p) => [
      transform.point[0] + transform.scale * (p[0] * Math.cos(radians) - p[1] * Math.sin(radians)),
      transform.point[1] + transform.scale * (p[0] * Math.sin(radians) + p[1] * Math.cos(radians)),
    ];
    if (e.type === 'INSERT') {
      const block = doc.blocks?.[e.name],
        sx = e.xScale ?? 1,
        sy = e.yScale ?? 1;
      if (
        !block ||
        stack.includes(e.name) ||
        stack.length > 16 ||
        sx <= 0 ||
        sx !== sy ||
        (e.columnCount || 1) > 1 ||
        (e.rowCount || 1) > 1
      ) {
        skipped.add('INSERT (block utan stöd)');
        return;
      }
      const angle = transform.angle + (e.rotation || 0),
        base = xy(block.position || { x: 0, y: 0 });
      const pos = point(xy(e.position)),
        r = (angle * Math.PI) / 180,
        size = transform.scale * sx;
      const next = {
        point: [
          pos[0] - size * (base[0] * Math.cos(r) - base[1] * Math.sin(r)),
          pos[1] - size * (base[0] * Math.sin(r) + base[1] * Math.cos(r)),
        ],
        scale: size,
        angle,
      };
      for (const child of block.entities || []) visit(child, next, [...stack, e.name], layerName);
      return;
    }
    const layer = doc.tables?.layer?.layers?.[layerName];
    const rawColor = e.color ?? layer?.color;
    const color =
      rawColor && rawColor !== 0xffffff ? `#${rawColor.toString(16).padStart(6, '0')}` : '#233940';
    const style = {
      color,
      stroke: e.lineweight > 0 ? e.lineweight / 100 : 0.25,
      layer: layerName,
    };
    if (['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC'].includes(e.type)) {
      let points;
      if (e.type === 'LINE') points = e.vertices.map(xy);
      else if (e.type.endsWith('POLYLINE')) points = polyline(e);
      else {
        const start = e.type === 'CIRCLE' ? 0 : e.startAngle;
        const sweep =
          e.type === 'CIRCLE'
            ? 2 * Math.PI
            : (((e.endAngle - start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        points = curve(xy(e.center), e.radius, start, sweep);
      }
      if (points.length >= 2) push({ type: 'line', points: points.map(point), ...style });
    } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
      if (e.type === 'TEXT' && ((e.halign || 0) > 2 || (e.xScale ?? 1) !== 1)) {
        skipped.add('TEXT (specialjustering)');
        return;
      }
      const size = (e.textHeight || e.height) * transform.scale;
      if (!(size > 0) || !Number.isFinite(size)) throw Error('Ogiltig texthöjd i DXF.');
      const p = point(
        xy(
          e.type === 'MTEXT'
            ? e.position
            : (e.halign || e.valign) && e.endPoint
              ? e.endPoint
              : e.startPoint,
        ),
      );
      const angle =
        transform.angle +
        (e.rotation ||
          (e.directionVector
            ? (Math.atan2(e.directionVector.y, e.directionVector.x) * 180) / Math.PI
            : 0));
      const rows = cleanText(e.text).split('\n'),
        align =
          e.type === 'TEXT'
            ? ['start', 'middle', 'end'][e.halign || 0]
            : ['start', 'middle', 'end'][((e.attachmentPoint || 1) - 1) % 3];
      const vertical = Math.floor(((e.attachmentPoint || 1) - 1) / 3),
        total = (rows.length - 1) * size * 1.4;
      const offset =
        e.type === 'MTEXT'
          ? vertical === 2
            ? total
            : vertical === 1
              ? (total - size) / 2
              : -size
          : e.valign === 3
            ? -size
            : e.valign === 2
              ? -size / 2
              : 0;
      for (let i = 0; i < rows.length; i++) {
        const dy = offset - i * size * 1.4,
          a = (angle * Math.PI) / 180;
        push({
          type: 'text',
          text: rows[i],
          point: [p[0] - dy * Math.sin(a), p[1] + dy * Math.cos(a)],
          size,
          angle,
          align,
          font: 'Arial, sans-serif',
          color,
          layer: layerName,
        });
      }
    } else skipped.add(e.type);
  }
  for (const e of doc.entities) visit(e);
  if (!entities.length) throw Error('DXF-filen innehåller inga ramobjekt som stöds.');
  const bounds = entities.flatMap(
    (e) =>
      e.points ||
      (() => {
        const w = e.text.length * e.size * 0.65,
          left = e.align === 'end' ? -w : e.align === 'middle' ? -w / 2 : 0,
          angle = (e.angle * Math.PI) / 180;
        return [
          [left, -e.size * 0.25],
          [left + w, -e.size * 0.25],
          [left, e.size],
          [left + w, e.size],
        ].map(([x, y]) => [
          e.point[0] + x * Math.cos(angle) - y * Math.sin(angle),
          e.point[1] + x * Math.sin(angle) + y * Math.cos(angle),
        ]);
      })(),
  );
  if (!bounds.every((p) => p.every(Number.isFinite))) throw Error('Ogiltiga koordinater i DXF.');
  const min = [0, 1].map((i) => bounds.reduce((v, p) => Math.min(v, p[i]), Infinity));
  const max = [0, 1].map((i) => bounds.reduce((v, p) => Math.max(v, p[i]), -Infinity));
  const width = Math.max(1, max[0] - min[0]),
    height = Math.max(1, max[1] - min[1]);
  if (Math.max(width, height) > maxSize)
    throw Error('Ramblocket är större än 5 000 mm. Kontrollera enhet och skala.');
  for (const e of entities) {
    const move = (p) => p.map((v, i) => v - (normalizeOrigin ? min[i] : 0));
    if (e.points) e.points = e.points.map(move);
    else e.point = move(e.point);
  }
  return {
    frame: {
      ...blankFrame(),
      name,
      width,
      height,
      origin: origin.map((v, i) => v * unit - (normalizeOrigin ? min[i] : 0)),
      entities,
    },
    skipped: [...skipped],
  };
}
