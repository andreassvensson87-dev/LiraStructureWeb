import { MATERIAL_TYPES, latestMaterials, mergeMaterials } from './materials.js';

const steelSource = 'https://www.ssab.com/en/support/product-material-data/steel/20-questions';
const woodSource = (grade) =>
  `https://www.traguiden.se/produkter/konstruktionsvirke/konstruktionsvirke-obehandlat/konstruktionsvirke-hallfasthetsklass-${grade}/konstruktionsvirke-${grade}-gran-obehandlad-45x95/`;
const glulamSource =
  'https://www.svenskttra.se/bygg-med-tra/om-limtra/hallfasthetsklasser-och-sortiment/';
const rows = [
  ...['S235JR', 'S355J2', 'S355N', 'S355M'].map((name) => [
    'steel',
    'Konstruktionsstål',
    name,
    7850,
    '#688391',
    'Nominell densitet för stål.',
    steelSource,
  ]),
  [
    'steel',
    'Hålprofilstål',
    'S355J2H',
    7850,
    '#688391',
    'Nominell densitet för stål.',
    steelSource,
  ],
  ...['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50'].map((name) => [
    'concrete',
    'Normalbetong',
    name,
    2400,
    '#b5b8b3',
    'Schablondensitet för normalbetong utan armering. Anpassa till betongreceptet.',
    '',
  ]),
  [
    'wood',
    'Konstruktionsvirke',
    'C14',
    350,
    '#c9a46c',
    'Medeldensitet enligt SS-EN 338.',
    woodSource('c14'),
  ],
  [
    'wood',
    'Konstruktionsvirke',
    'C24',
    420,
    '#c9a46c',
    'Medeldensitet enligt SS-EN 338.',
    woodSource('c24'),
  ],
  [
    'wood',
    'Limträ',
    'GL28cs',
    430,
    '#d5b57e',
    'Klyvsågat kombinerat limträ. Medeldensitet enligt SS-EN 14080.',
    glulamSource,
  ],
  [
    'wood',
    'Limträ',
    'GL28hs',
    480,
    '#d5b57e',
    'Klyvsågat homogent limträ. Medeldensitet enligt SS-EN 14080.',
    glulamSource,
  ],
  [
    'wood',
    'Limträ',
    'GL30c',
    430,
    '#d5b57e',
    'Kombinerat limträ. Medeldensitet enligt SS-EN 14080.',
    glulamSource,
  ],
  [
    'wood',
    'Limträ',
    'GL30h',
    480,
    '#d5b57e',
    'Homogent limträ. Medeldensitet enligt SS-EN 14080.',
    glulamSource,
  ],
  [
    'insulation',
    'Mineralull',
    'Glasull',
    30,
    '#e6d291',
    'Schablondensitet. Varierar med produkt; ange produktens densitet för egen variant.',
    'https://www.isover.se/produkter/isover-robust-stav-i-glasull',
  ],
  [
    'insulation',
    'Mineralull',
    'Stenull',
    30,
    '#b9ac80',
    'Schablondensitet för lätt stenull. Varierar med produkt.',
    'https://www.rockwool.com/dk/produkter/flexibatts-37/',
  ],
  [
    'insulation',
    'Cellplast',
    'EPS',
    20,
    '#e3e6e5',
    'Schablondensitet. Varierar med produkt och tryckhållfasthet.',
    'https://bewi.com/wp-content/uploads/2021/02/EPD-for-EPS.pdf',
  ],
  [
    'insulation',
    'Cellplast',
    'XPS',
    32,
    '#b6d6df',
    'Schablondensitet med XPS250 som referens. Varierar med produkt.',
    'https://finnfoam.se/produkter/finnfoam-xps/finnfoam-xps250/',
  ],
  [
    'insulation',
    'Hård skumisolering',
    'PIR',
    35,
    '#e2cfa5',
    'Schablondensitet inom referensens intervall 32–37 kg/m³. Varierar med produkt.',
    'https://finnfoam.se/produkter/ff-pir/ff-pir-pl-plastlaminat/',
  ],
  [
    'insulation',
    'Hård skumisolering',
    'PUR',
    35,
    '#dac593',
    'Schablondensitet inom referensens intervall 25–35 kg/m³. Varierar med produkt.',
    'https://www.sika.com/en/construction/roof-systems/thermal-insulation.html',
  ],
];

export const BUILTIN_MATERIALS = rows.map(
  ([category, subgroup, name, density, color, note, source]) =>
    Object.freeze({
      id: `standard-material-${category}-${name.toLowerCase().replaceAll('/', '-')}`,
      revision: 1,
      category,
      subgroup,
      name,
      density,
      color,
      note,
      source,
    }),
);
const builtinIds = new Set(BUILTIN_MATERIALS.map((m) => m.id));
export const isBuiltinMaterial = (m) => m?.revision === 1 && builtinIds.has(m.id);
export const personalMaterials = (records) => records.filter((m) => !isBuiltinMaterial(m));
export const withMaterialCatalog = (records = []) => mergeMaterials(BUILTIN_MATERIALS, records);

// Editing stock data creates a personal material; editing personal data versions it.
export function materialRevision(records, editing, fields, newId) {
  const personal = editing && !isBuiltinMaterial(editing);
  return {
    id: personal ? editing.id : newId,
    revision: personal
      ? 1 +
        Math.max(
          editing.revision,
          ...records.filter((m) => m.id === editing.id).map((m) => m.revision),
        )
      : 1,
    ...fields,
  };
}

export function materialGroups(records, query = '') {
  const q = query.trim().toLocaleLowerCase('sv');
  return MATERIAL_TYPES.map(([id, name]) => {
    const materials = latestMaterials(records).filter(
      (m) =>
        m.category === id &&
        `${name} ${m.subgroup || ''} ${m.name} ${m.note || ''}`.toLocaleLowerCase('sv').includes(q),
    );
    const groups = new Map();
    for (const m of materials) {
      const label = m.subgroup || 'Egna material';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(m);
    }
    return {
      id,
      name,
      count: materials.length,
      groups: [...groups].map(([name, materials]) => ({ name, materials })),
    };
  }).filter((g) => g.count);
}
