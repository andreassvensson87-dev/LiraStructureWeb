/** Detached values only: adapters explicitly whitelist properties, never object identities. */
export function propertyValues(source, fields, selected = fields.map((field) => field.key)) {
  const allowed = new Map(fields.map((field) => [field.key, field]));
  const values = {};
  for (const key of selected) {
    const field = allowed.get(key);
    if (!field) throw Error('Okänd egenskap.');
    values[key] = Object.fromEntries(
      field.keys.map((name) => [name, structuredClone(source[name])]),
    );
  }
  return values;
}
export function commonPropertyValues(sources, fields) {
  if (!sources.length) return {};
  const snapshots = sources.map((source) => propertyValues(source, fields));
  return Object.fromEntries(
    Object.entries(snapshots[0]).filter(([key, value]) =>
      snapshots.every((snapshot) => JSON.stringify(snapshot[key]) === JSON.stringify(value)),
    ),
  );
}
export function applyPropertyValues(target, values, fields, selected = Object.keys(values)) {
  const next = structuredClone(target);
  const allowed = new Map(fields.map((field) => [field.key, field]));
  let count = 0;
  for (const key of selected) {
    const field = allowed.get(key);
    if (!field || !Object.hasOwn(values, key)) continue;
    for (const name of field.keys) {
      if (values[key][name] === undefined) delete next[name];
      else next[name] = structuredClone(values[key][name]);
    }
    count++;
  }
  if (!count) throw Error('Inga kompatibla egenskaper.');
  return next;
}
export const propertyField = (key, label, ...keys) => ({
  key,
  label,
  keys: keys.length ? keys : [key],
});
