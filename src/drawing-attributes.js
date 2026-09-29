export const ATTRIBUTE_KEY = 'lirastructure.drawing-attributes.v1';
export const builtInAttributes = [
  ['project.name', 'Projektnamn', 'all', false],
  ['project.number', 'Projektnummer', 'all', false],
  ['project.client', 'Beställare', 'all', false],
  ['drawing.number', 'Ritningsnummer', 'all', true],
  ['drawing.name', 'Ritningsnamn', 'all', true],
  ['drawing.type', 'Ritningstyp', 'all', false],
  ['drawing.revision', 'Revision', 'all', true],
  ['drawing.date', 'Datum', 'all', true, 'date'],
  ['drawing.drawnBy', 'Ritad av', 'all', true],
  ['drawing.checkedBy', 'Granskad av', 'all', true],
  ['drawing.issueStatus', 'Utgivningsstatus', 'all', true],
  ['drawing.partMark', 'Part mark', 'SP', false],
  ['drawing.material', 'Material', 'SP', false],
  ['drawing.quantity', 'Antal', 'SP', false, 'number'],
  ['drawing.level', 'Nivå', 'GA', false],
].map(([key, name, scope, editable, dataType = 'text']) => ({
  key,
  name,
  scope,
  editable,
  dataType,
}));
export function customAttributes() {
  try {
    const items = JSON.parse(localStorage.getItem(ATTRIBUTE_KEY) || '[]');
    return Array.isArray(items)
      ? items
          .filter(
            (a) =>
              typeof a?.key === 'string' &&
              a.key.startsWith('custom.') &&
              typeof a.name === 'string',
          )
          .map((a) => ({
            ...a,
            scope: ['GA', 'SP'].includes(a.scope) ? a.scope : 'all',
            dataType: ['date', 'number'].includes(a.dataType) ? a.dataType : 'text',
            editable: true,
          }))
      : [];
  } catch {
    return [];
  }
}
export const drawingAttributes = () => [...builtInAttributes, ...customAttributes()];
export const attributeApplies = (a, type) =>
  !a.scope || a.scope === 'all' || !type || a.scope === type;
export function attributeValue(key, context) {
  const definition = drawingAttributes().find((a) => a.key === key);
  if (definition && !attributeApplies(definition, context.drawing?.type)) return '';
  const [group, field] = key.split('.');
  const value =
    group === 'drawing' && field === 'partMark'
      ? (context.drawing?.partMark ?? context.drawing?.mark)
      : context[group]?.[field];
  return String(value ?? '');
}
export function drawingAttributeContext(record, state = {}) {
  const source = state.objects?.find((o) => o.id === record.sourceId);
  const assignments = state.parts?.assignments || {};
  const quantity = state.objects?.filter(
    (o) => record.partKey && assignments[o.id]?.key === record.partKey,
  ).length;
  return {
    project: state.info || state.project || {},
    drawing: {
      ...record,
      partMark: record.mark || '',
      material: source?.material?.name || '',
      quantity: quantity ?? '',
      level: state.levels?.items?.find((l) => l.id === record.levelId)?.name || '',
    },
    custom: record.attributes || {},
  };
}
export function updateDrawingAttribute(records, id, attribute, value) {
  const record = records.find((r) => r.id === id);
  if (!record || !attribute.editable || !attributeApplies(attribute, record.type)) return records;
  value = String(value).trim();
  if (['drawing.number', 'drawing.name'].includes(attribute.key) && !value)
    throw Error('Nummer och namn får inte vara tomma.');
  if (
    attribute.key === 'drawing.number' &&
    records.some((r) => r.id !== id && r.number.toLowerCase() === value.toLowerCase())
  )
    throw Error('Ritningsnumret används redan.');
  if (attribute.dataType === 'number' && value && !Number.isFinite(Number(value)))
    throw Error('Ange ett giltigt tal.');
  const [group, field] = attribute.key.split('.');
  return records.map((r) =>
    r.id !== id
      ? r
      : group === 'custom'
        ? { ...r, attributes: { ...r.attributes, [field]: value } }
        : { ...r, [field]: value },
  );
}
