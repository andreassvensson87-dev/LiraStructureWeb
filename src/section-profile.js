import { expression } from './section-expression.js';
export { expression } from './section-expression.js';
import { contourDefinition, evaluateProfileContours } from './section-contours.js';
import { validateTemplate } from './section-templates.js';
import { validatePlate } from './plate.js';
export const LIBRARY_KEY = 'lirastructure.sections.v1';
export function parameterValues(parameters) {
  const values = Object.create(null),
    definitions = new Map(),
    visiting = new Set();
  if (parameters.length > 64) throw new Error('Högst 64 parametrar.');
  for (const p of parameters) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p.name) || definitions.has(p.name))
      throw new Error('Parameternamn måste vara unika, exempelvis B eller tf.');
    definitions.set(p.name, p.value);
  }
  const resolve = (name) => {
    if (Object.hasOwn(values, name)) return values[name];
    if (!definitions.has(name)) throw new Error(`Okänd parameter: ${name}`);
    if (visiting.has(name)) throw new Error(`Cirkulärt samband: ${name}`);
    visiting.add(name);
    values[name] = expression(definitions.get(name), resolve);
    visiting.delete(name);
    return values[name];
  };
  for (const name of definitions.keys()) resolve(name);
  return values;
}
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function onSegment(a, b, p) {
  return (
    Math.abs(cross(a, b, p)) < 1e-7 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-7 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-7 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-7 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-7
  );
}
function hit(a, b, c, d) {
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
function inside(p, loop) {
  let yes = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i],
      b = loop[j];
    if (onSegment(a, b, p)) return false;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
export function validateContours(loops) {
  if (!Array.isArray(loops) || !loops.length || loops.length > 32)
    throw new Error('Rita en ytterkontur och högst 31 hål.');
  if (loops.flat().length > 1000) throw new Error('Högst 1 000 hörn per profil.');
  for (const loop of loops) {
    // Profile arcs can have sub-millimetre tessellation; overall section size
    // is validated separately. Still reject coincident edges and intersections.
    const error = validatePlate(
      {
        frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
        polygon: loop,
        thickness: 1,
        side: 'center',
      },
      { minEdgeLength: 1e-5 },
    );
    if (error) throw new Error(error.replace('Plate', 'kontur'));
    if (loop.flat().some((v) => Math.abs(v) > 10000))
      throw new Error('Profilens koordinater måste ligga inom ±10 000 mm.');
  }
  for (let i = 1; i < loops.length; i++) {
    if (!loops[i].every((p) => inside(p, loops[0])))
      throw new Error('Hål måste ligga helt inom ytterkonturen.');
    for (let j = 0; j < i; j++) {
      for (let a = 0; a < loops[i].length; a++)
        for (let b = 0; b < loops[j].length; b++)
          if (
            hit(
              loops[i][a],
              loops[i][(a + 1) % loops[i].length],
              loops[j][b],
              loops[j][(b + 1) % loops[j].length],
            )
          )
            throw new Error('Konturer får inte korsa eller beröra varandra.');
      if (j && (inside(loops[i][0], loops[j]) || inside(loops[j][0], loops[i])))
        throw new Error('Hål får inte överlappa eller ligga i varandra.');
    }
  }
  return loops;
}
export function sectionProperties(loops, density = 7850) {
  let A = 0,
    Sx = 0,
    Sy = 0,
    Ix = 0,
    Iy = 0,
    Ixy = 0;
  loops.forEach((loop, k) => {
    let area2 = 0;
    loop.forEach((a, i) => {
      const b = loop[(i + 1) % loop.length];
      area2 += a[0] * b[1] - b[0] * a[1];
    });
    const sign = (area2 < 0 ? -1 : 1) * (k ? -1 : 1);
    loop.forEach((a, i) => {
      const b = loop[(i + 1) % loop.length],
        c = (a[0] * b[1] - b[0] * a[1]) * sign;
      A += c / 2;
      Sx += ((a[0] + b[0]) * c) / 6;
      Sy += ((a[1] + b[1]) * c) / 6;
      Ix += ((a[1] ** 2 + a[1] * b[1] + b[1] ** 2) * c) / 12;
      Iy += ((a[0] ** 2 + a[0] * b[0] + b[0] ** 2) * c) / 12;
      Ixy += ((2 * a[0] * a[1] + a[0] * b[1] + b[0] * a[1] + 2 * b[0] * b[1]) * c) / 24;
    });
  });
  if (A <= 0) throw new Error('Profilens area måste vara positiv.');
  const cx = Sx / A,
    cy = Sy / A;
  Ix -= A * cy ** 2;
  Iy -= A * cx ** 2;
  Ixy -= A * cx * cy;
  const points = loops[0],
    minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0])),
    minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  return {
    A,
    cx,
    cy,
    Ix,
    Iy,
    Ixy,
    WxPlus: Ix / (maxY - cy),
    WxMinus: Ix / (cy - minY),
    WyPlus: Iy / (maxX - cx),
    WyMinus: Iy / (cx - minX),
    massPerMeter: A * 1e-6 * density,
    bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
  };
}
export function evaluateSection(definition) {
  if (
    !definition ||
    typeof definition.name !== 'string' ||
    !definition.name.trim() ||
    definition.name.length > 120
  )
    throw new Error('Ange ett profilnamn (högst 120 tecken).');
  const parameters = parameterValues(definition.parameters || []),
    resolve = (name) => {
      if (!Object.hasOwn(parameters, name)) throw new Error(`Okänd parameter: ${name}`);
      return parameters[name];
    };
  validateTemplate(definition, parameters);
  const loops = validateContours(
    evaluateProfileContours(contourDefinition(definition), parameters),
  );
  const density = Number(definition.density ?? 7850);
  if (!Number.isFinite(density) || density < 0 || density > 30000)
    throw new Error('Densiteten måste vara 0–30 000 kg/m³.');
  const anchor = (definition.anchor ?? [0, 0]).map((v) => expression(v, resolve));
  if (anchor.length !== 2 || anchor.some((v) => Math.abs(v) > 10000))
    throw new Error('Ogiltig insättningspunkt.');
  for (const [key, value] of Object.entries(definition.catalog || {}))
    if (
      ![
        'A',
        'Ix',
        'Iy',
        'Wx',
        'Wy',
        'WxPlus',
        'WxMinus',
        'WyPlus',
        'WyMinus',
        'cx',
        'cy',
        'J',
        'massPerMeter',
      ].includes(key) ||
      !Number.isFinite(value) ||
      (!['cx', 'cy'].includes(key) && value < 0)
    )
      throw new Error('Ogiltiga katalogvärden: tvärsnittsegenskaper ska vara positiva tal.');
  const properties = sectionProperties(loops, density);
  if (
    properties.bounds.width < 1 ||
    properties.bounds.height < 1 ||
    properties.bounds.width > 10000 ||
    properties.bounds.height > 10000
  )
    throw new Error('Profilens bredd och höjd måste vara 1–10 000 mm.');
  return { loops, anchor, parameters, properties };
}
export function profileSnapshot(definition) {
  const evaluated = evaluateSection(definition);
  const contour = contourDefinition(definition);
  if (contour.radiusParameters.length)
    validateContours(evaluateProfileContours(contour, evaluated.parameters, 'schematic'));
  return {
    id: definition.id,
    revision: definition.revision,
    name: definition.name,
    family: definition.family || '',
    profileType: definition.profileType || 'custom',
    standard: definition.standard || '',
    source: definition.source || '',
    density: definition.density ?? 7850,
    catalog: structuredClone(definition.catalog || {}),
    ...evaluated,
    ...(contour.radiusParameters.length ? { contourDefinition: contour } : {}),
  };
}
/** Verify the embedded definition and physical contour remain consistent on import. */
export function validateProfileSnapshotContours(section) {
  validateContours(section.loops);
  if (section.contourDefinition) {
    const exact = validateContours(
      evaluateProfileContours(section.contourDefinition, section.parameters),
    );
    const schematic = validateContours(
      evaluateProfileContours(section.contourDefinition, section.parameters, 'schematic'),
    );
    if (
      exact.length !== section.loops.length ||
      exact.some(
        (loop, i) =>
          loop.length !== section.loops[i].length ||
          loop.some((point, j) =>
            point.some((value, k) => Math.abs(value - section.loops[i][j][k]) > 1e-7),
          ),
      )
    )
      throw new Error('Profilkonturen stämmer inte med profilens parametrar.');
    return schematic;
  }
  if (section.schematicLoops) validateContours(section.schematicLoops);
  return null;
}
export function validateLibrary(data) {
  if (data?.schema !== 1 || !Array.isArray(data.profiles) || data.profiles.length > 5000)
    throw new Error('Ogiltig biblioteksfil (schema 1, högst 5 000 versioner).');
  const seen = new Set();
  for (const s of data.profiles) {
    if (
      typeof s.id !== 'string' ||
      !s.id ||
      s.id.length > 100 ||
      !Number.isInteger(s.revision) ||
      s.revision < 1 ||
      seen.has(`${s.id}:${s.revision}`)
    )
      throw new Error('Ogiltig eller duplicerad profilversion.');
    seen.add(`${s.id}:${s.revision}`);
    evaluateSection(s);
  }
  return structuredClone(data.profiles);
}
export function mergeLibrary(existing, incoming) {
  const result = structuredClone(existing);
  for (const s of incoming) {
    const old = result.find((p) => p.id === s.id && p.revision === s.revision);
    if (old && JSON.stringify(old) !== JSON.stringify(s))
      throw new Error(`Konflikt: ${s.name}, version ${s.revision}.`);
    if (!old) result.push(s);
  }
  validateLibrary({ schema: 1, profiles: result });
  return result;
}
