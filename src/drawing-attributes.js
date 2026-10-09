import { drawingRevisionHistory, revisionFields } from './drawing-revision-history.js';
export const ATTRIBUTE_KEY = 'lirastructure.drawing-attributes.v1';
export const ATTRIBUTE_SETTINGS_KEY = 'lirastructure.drawing-attribute-settings.v1';
export const attributeDataTypes = {
  text: 'Text',
  date: 'Datum',
  number: 'Tal',
  choice: 'Val (ett)',
  multichoice: 'Flerval',
};
export const standardChoices = {
  'drawing.issueStatus': [
    'FÖR INFORMATION | FI',
    'PRELIMINÄR | PR',
    'GRANSKNING | R-',
    'FÖRFRÅGNINGSUNDERLAG | FU',
    'GODKÄND | G1',
  ],
  'drawing.documentType': [
    'PROGRAMHANDLING | PH',
    'FÖRSLAGSHANDLING | FH',
    'SYSTEMHANDLING | SH',
    'BYGGLOVSHANDLING | BL',
    'BYGGHANDLING | BH',
    'TILLVERKNINGSHANDLING | TH',
    'RELATIONSHANDLING | RH',
    'FÖRVALTNINGSHANDLING | FM',
  ],
  'drawing.category': [
    'SAMMANSATT',
    'PLAN',
    'SEKTION, SEKTIONSVY, SNITT, SNITTVY',
    'ELEVATION, FASAD, VY',
    'UPPSTÄLLNING',
    'FÖRTECKNING',
    'DETALJER',
    'SAMORDNING',
    'SCHEMA',
  ],
};
export const builtInAttributes = [
  ['project.name', 'Projektnamn', 'all', false],
  ['project.number', 'Projektnummer', 'all', false],
  ['project.client', 'Beställare', 'all', false],
  ['report.title', 'Rapport · titel', 'all', false],
  ['report.number', 'Rapport · nummer', 'all', false],
  ['report.date', 'Rapport · datum', 'all', false, 'date'],
  ['report.revision', 'Rapport · revision', 'all', false],
  ['report.issueStatus', 'Rapport · status', 'all', false],
  ['report.documentType', 'Rapport · handlingstyp', 'all', false],
  ['report.pageLabel', 'Rapport · sida av antal', 'all', false],
  ['report.pageNumber', 'Rapport · sidnummer', 'all', false, 'number'],
  ['report.pageCount', 'Rapport · antal sidor', 'all', false, 'number'],
  ['report.rowCount', 'Rapport · antal rader', 'all', false, 'number'],
  ['report.partCount', 'Rapport · antal delar', 'all', false, 'number'],
  ['drawing.number', 'Ritningsnummer', 'all', true],
  ['drawing.name', 'Ritningsnamn', 'all', true],
  ['drawing.type', 'Ritningstyp', 'all', false],
  ['drawing.revision', 'Revision', 'all', true],
  ['drawing.revisionCreatedBy', 'Revision · skapad av', 'all', true],
  ['drawing.revisionComment', 'Revision · kommentar', 'all', true],
  ['drawing.revisionDate', 'Revision · datum', 'all', true, 'date'],
  ['drawing.date', 'Datum', 'all', true, 'date'],
  ['drawing.drawnBy', 'Ritad av', 'all', true],
  ['drawing.checkedBy', 'Granskad av', 'all', true],
  ['drawing.issueStatus', 'Utgivningsstatus', 'all', true],
  ['drawing.issueStatusCode', 'Status · förkortning', 'all', false],
  ['drawing.documentType', 'Handling', 'all', true],
  ['drawing.documentTypeCode', 'Handling · förkortning', 'all', false],
  ['drawing.category', 'Ritningskategori', 'all', true],
  ['drawing.contact', 'Kontaktperson', 'all', true],
  ['drawing.responsibleParty', 'Ansvarig part', 'all', true],
  ['drawing.paperFormat', 'Pappersformat', 'all', false],
  ['drawing.scale', 'Skala', 'all', false],
  ['drawing.partMark', 'Part mark', 'SP', false],
  ['drawing.assemblyMark', 'Assemblynummer', 'AS', false],
  ['drawing.assemblyQuantity', 'Antal assemblies', 'AS', false, 'number'],
  ['drawing.material', 'Material', 'SP', false],
  ['drawing.quantity', 'Antal', 'SP', false, 'number'],
  ['drawing.level', 'Nivå', 'GA', false],
].map(([key, name, scope, editable, dataType = 'text']) => ({
  key,
  name,
  scope,
  editable,
  dataType: standardChoices[key] ? 'choice' : dataType,
  ...(standardChoices[key] ? { options: standardChoices[key] } : {}),
}));
export const attributeChoiceConfigurable = (attribute) =>
  attribute.key.startsWith('custom.') ||
  (attribute.editable &&
    !['date', 'number'].includes(attribute.dataType) &&
    !['drawing.number', 'drawing.name', ...revisionFields.map((f) => `drawing.${f}`)].includes(
      attribute.key,
    ));
