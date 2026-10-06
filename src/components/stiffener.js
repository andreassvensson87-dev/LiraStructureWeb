import * as THREE from 'three';
import { contours, profileAnchor, sweepFrame } from '../sweep.js';
import { validatePlate } from '../plate.js';

export const stiffenerDefaults = {
  sides: 'both',
  thickness: 10,
  gap: 2,
  cornerRelief: 0,
  referenceEnd: 'start',
  distance: 500,
};
export function validateStiffener(s) {
  if (
    s.kind !== 'stiffener' ||
    !Array.isArray(s.references) ||
    s.references.length !== 1 ||
    typeof s.references[0] !== 'string' ||
    !s.references[0] ||
    s.references[0] === s.id
  )
    return 'Avstyvning behöver en refererad balk eller pelare.';
  if (!['both', 'positive', 'negative'].includes(s.sides)) return 'Välj sida om livet.';
  if (!['start', 'end'].includes(s.referenceEnd)) return 'Välj referensände.';
  for (const [key, min, max] of [
    ['thickness', 1, 1000],
    ['gap', 0, 1000],
    ['cornerRelief', 0, 1000],
    ['distance', 0, 1e7],
  ])
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
      return 'Ange giltiga mått för avstyvningen.';
  return '';
}
const area = (points) =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function clean(points) {
  const result = [];
  for (const p of points)
    if (!result.length || Math.hypot(p[0] - result.at(-1)[0], p[1] - result.at(-1)[1]) > 1e-6)
      result.push(p);
  if (
    result.length > 1 &&
    Math.hypot(result[0][0] - result.at(-1)[0], result[0][1] - result.at(-1)[1]) < 1e-6
  )
    result.pop();
  return result;
}
function clip(points, signedDistance) {
  const result = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length],
      a = signedDistance(p),
      b = signedDistance(q);
    if (a >= -1e-8) result.push(p);
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b);
      result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  });
  return clean(result);
}
/** The open pocket closes between the inner flange tips. Its web/flange contour is taken from the saved profile, including radii and taper. */
function pocket(loop, sign, tipRadius = 0) {
  const points = loop.map(([x, y]) => [sign * x, y]);
  const outer = Math.max(...points.map((p) => p[0])),
    minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const tips = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => Math.abs(p[0] - outer) < 1e-6 && p[1] > minY + 1e-6 && p[1] < maxY - 1e-6)
    .sort((a, b) => a.p[1] - b.p[1]);
  if (tips.length < 2) throw new Error('Profilen saknar en öppen ficka mellan flänsarna.');
  const paths = [1, -1].map((step) => {
    const result = [];
    let i = tips[0].i;
    for (let n = 0; n <= points.length; n++) {
      result.push(points[i]);
      if (i === tips.at(-1).i) break;
      i = (i + step + points.length) % points.length;
    }
    return result;
  });
  let polygon = paths.find((path) =>
    path.every((p) => p[1] >= tips[0].p[1] - 1e-6 && p[1] <= tips.at(-1).p[1] + 1e-6),
  );
  if (!polygon) throw new Error('Profilens innerkontur stöds inte för avstyvning.');
  polygon = clean(polygon);
  if (area(polygon) < 0) polygon.reverse();
  // Rolled U flange toes round towards the pocket. End the plate before that radius, retaining the sloping inner flange and web roots.
  if (tipRadius > 0) polygon = clip(polygon, (p) => outer - tipRadius - p[0]);
  return polygon;
}
function plateContour(polygon, gap, relief) {
  const xs = polygon.map((p) => p[0]),
    ys = polygon.map((p) => p[1]);
  let result = [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
    [Math.min(...xs), Math.max(...ys)],
  ];
  for (let i = 0; i < polygon.length && result.length >= 3; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    result = clip(result, (p) => cross(a, b, p) - gap * length);
  }
  if (relief > 0 && result.length >= 3) {
    const x = Math.min(...result.map((p) => p[0])),
      y = Math.min(...result.map((p) => p[1])),
      top = Math.max(...result.map((p) => p[1]));
    result = clip(result, (p) => p[0] + p[1] - x - y - relief);
    result = clip(result, (p) => p[0] - p[1] - x + top - relief);
  }
  // Chords across tiny arc edges stay inside a convex pocket and avoid unmanufacturable sub-mm edges.
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    for (let i = 0; i < result.length; i++) {
      const p = result[i],
        q = result[(i + 1) % result.length];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.001) {
        result.splice((i + 1) % result.length, 1);
        changed = true;
        break;
      }
    }
  }
  return result;
}
export function stiffenerDistance(member, point) {
  const frame = sweepFrame(member);
  return new THREE.Vector3(...point).sub(frame.start).dot(frame.axis);
}
export function resolveStiffener(s, model) {
  const error = validateStiffener(s);
  if (error) throw new Error(error);
  const member = model.find((o) => o.id === s.references[0]);
  if (!member || (member.type ?? 'sweep') !== 'sweep' || member.generatedBy)
    throw new Error('Avstyvningen saknar sin balk eller pelare.');
  const profileType = member.profile === 'custom' ? member.section?.profileType : member.profile;
  if (!['h', 'i', 'u'].includes(profileType)) throw new Error('Välj en H-, I- eller U-profil.');
  const loops = contours(member);
  if (loops.length !== 1) throw new Error('Avstyvning stöder öppna H-, I- och U-profiler.');
  const frame = sweepFrame(member),
    length = frame.start.distanceTo(frame.end);
  const station = s.referenceEnd === 'end' ? length - s.distance : s.distance;
  if (station < s.thickness / 2 - 1e-6 || station > length - s.thickness / 2 + 1e-6)
    throw new Error('Hela avstyvningsplåten måste ligga inom balkens eller pelarens längd.');
  const origin = frame.start.clone().addScaledVector(frame.axis, station);
  const [ax, ay] = profileAnchor(member);
  const signs =
    profileType === 'u' ? [1] : s.sides === 'both' ? [1, -1] : [s.sides === 'positive' ? 1 : -1];
  const plates = signs.map((sign) => ({
    sign,
    polygon: plateContour(
      pocket(loops[0], sign, profileType === 'u' ? member.section?.parameters?.Rf || 0 : 0),
      s.gap,
      s.cornerRelief,
    ).map(([x, y]) => [sign * x - ax, y - ay]),
  }));
  const result = {
    ...s,
    profileType,
    targets: [member.id],
    cuts: [],
    position: origin.toArray(),
    frame: { origin: origin.toArray(), u: frame.x.toArray(), v: frame.y.toArray() },
    plates,
  };
  stiffenerMembers(result, model);
  return result;
}
export function stiffenerMembers(s, model) {
  if (!s.id) throw new Error('Avstyvningen behöver en identitet.');
  const source = model.find((o) => o.id === s.references[0]);
  return s.plates.map(({ sign, polygon }) => {
    const id = `${s.id}:plate:${sign > 0 ? 'positive' : 'negative'}`;
    const old = model.find((o) => o.id === id && o.generatedBy === s.id);
    const result = {
      id,
      type: 'plate',
      name: 'Avstyvningsplåt',
      generatedBy: s.id,
      componentRole: 'plate',
      frame: structuredClone(s.frame),
      polygon: structuredClone(polygon),
      thickness: s.thickness,
      side: 'center',
      ...(source.material ? { material: structuredClone(source.material) } : {}),
    };
    for (const key of ['name', 'prefix', 'number']) if (old?.[key] != null) result[key] = old[key];
    const error = validatePlate(result);
    if (error)
      throw new Error(
        `Plåten ryms inte mellan liv och flänsar. Minska spalt eller hörnurtag. ${error}`,
      );
    return old && JSON.stringify(old) === JSON.stringify(result) ? old : result;
  });
}
