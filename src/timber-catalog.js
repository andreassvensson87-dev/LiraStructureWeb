import { sectionTemplate } from './section-templates.js';

export const TIMBER_SOURCE = 'https://www.svedentra.se/vara-produkter-och-tjanster/byggtra/';
export const GLULAM_SOURCE =
  'https://www.svenskttra.se/bygg-med-tra/om-limtra/hallfasthetsklasser-och-sortiment/';
// Explicit stock dimensions, not the Cartesian product of manufacturing widths/heights.
const studs = [
  [34, 70],
  [45, 45],
  [45, 70],
  [45, 95],
  [45, 120],
  [45, 145],
  [45, 170],
  [45, 195],
  [45, 220],
];
const beams = [
  [90, [180, 225, 270, 315, 360, 405, 450]],
  [115, [180, 225, 270, 315, 360, 405, 450, 495, 630]],
  [140, [225, 270, 315, 360, 405]],
];
const splitBeams = [
  [42, [180, 225, 270]],
  [56, [225, 270]],
  [66, [270, 315]],
];
const columns = [
  [90, 90],
  [115, 115],
  [140, 135],
  [140, 140],
  [165, 165],
];
const expand = (rows) => rows.flatMap(([B, heights]) => heights.map((H) => [B, H]));
const rectangle = (series, family, prefix, B, H, grade, density, source) => ({
  ...sectionTemplate('rect'),
  id: 'swedish-timber-2026-' + series + '-' + B + 'x' + H,
  revision: 1,
  name: prefix + ' ' + B + 'x' + H,
  family,
  libraryGroup: 'timber',
  aliases: [prefix + ' ' + B + '×' + H, ...(grade ? [grade + ' ' + B + 'x' + H] : [])],
  standard:
    series === 'stud'
      ? grade
        ? grade + ' · SS-EN 338 / 14081-1'
        : 'Dimensionshyvlat · SS-EN 336'
      : grade + ' · SS-EN 14080',
  source,
  density,
  catalog: {},
  parameters: [
    { name: 'B', value: B },
    { name: 'H', value: H },
  ],
});

export const TIMBER_PROFILES = [
  ...studs.map(([B, H]) =>
    rectangle(
      'stud',
      'Träreglar',
      'Träregel',
      B,
      H,
      B === 45 && H >= 95 ? 'C24' : '',
      420,
      TIMBER_SOURCE,
    ),
  ),
  ...expand(beams).map(([B, H]) =>
    rectangle('gl30c', 'Limträbalkar GL30c', 'Limträ', B, H, 'GL30c', 430, GLULAM_SOURCE),
  ),
  ...columns.map(([B, H]) =>
    rectangle('gl30h', 'Limträpelare GL30h', 'Limträ', B, H, 'GL30h', 480, GLULAM_SOURCE),
  ),
  ...expand(splitBeams).map(([B, H]) =>
    rectangle(
      'gl28cs',
      'Klyvsågat limträ GL28cs',
      'Limträ klyvsågat',
      B,
      H,
      'GL28cs',
      430,
      GLULAM_SOURCE,
    ),
  ),
];
