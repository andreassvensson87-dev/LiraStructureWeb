import * as THREE from 'three';
import { IFCBEAM, IFCCOLUMN, IFCMEMBER, IFCPLATE, IFCBUILDINGELEMENTPROXY } from 'web-ifc';
import { sweepFrame, validateSweep } from '../sweep.js';
import { validatePlate } from '../plate.js';
import { sectionProperties, validateContours } from '../section-profile.js';
import { nextIdentity } from '../object-identity.js';
import { matchHeaProfile } from './hea-profile.js';
const tolerance = 0.02;
const pointKey = (p) => p.map((v) => Math.round(v / tolerance)).join(',');
const edgeKey = (a, b) => [a, b].sort().join('|');
const area = (loop) =>
  Math.abs(
    loop.reduce((sum, p, i) => {
      const q = loop[(i + 1) % loop.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2,
  );

// Accept closed, straight prisms only. Never substitute a bounding box for the source solid.
export function extrusionFromMesh(mesh, kind = 'sweep') {
  mesh.updateWorldMatrix(true, false);
  const attribute = mesh.geometry.getAttribute('position'),
    points = [];
  if (!attribute || attribute.count > 20000)
    throw Error('Geometrin är för komplex för säker konvertering.');
  for (let i = 0; i < attribute.count; i++)
    points.push(
      new THREE.Vector3().fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld),
    );
  const origin = points[0]?.clone();
  if (!origin || points.some((p) => !p.toArray().every(Number.isFinite)))
    throw Error('Ogiltig IFC-geometri.');
  points.forEach((p) => p.sub(origin));
  const ids = mesh.geometry.index ? Array.from(mesh.geometry.index.array) : points.map((_, i) => i);
  const triangles = [],
    axes = [],
    topology = new Map();
  let volume = 0;
  for (let i = 0; i < ids.length; i += 3) {
    const vertices = ids.slice(i, i + 3).map((id) => points[id]);
    if (vertices.length !== 3 || vertices.some((p) => !p)) throw Error('Ogiltigt triangelnät.');
    const [a, b, c] = vertices,
      normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.length() < 1e-8) continue;
    volume += a.dot(b.clone().cross(c)) / 6;
    normal.normalize();
    if (!axes.some((axis) => Math.abs(axis.dot(normal)) > 1 - 1e-7)) axes.push(normal.clone());
    if (axes.length > 64) throw Error('Geometrin är för komplex för säker konvertering.');
    triangles.push({ vertices, normal });
    const keys = vertices.map((p) => pointKey(p.toArray()));
    for (let j = 0; j < 3; j++) {
      const key = edgeKey(keys[j], keys[(j + 1) % 3]);
      topology.set(key, (topology.get(key) || 0) + 1);
    }
  }
  if (!triangles.length || [...topology.values()].some((count) => count !== 2))
    throw Error('IFC-objektet är inte en sluten solid.');
  const candidates = [];
  for (const candidate of axes) {
    // Long side edges provide a more stable extrusion direction than Float32 cap normals.
    let axis = candidate,
      longest = 0;
    for (const { vertices } of triangles)
      for (let i = 0; i < 3; i++) {
        const edge = vertices[(i + 1) % 3].clone().sub(vertices[i]),
          length = edge.length();
        if (length > longest && Math.abs(edge.clone().normalize().dot(candidate)) > 1 - 1e-7) {
          longest = length;
          axis = edge.normalize();
        }
      }
    const levels = points.map((p) => p.dot(axis)),
      min = Math.min(...levels),
      max = Math.max(...levels),
      depth = max - min;
    if (depth < 1 || levels.some((v) => Math.min(Math.abs(v - min), Math.abs(v - max)) > tolerance))
      continue;
    const { x, y } = sweepFrame({ start: [0, 0, 0], end: axis.toArray(), rotation: 0 });
    const caps = [new Map(), new Map()],
      coordinates = new Map();
    let valid = true;
    for (const { vertices, normal } of triangles) {
      const cap = vertices.every((p) => Math.abs(p.dot(axis) - min) <= tolerance)
        ? 0
        : vertices.every((p) => Math.abs(p.dot(axis) - max) <= tolerance)
          ? 1
          : -1;
      if (cap < 0) {
        if (Math.abs(normal.dot(axis)) > 1e-5) valid = false;
        continue;
      }
      const keys = vertices.map((p) => {
        const uv = [p.dot(x), p.dot(y)];
        const [u, v] = uv.map((value) => Math.round(value / tolerance));
        for (let du = -1; du <= 1; du++)
          for (let dv = -1; dv <= 1; dv++) {
            const key = `${u + du},${v + dv}`,
              previous = coordinates.get(key);
            if (previous && Math.hypot(previous[0] - uv[0], previous[1] - uv[1]) <= tolerance)
              return key;
          }
        const key = pointKey(uv);
        coordinates.set(key, uv);
        return key;
      });
      for (let j = 0; j < 3; j++) {
        const key = edgeKey(keys[j], keys[(j + 1) % 3]);
        const entry = caps[cap].get(key) || { count: 0, ends: [keys[j], keys[(j + 1) % 3]] };
        entry.count++;
        caps[cap].set(key, entry);
      }
    }
    const boundary = caps.map((cap) => [...cap].filter(([, e]) => e.count === 1));
    if (
      !valid ||
      !boundary[0].length ||
      boundary[0]
        .map(([key]) => key)
        .sort()
        .join(';') !==
        boundary[1]
          .map(([key]) => key)
          .sort()
          .join(';')
    )
      continue;
    const neighbours = new Map();
    for (const [
      ,
      {
        ends: [a, b],
      },
    ] of boundary[0]) {
      for (const [p, q] of [
        [a, b],
        [b, a],
      ]) {
        if (!neighbours.has(p)) neighbours.set(p, []);
        neighbours.get(p).push(q);
      }
    }
    if ([...neighbours.values()].some((list) => list.length !== 2)) continue;
    const unseen = new Set(neighbours.keys()),
      loops = [];
    while (unseen.size) {
      const first = unseen.values().next().value,
        loop = [];
      let current = first,
        previous = null;
      do {
        if (!unseen.delete(current)) {
          valid = false;
          break;
        }
        loop.push(coordinates.get(current));
        const next = neighbours.get(current).find((p) => p !== previous);
        previous = current;
        current = next;
      } while (current !== first);
      loops.push(loop);
      if (!valid) break;
    }
    loops.sort((a, b) => area(b) - area(a));
    try {
      if (!valid) continue;
      validateContours(loops);
      const properties = sectionProperties(loops);
      if (Math.abs(Math.abs(volume) - properties.A * depth) > properties.A * depth * 1e-4) continue;
      candidates.push({ axis, x, y, min, depth, loops, properties, origin });
    } catch {
      /* Other orientations may still produce a valid extrusion. */
    }
  }
  candidates.sort((a, b) => (kind === 'plate' ? a.depth - b.depth : b.depth - a.depth));
  const result = candidates[0];
  if (!result)
    throw Error(
      'Kräver en rak extrusion med konstant tvärsnitt; kapningar och böjda former stöds inte ännu.',
    );
  if (kind === 'plate' && result.loops.length !== 1)
    throw Error('Plate med genomgående hål stöds inte ännu.');
  return result;
}
export function convertReferencePart(part, model, kind) {
  const { axis, x, y, min, depth, loops, properties, origin } = extrusionFromMesh(part.mesh, kind);
  const center = origin
    .clone()
    .addScaledVector(x, properties.cx)
    .addScaledVector(y, properties.cy)
    .addScaledVector(axis, min);
  const base = {
    name: part.mesh.userData.name || model.title,
    ifcSource: {
      fileName: model.fileName,
      globalId: part.mesh.userData.globalId,
      expressId: part.mesh.userData.ifcId,
    },
  };
  let object;
  if (kind === 'plate')
    object = {
      ...base,
      type: 'plate',
      frame: {
        origin: center.addScaledVector(axis, depth / 2).toArray(),
        u: x.toArray(),
        v: y.toArray(),
      },
      polygon: loops[0].map(([u, v]) => [u - properties.cx, v - properties.cy]),
      thickness: depth,
      side: 'center',
    };
  else
    object = {
      ...base,
      type: 'sweep',
      profile: 'custom',
      section: {
        id: `ifc-profile:${part.mesh.userData.globalId || model.fileName + ':' + part.mesh.userData.ifcId}`,
        revision: 1,
        name: base.name + ' · IFC-profil',
        family: 'IFC',
        profileType: 'custom',
        source: model.fileName,
        loops,
        properties,
        anchor: [properties.cx, properties.cy],
      },
      width: properties.bounds.width,
      height: properties.bounds.height,
      thickness: 0,
      rotation: 0,
      start: center.toArray(),
      end: center.clone().addScaledVector(axis, depth).toArray(),
    };
  if (kind === 'sweep') {
    const match = matchHeaProfile(loops, properties);
    if (match) {
      object.section = match.section;
      object.rotation = match.rotation;
      object.width = match.section.properties.bounds.width;
      object.height = match.section.properties.bounds.height;
    }
  }
  const error = kind === 'plate' ? validatePlate(object) : validateSweep(object);
  if (error) throw Error(error);
  return object;
}
const sourceKey = (s) => s.globalId || `${s.fileName}:${s.expressId}`;
export function planReferenceConversion(model, objects, selectedIds = null) {
  const groups = new Map(),
    existing = new Set(objects.filter((o) => o.ifcSource).map((o) => sourceKey(o.ifcSource)));
  for (const part of model.parts) {
    const id = part.mesh.userData.ifcId;
    if (selectedIds && !selectedIds.includes(id)) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(part);
  }
  return [...groups].map(([id, parts]) => {
    const part = parts[0],
      data = part.mesh.userData,
      row = { id, name: data.name || `IFC #${id}`, object: null, reason: '' };
    try {
      if (
        existing.has(
          sourceKey({ fileName: model.fileName, globalId: data.globalId, expressId: id }),
        )
      )
        throw Error('Redan konverterat.');
      if (parts.length !== 1) throw Error('Objekt med flera geometridelar stöds inte ännu.');
      const kind =
        data.ifcType === IFCPLATE
          ? 'plate'
          : [IFCBEAM, IFCCOLUMN, IFCMEMBER, IFCBUILDINGELEMENTPROXY].includes(data.ifcType)
            ? 'sweep'
            : null;
      if (!kind) throw Error('Den här IFC-objekttypen stöds inte ännu.');
      row.object = convertReferencePart(part, model, kind);
    } catch (error) {
      row.reason = error.message;
    }
    return row;
  });
}
export function conversionObjects(rows, objects, createId = () => crypto.randomUUID()) {
  const next = [...objects],
    added = [];
  for (const row of rows) {
    if (!row.object) continue;
    if (next.some((o) => o.ifcSource && sourceKey(o.ifcSource) === sourceKey(row.object.ifcSource)))
      throw Error('Ett valt IFC-objekt är redan konverterat. Öppna förhandsgranskningen igen.');
    const object = structuredClone(row.object);
    object.id = createId();
    object.prefix = object.type === 'plate' ? 'P' : 'B';
    Object.assign(object, nextIdentity(object, next));
    next.push(object);
    added.push(object);
  }
  return added;
}