export function attributeOptions(options) {
  return [
    ...new Set(
      (Array.isArray(options) ? options : [])
        .filter((v) => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}
function attributeSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(ATTRIBUTE_SETTINGS_KEY) || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}
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
            scope: ['GA', 'SP', 'AS'].includes(a.scope) ? a.scope : 'all',
            dataType: Object.hasOwn(attributeDataTypes, a.dataType) ? a.dataType : 'text',
            options: attributeOptions(a.options),
            editable: true,
          }))
      : [];
  } catch {
    return [];
  }
}
export function drawingAttributes() {
  const settings = attributeSettings();
  return [
    ...builtInAttributes.map((a) => {
      const saved = settings[a.key];
      if (!saved || !attributeChoiceConfigurable(a)) return a;
      return {
        ...a,
        dataType: ['text', 'choice', 'multichoice'].includes(saved.dataType)
          ? saved.dataType
          : a.dataType,
        options: attributeOptions(saved.options),
      };
    }),
    ...customAttributes(),
  ];
}
export function saveAttributeDefinition(definition) {
  const original = builtInAttributes.find((a) => a.key === definition.key);
  if (!original && !definition.key?.startsWith('custom.')) throw Error('Ogiltigt attribut.');
  const custom = !original;
  const name = String(custom ? definition.name : original.name).trim();
  if (!name || name.length > 80) throw Error('Ange ett namn med högst 80 tecken.');
  const allowed = custom
    ? Object.keys(attributeDataTypes)
    : attributeChoiceConfigurable(original)
      ? ['text', 'choice', 'multichoice']
      : [original.dataType];
  if (!allowed.includes(definition.dataType))
    throw Error('Datatypen kan inte användas för attributet.');
  const options = attributeOptions(definition.options);
  if (['choice', 'multichoice'].includes(definition.dataType) && !options.length)
    throw Error('Lägg till minst ett val.');
  if (options.length > 100 || options.some((v) => v.length > 200))
    throw Error('Högst 100 val med högst 200 tecken per val.');
  const saved = {
    ...definition,
    name,
    options,
    scope:
      original?.scope || (['GA', 'SP', 'AS'].includes(definition.scope) ? definition.scope : 'all'),
  };
  if (custom) {
    const items = customAttributes();
    localStorage.setItem(
      ATTRIBUTE_KEY,
      JSON.stringify([...items.filter((a) => a.key !== saved.key), saved]),
    );
  } else {
    localStorage.setItem(
      ATTRIBUTE_SETTINGS_KEY,
      JSON.stringify({
        ...attributeSettings(),
        [saved.key]: { dataType: saved.dataType, options },
      }),
    );
  }
  return saved;
}
export const attributeApplies = (a, type) =>
  !a.scope || a.scope === 'all' || !type || a.scope === type;
