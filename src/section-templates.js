const dims = {
  D: ['Diameter d', 200],
  B: ['Bredd b', 200],
  H: ['Höjd h', 300],
  tw: ['Livtjocklek tw', 8],
  tf: ['Flänstjocklek tf', 12],
  t: ['Godstjocklek t', 8],
  lip: ['Läpplängd c', 25],
};
export const TEMPLATE_KEYS = {
  h: ['B', 'H', 'tw', 'tf'],
  i: ['B', 'H', 'tw', 'tf'],
  l: ['B', 'H', 't'],
  u: ['B', 'H', 'tw', 'tf'],
  c: ['B', 'H', 't', 'lip'],
  t: ['B', 'H', 'tw', 'tf'],
  rect: ['B', 'H'],
  rhs: ['B', 'H', 't'],
  circle: ['D'],
  chs: ['D', 't'],
  triangle: ['B', 'H'],
};
export const dimensionLabel = (key) => dims[key]?.[0] || key;
export function sectionTemplate(type) {
  if (!TEMPLATE_KEYS[type]) return null;
  let points,
    holes = [];
  const rectangle = (x, y) => [
    [`-(${x})`, `-(${y})`],
    [x, `-(${y})`],
    [x, y],
    [`-(${x})`, y],
  ];
  const circle = (r) =>
    Array.from({ length: 96 }, (_, i) => [
      `${Math.cos((i * Math.PI) / 48).toFixed(12)}*(${r})`,
      `${Math.sin((i * Math.PI) / 48).toFixed(12)}*(${r})`,
    ]);
  if (type === 'rect' || type === 'rhs') {
    points = rectangle('B/2', 'H/2');
    if (type === 'rhs') holes = [rectangle('B/2-t', 'H/2-t')];
  }
  if (type === 'circle' || type === 'chs') {
    points = circle('D/2');
    if (type === 'chs') holes = [circle('D/2-t')];
  }
  if (type === 'triangle')
    points = [
      ['-B/2', '-H/2'],
      ['B/2', '-H/2'],
      ['0', 'H/2'],
    ];
  if (type === 't')
    points = [
      ['-tw/2', '-H/2'],
      ['tw/2', '-H/2'],
      ['tw/2', 'H/2-tf'],
      ['B/2', 'H/2-tf'],
      ['B/2', 'H/2'],
      ['-B/2', 'H/2'],
      ['-B/2', 'H/2-tf'],
      ['-tw/2', 'H/2-tf'],
    ];
  if (type === 'h' || type === 'i')
    points = [
      ['-B/2', '-H/2'],
      ['B/2', '-H/2'],
      ['B/2', '-H/2+tf'],
      ['tw/2', '-H/2+tf'],
      ['tw/2', 'H/2-tf'],
      ['B/2', 'H/2-tf'],
      ['B/2', 'H/2'],
      ['-B/2', 'H/2'],
      ['-B/2', 'H/2-tf'],
      ['-tw/2', 'H/2-tf'],
      ['-tw/2', '-H/2+tf'],
      ['-B/2', '-H/2+tf'],
    ];
  if (type === 'l')
    points = [
      ['-B/2', '-H/2'],
      ['B/2', '-H/2'],
      ['B/2', '-H/2+t'],
      ['-B/2+t', '-H/2+t'],
      ['-B/2+t', 'H/2'],
      ['-B/2', 'H/2'],
    ];
  if (type === 'u')
    points = [
      ['-B/2', '-H/2'],
      ['B/2', '-H/2'],
      ['B/2', '-H/2+tf'],
      ['-B/2+tw', '-H/2+tf'],
      ['-B/2+tw', 'H/2-tf'],
      ['B/2', 'H/2-tf'],
      ['B/2', 'H/2'],
      ['-B/2', 'H/2'],
    ];
  if (type === 'c')
    points = [
      ['-B/2', '-H/2'],
      ['B/2', '-H/2'],
      ['B/2', '-H/2+lip'],
      ['B/2-t', '-H/2+lip'],
      ['B/2-t', '-H/2+t'],
      ['-B/2+t', '-H/2+t'],
      ['-B/2+t', 'H/2-t'],
      ['B/2-t', 'H/2-t'],
      ['B/2-t', 'H/2-lip'],
      ['B/2', 'H/2-lip'],
      ['B/2', 'H/2'],
      ['-B/2', 'H/2'],
    ];
  return {
    template: type,
    profileType: type,
    parameters: TEMPLATE_KEYS[type].map((name) => ({ name, value: dims[name][1] })),
    anchor: [0, 0],
    loops: [points, ...holes].map((loop, k) => ({
      id: 'loop' + k,
      vertices: loop.map(([x, y], i) => ({ id: `p${k}-${i}`, x, y })),
    })),
  };
}
export function validateTemplate(def, values) {
  if (!def.template) return;
  const { B, H, D, t, tw, tf, lip } = values;
  if (['circle', 'chs'].includes(def.template)) {
    if (!(D > 0)) throw new Error('Diametern måste vara positiv.');
    if (def.template === 'chs' && !(t > 0 && 2 * t < D))
      throw new Error('Godstjockleken måste vara mindre än halva diametern.');
    return;
  }
  if (!(B > 0 && H > 0)) throw new Error('Bredd och höjd måste vara positiva.');
  if (['h', 'i', 'u'].includes(def.template) && !(tw > 0 && tw < B && tf > 0 && 2 * tf < H))
    throw new Error(
      'Livtjockleken måste vara mindre än bredden och två flänsar måste rymmas inom höjden.',
    );
  if (def.template === 't' && !(tw > 0 && tw < B && tf > 0 && tf < H))
    throw new Error('Liv och fläns måste rymmas inom bredd och höjd.');
  if (def.template === 'rhs' && !(t > 0 && 2 * t < Math.min(B, H)))
    throw new Error('Godstjockleken måste vara mindre än halva bredden och höjden.');
  if (def.template === 'l' && !(t > 0 && t < Math.min(B, H)))
    throw new Error('Godstjockleken måste vara mindre än skänklarnas mått.');
  if (def.template === 'c' && !(t > 0 && 2 * t < B && lip > t && 2 * lip < H))
    throw new Error('C-profilen kräver 2t < bredd, t < läpplängd och 2 × läpplängd < höjd.');
}
