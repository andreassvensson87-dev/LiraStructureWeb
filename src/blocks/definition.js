import { expression } from '../section-expression.js';

const fail = (message) => {
  throw Error(message);
};
const list = (value, limit, label) => {
  if (!Array.isArray(value) || value.length > limit) fail(`Ogiltig ${label}.`);
  return value;
};
const identity = (value) => typeof value === 'string' && value.length > 0 && value.length <= 200;
export function blockValues(parameters, overrides = {}) {
  list(parameters, 64, 'parameterlista');
  const definitions = new Map(),
    values = Object.create(null),
    visiting = new Set();
  for (const parameter of parameters) {
    if (
      !parameter ||
      [parameter.min, parameter.max].some((v) => v != null && !Number.isFinite(v)) ||
      (parameter.min != null && parameter.max != null && parameter.min > parameter.max)
    )
      fail('Ogiltiga parametergränser.');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parameter.name) || definitions.has(parameter.name))
      fail('Parameternamn ska vara unika, exempelvis B och H.');
    if (!['mm', '°', ''].includes(parameter.unit)) fail('Ogiltig parameterenhet.');
    definitions.set(parameter.name, parameter);
  }
  for (const key of Object.keys(overrides))
    if (!definitions.has(key)) fail(`Okänd parameter: ${key}`);
  const resolve = (name) => {
    if (Object.hasOwn(values, name)) return values[name];
    const parameter = definitions.get(name);
    if (!parameter) fail(`Okänd parameter: ${name}`);
    if (visiting.has(name)) fail(`Cirkulärt samband: ${name}`);
    visiting.add(name);
    const value = expression(
      Object.hasOwn(overrides, name) ? overrides[name] : parameter.value,
      resolve,
    );
    if (
      Math.abs(value) > 1e7 ||
      (parameter.min != null && value < parameter.min) ||
      (parameter.max != null && value > parameter.max)
    )
      fail(`${name} ligger utanför tillåtna gränser.`);
    values[name] = value;
    visiting.delete(name);
    return value;
  };
  for (const name of definitions.keys()) resolve(name);
  return values;
}
export function evaluateBlock(definition, overrides = {}) {
  if (
    !definition ||
    definition.schema !== 1 ||
    ![2, 3].includes(definition.dimension) ||
    !identity(definition.id) ||
    !identity(definition.name) ||
    !Number.isInteger(definition.revision) ||
    definition.revision < 1
  )
    fail('Ogiltig blockdefinition.');
  const values = blockValues(definition.parameters, overrides);
  const read = (value) =>
    expression(value, (name) => {
      if (!Object.hasOwn(values, name)) fail(`Okänd parameter: ${name}`);
      return values[name];
    });
  const references = new Map();
  for (const reference of list(definition.references, 128, 'referenslista')) {
    if (
      !identity(reference.id) ||
      references.has(reference.id) ||
      !identity(reference.name) ||
      !Number.isInteger(reference.axis) ||
      reference.axis < 0 ||
      reference.axis >= definition.dimension
    )
      fail('Ogiltig referens.');
    references.set(reference.id, { ...reference, coordinate: read(reference.value) });
    if (Math.abs(references.get(reference.id).coordinate) > 1e7)
      fail('Referensen ligger utanför tillåtna koordinater.');
  }
  const members = structuredClone(list(definition.members, 256, 'objektlista'));
  const anchors = structuredClone(list(definition.anchors, 16, 'insättningspunktslista'));
  if (!members.length || !anchors.length) fail('Blocket behöver geometri och en insättningspunkt.');
  const points = new Map();
  for (const member of members) {
    if (member.properties !== undefined)
      fail('Egenskaper ska styras av blockets egenskapskopplingar.');
    if (!identity(member.id) || points.has(member.id))
      fail('Blockobjekten behöver unika identiteter.');
    points.set(member.id, list(member.points, 1000, 'punktlista'));
  }
  for (const anchor of anchors) {
    if (!identity(anchor.id) || !identity(anchor.name) || points.has(anchor.id))
      fail('Insättningspunkterna behöver unika identiteter.');
    points.set(anchor.id, [anchor.point]);
  }
  for (const entries of points.values())
    for (const point of entries)
      if (
        !Array.isArray(point) ||
        point.length !== definition.dimension ||
        point.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e7)
      )
        fail('Ogiltiga blockpunkter.');
  const occupied = new Set();
  for (const binding of list(definition.bindings, 3000, 'låsningslista')) {
    const reference = references.get(binding.referenceId),
      point = points.get(binding.memberId)?.[binding.pointIndex];
    if (!reference || !point || !Number.isInteger(binding.pointIndex))
      fail('Låsningen saknar punkt eller referens.');
    const key = `${binding.memberId}:${binding.pointIndex}:${reference.axis}`;
    if (occupied.has(key)) fail('Punkten har flera låsningar i samma riktning.');
    occupied.add(key);
    point[reference.axis] = reference.coordinate + read(binding.offset);
  }
  for (const property of list(definition.properties, 512, 'egenskapslista')) {
    const member = members.find((entry) => entry.id === property.memberId);
    if (!member || property.key !== 'thickness') fail('Ogiltig egenskapskoppling.');
    member.properties ||= {};
    if (Object.hasOwn(member.properties, property.key)) fail('Egenskapen har flera kopplingar.');
    member.properties[property.key] = read(property.value);
  }
  for (const entries of points.values())
    for (const point of entries)
      if (point.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e7))
        fail('Blockpunkten ligger utanför tillåtna koordinater.');
  return { members, anchors, references: [...references.values()], values };
}
export function createBlockDefinition({ name, dimension, members, id = crypto.randomUUID() }) {
  if (![2, 3].includes(dimension) || !members?.length) fail('Välj objekt att skapa blocket av.');
  const points = members.flatMap((member) => member.points),
    base = Array.from({ length: dimension }, (_, axis) =>
      Math.min(...points.map((point) => point[axis])),
    );
  const extent = base.map((value, axis) => Math.max(...points.map((point) => point[axis])) - value);
  const bindings = members.flatMap((member) =>
    member.points.flatMap((point, pointIndex) =>
      point.flatMap((value, axis) =>
        extent[axis] > 1e-7 &&
        (Math.abs(value - base[axis]) < 1e-7 || Math.abs(value - base[axis] - extent[axis]) < 1e-7)
          ? [
              {
                memberId: member.id,
                pointIndex,
                referenceId: `${Math.abs(value - base[axis]) < 1e-7 ? 'base' : 'end'}-${axis}`,
                offset: '0',
              },
            ]
          : [],
      ),
    ),
  );
  bindings.push(
    ...base.map((_, axis) => ({
      memberId: 'P1',
      pointIndex: 0,
      referenceId: `base-${axis}`,
      offset: '0',
    })),
  );
  return {
    schema: 1,
    id,
    revision: 1,
    name,
    dimension,
    parameters: extent.map((value, axis) => ({
      name: ['B', 'D', 'H'][dimension === 2 && axis === 1 ? 2 : axis],
      value: Math.max(value, 1),
      unit: 'mm',
      min: 1,
    })),
    references: base.flatMap((value, axis) => [
      {
        id: `base-${axis}`,
        name: ['Vänster', 'Fram', 'Bas'][dimension === 2 && axis === 1 ? 2 : axis],
        axis,
        value: String(value),
      },
      {
        id: `end-${axis}`,
        name: ['Höger', 'Bak', 'Överkant'][dimension === 2 && axis === 1 ? 2 : axis],
        axis,
        value: `${value}+${['B', 'D', 'H'][dimension === 2 && axis === 1 ? 2 : axis]}`,
      },
    ]),
    anchors: [{ id: 'P1', name: 'Insättning', point: base }],
    members: structuredClone(members),
    bindings,
    properties: [],
    units: 'model',
  };
}
export function renameBlockParameter(definition, oldName, newName) {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(newName) ||
    definition.parameters.some((p) => p.name === newName && p.name !== oldName)
  )
    fail('Välj ett unikt parameternamn, exempelvis B och H.');
  const token = new RegExp(`\\b${oldName}\\b`, 'g');
  for (const parameter of definition.parameters) {
    if (parameter.name === oldName) parameter.name = newName;
    parameter.value = String(parameter.value).replace(token, newName);
  }
  for (const reference of definition.references)
    reference.value = String(reference.value).replace(token, newName);
  for (const binding of definition.bindings)
    binding.offset = String(binding.offset).replace(token, newName);
  for (const property of definition.properties)
    property.value = String(property.value).replace(token, newName);
}