export function attributeRawValue(key, context) {
  const definition = drawingAttributes().find((a) => a.key === key);
  if (definition && !attributeApplies(definition, context.drawing?.type)) return '';
  const [group, field] = key.split('.');
  const value =
    group === 'drawing' && field === 'partMark'
      ? (context.drawing?.partMark ?? context.drawing?.mark)
      : context[group]?.[field];
  return value ?? '';
}
export function attributeValue(key, context) {
  const value = attributeRawValue(key, context);
  return Array.isArray(value) ? value.join(', ') : String(value);
}
/** A choice can include its schedule code: "BYGGHANDLING | BH". */
export function attributeChoiceParts(value) {
  const text = String(value ?? '').trim();
  const separator = text.lastIndexOf('|');
  return separator < 0
    ? { text, code: '' }
    : { text: text.slice(0, separator).trim(), code: text.slice(separator + 1).trim() };
}
function choiceCodes(value) {
  return (Array.isArray(value) ? value : [value])
    .map((v) => attributeChoiceParts(v).code)
    .filter(Boolean)
    .join(', ');
}
/** Drawing graphics show full labels; schedule code columns use separate attributes. */
export function attributeDrawingValue(key, context) {
  const definition = drawingAttributes().find((a) => a.key === key);
  if (
    ![
      'drawing.issueStatus',
      'drawing.documentType',
      'report.issueStatus',
      'report.documentType',
    ].includes(key) &&
    !['choice', 'multichoice'].includes(definition?.dataType)
  )
    return attributeValue(key, context);
  const raw = attributeRawValue(key, context);
  return (Array.isArray(raw) ? raw : [raw]).map((v) => attributeChoiceParts(v).text).join(', ');
}
export function drawingAttributeContext(record, state = {}) {
  const assembly =
    record.type === 'AS' && state.assemblies?.find((a) => a.id === record.assemblyId);
  const source = state.objects?.find((o) => o.id === record.sourceId);
  const assignments = state.parts?.assignments || {};
  const quantity = state.objects?.filter(
    (o) => record.partKey && assignments[o.id]?.key === record.partKey,
  ).length;
  return {
    project: state.info || state.project || {},
    drawing: {
      ...record,
      issueStatusCode: choiceCodes(record.issueStatus),
      documentTypeCode: choiceCodes(record.documentType),
      scale: drawingScale(record),
      ...(assembly ? { number: assembly.mark, name: assembly.mark } : {}),
      ...(record.type === 'SP' && record.mark ? { name: record.mark } : {}),
      partMark: record.mark || '',
      assemblyMark:
        state.assemblies?.find((a) => a.id === record.assemblyId)?.mark || record.mark || '',
      material: source?.material?.name || '',
      quantity: quantity ?? '',
      assemblyQuantity: record.type === 'AS' ? drawingAssemblies(record, state).length : '',
      level: state.levels?.items?.find((l) => l.id === record.levelId)?.name || '',
    },
    custom: record.attributes || {},
  };
}
export function drawingScale(record) {
  const sheet = record.sheet || {};
  const scales = [
    ...new Set(
      (sheet.views || [])
        .map((v) => v.scale)
        .filter((scale) => Number.isFinite(scale) && scale > 0),
    ),
  ];
  if (scales.length > 1) return 'Enl. vyer';
  const scale = scales[0] ?? sheet.viewScale ?? sheet.scale;
  if (!(scale > 0) || !Number.isFinite(scale)) return '';
  return scale >= 1 ? `1:${+scale.toFixed(3)}` : `${+(1 / scale).toFixed(3)}:1`;
}
export function updateDrawingAttribute(records, id, attribute, value) {
  const record = records.find((r) => r.id === id);
  if (!record || !attribute.editable || !attributeApplies(attribute, record.type)) return records;
  if (
    (record.type === 'AS' && ['drawing.number', 'drawing.name'].includes(attribute.key)) ||
    (record.type === 'SP' && attribute.key === 'drawing.name')
  )
    throw Error(
      'Ritningsnamnet följer Part mark eller Assembly mark. Ändra serien i modellen och numrera igen.',
    );
  const oldValue = attributeRawValue(attribute.key, drawingAttributeContext(record));
  if (attribute.dataType === 'multichoice') {
    value = attributeOptions(Array.isArray(value) ? value : value ? [String(value)] : []);
  } else value = String(value).trim();
  if (['choice', 'multichoice'].includes(attribute.dataType)) {
    // Keep previously saved values available when a list is edited.
    const allowed = new Set([
      ...attributeOptions(attribute.options),
      ...(Array.isArray(oldValue) ? oldValue : [String(oldValue)]),
    ]);
    const values = Array.isArray(value) ? value : value ? [value] : [];
    if (values.some((v) => !allowed.has(v)))
      throw Error('Välj ett värde från attributets vallista.');
  }
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
  if (group === 'drawing' && revisionFields.includes(field) && record.revisions?.length) {
    const revisions = drawingRevisionHistory(record);
    if (field === 'revision' && revisions.slice(0, -1).some((r) => r.revision === value))
      throw Error('Revisionsbeteckningen finns redan i historiken.');
    revisions[revisions.length - 1] = { ...revisions.at(-1), [field]: value };
    return records.map((r) => (r.id === id ? { ...r, [field]: value, revisions } : r));
  }
  return records.map((r) =>
    r.id !== id
      ? r
      : group === 'custom'
        ? { ...r, attributes: { ...r.attributes, [field]: value } }
        : { ...r, [field]: value },
  );
}
import { drawingAssemblies } from './assembly-numbering.js';
