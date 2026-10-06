import { profileArc, PROFILE_RADIUS_STEP } from './section-contours.js';
import { expression } from './section-expression.js';
const dims = {
  D: ['Diameter d', 200],
  B: ['Bredd b', 200],
  H: ['Höjd h', 300],
  tw: ['Livtjocklek tw', 8],
  tf: ['Flänstjocklek tf', 12],
  t: ['Godstjocklek t', 8],
  lip: ['Läpplängd c', 25],
  R: ['Hålkälsradie R', 12],
  R1: ['Radie R1', 12],
  R2: ['Yttre hörnradie R2', 3],
  Ro: ['Ytterradie Ro', 12],
  Ri: ['Innerradie Ri', 8],
  Rk: ['Hålkälsradie Rk', 11.5],
  Rf: ['Flänskantsradie Rf', 6],
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
// Quarter-circle fillets, sampled at 15°. Expressions keep catalog geometry
// parametric when dimensions are edited, including all four web/flange roots.
export function roundedBeamTemplate(type) {
  const def = sectionTemplate(type);
  const arc = (cx, cy, start) => profileArc(cx, cy, 'R', start, start - 90);
  const points = [
    ['-B/2', '-H/2'],
    ['B/2', '-H/2'],
    ['B/2', '-H/2+tf'],
    ...arc('tw/2+R', '-H/2+tf+R', -90),
    ...arc('tw/2+R', 'H/2-tf-R', 180),
    ['B/2', 'H/2-tf'],
    ['B/2', 'H/2'],
    ['-B/2', 'H/2'],
    ['-B/2', 'H/2-tf'],
    ...arc('-tw/2-R', 'H/2-tf-R', 90),
    ...arc('-tw/2-R', '-H/2+tf+R', 0),
    ['-B/2', '-H/2+tf'],
  ];
  def.roundedRoots = true;
  def.radiusParameters = ['R'];
  def.radiusSegmentAngle = PROFILE_RADIUS_STEP;
  def.parameters.push({ name: 'R', value: dims.R[1] });
  def.loops = [{ id: 'loop0', vertices: points.map(([x, y], i) => ({ id: `p0-${i}`, x, y })) }];
  return def;
}
export function roundedChannelTemplate() {
  const def = sectionTemplate('u');
  const points = [
    ...profileArc('-B/2+R2', '-H/2+R2', 'R2', 180, 270),
    ['B/2', '-H/2'],
    ['B/2', '-H/2+tf'],
    ...profileArc('-B/2+tw+R1', '-H/2+tf+R1', 'R1', -90, -180),
    ...profileArc('-B/2+tw+R1', 'H/2-tf-R1', 'R1', 180, 90),
    ['B/2', 'H/2-tf'],
    ['B/2', 'H/2'],
    ...profileArc('-B/2+R2', 'H/2-R2', 'R2', 90, 180),
  ];
  def.radiusParameters = ['R1', 'R2'];
  def.radiusSegmentAngle = PROFILE_RADIUS_STEP;
  def.parameters.push(...def.radiusParameters.map((name) => ({ name, value: dims[name][1] })));
  def.loops = [{ id: 'loop0', vertices: points.map(([x, y], i) => ({ id: 'p0-' + i, x, y })) }];
  return def;
}
/** Tee thickness at H/2 (web) and B/4 (flange), with tangent root/toe arcs. */
export function roundedTeeTemplate({ slope = 2 } = {}) {
  const def = sectionTemplate('t');
  const s = slope / 100,
    n = Math.sqrt(1 + s * s),
    angle = (Math.atan(s) * 180) / Math.PI,
    flange = 'H/2-tf-' + s + '*B/4',
    rootX = '(tw/2+' + s + '*(' + flange + ')+Rk*' + n * (1 - s) + ')/' + (1 - s * s),
    rootY = flange + '+' + s + '*(' + rootX + ')-Rk*' + n,
    toeX = 'B/2-Rf',
    toeY = flange + '+' + s + '*(' + toeX + ')+Rf*' + n,
    webY = '-H/2+R1',
    webX = 'tw/2+' + s + '*(' + webY + ')-R1*' + n;
  const points = [
    ...profileArc(webX, webY, 'R1', 270, 360 - angle),
    ...profileArc(rootX, rootY, 'Rk', 180 - angle, 90 + angle),
    ...profileArc(toeX, toeY, 'Rf', -90 + angle, 0),
    ['B/2', 'H/2'],
    ['-B/2', 'H/2'],
    ...profileArc('-(' + toeX + ')', toeY, 'Rf', 180, 270 - angle),
    ...profileArc('-(' + rootX + ')', rootY, 'Rk', 90 - angle, angle),
    ...profileArc('-(' + webX + ')', webY, 'R1', 180 + angle, 270),
  ];
  def.teeSlope = slope;
  def.radiusParameters = ['Rk', 'Rf', 'R1'];
  def.radiusSegmentAngle = PROFILE_RADIUS_STEP;
  def.parameters.push({ name: 'Rk', value: 6 }, { name: 'Rf', value: 3 }, { name: 'R1', value: 1 });
  def.loops = [{ id: 'loop0', vertices: points.map(([x, y], i) => ({ id: 'p0-' + i, x, y })) }];
  return def;
}
export function roundedHollowTemplate() {
  const def = sectionTemplate('rhs');
  const rectangle = (halfB, halfH, radius) => [
    ...profileArc(halfB + '-' + radius, '-(' + halfH + ')+' + radius, radius, -90, 0),
    ...profileArc(halfB + '-' + radius, halfH + '-' + radius, radius, 0, 90),
    ...profileArc('-(' + halfB + ')+' + radius, halfH + '-' + radius, radius, 90, 180),
    ...profileArc('-(' + halfB + ')+' + radius, '-(' + halfH + ')+' + radius, radius, 180, 270),
  ];
  def.radiusParameters = ['Ro', 'Ri'];
  def.radiusSegmentAngle = PROFILE_RADIUS_STEP;
  def.parameters.push({ name: 'Ro', value: 12 }, { name: 'Ri', value: 8 });
  def.loops = [rectangle('B/2', 'H/2', 'Ro'), rectangle('B/2-t', 'H/2-t', 'Ri')].map((loop, k) => ({
    id: 'loop' + k,
    vertices: loop.map(([x, y], i) => ({ id: 'p' + k + '-' + i, x, y })),
  }));
  return def;
}
export function roundedAngleTemplate() {
  const def = sectionTemplate('l');
  const points = [
    ['-B/2', '-H/2'],
    ['B/2', '-H/2'],
    ...profileArc('B/2-Rf', '-H/2+t-Rf', 'Rf', 0, 90),
    ...profileArc('-B/2+t+Rk', '-H/2+t+Rk', 'Rk', -90, -180),
    ...profileArc('-B/2+t-Rf', 'H/2-Rf', 'Rf', 0, 90),
    ['-B/2', 'H/2'],
  ];
  def.radiusParameters = ['Rk', 'Rf'];
  def.radiusSegmentAngle = PROFILE_RADIUS_STEP;
  def.parameters.push({ name: 'Rk', value: 6 }, { name: 'Rf', value: 3 });
  def.loops = [{ id: 'loop0', vertices: points.map(([x, y], i) => ({ id: 'p0-' + i, x, y })) }];
  return def;
}
/** Slope and thickness reference are construction rules of the selected series. */
export function taperedChannelTemplate({ slope = 8, thicknessReference = 'B/2' } = {}) {
  const def = sectionTemplate('u');
  const s = slope / 100,
    n = Math.sqrt(1 + s * s),
    angle = (Math.atan(s) * 180) / Math.PI;
  const line = '-H/2+tf+' + s + '*(B/2-(' + thicknessReference + '))';
  const rootX = '-B/2+tw+Rk',
    tipX = 'B/2-Rf';
  const rootY = line + '-' + s + '*(' + rootX + ')+Rk*' + n;
  const tipY = line + '-' + s + '*(' + tipX + ')-Rf*' + n;
  const points = [
    ['-B/2', '-H/2'],
    ['B/2', '-H/2'],
    ...profileArc(tipX, tipY, 'Rf', 0, 90 - angle),
    ...profileArc(rootX, rootY, 'Rk', -90 - angle, -180),
    ...profileArc(rootX, '-(' + rootY + ')', 'Rk', 180, 90 + angle),
    ...profileArc(tipX, '-(' + tipY + ')', 'Rf', -90 + angle, 0),
    ['B/2', 'H/2'],
    ['-B/2', 'H/2'],
  ];
  def.flangeSlope = slope;
  def.flangeThicknessReference = thicknessReference;
  def.radiusParameters = ['Rk', 'Rf'];
  def.radiusSegmentAngle = PROFILE_RADIUS_STEP;
  def.parameters.push(...def.radiusParameters.map((name) => ({ name, value: dims[name][1] })));
  def.loops = [{ id: 'loop0', vertices: points.map(([x, y], i) => ({ id: 'p0-' + i, x, y })) }];
  return def;
}
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
  const { B, H, D, t, tw, tf, lip, R, R1, R2, Rk, Rf, Ro, Ri } = values;
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
  if (def.roundedRoots && !(R >= 0 && 2 * R < B - tw && 2 * R < H - 2 * tf))
    throw new Error(
      'Hålkälsradien måste vara noll eller positiv och rymmas mellan liv och flänsar.',
    );
  if (
    def.template === 'u' &&
    def.radiusParameters?.includes('R1') &&
    !(R1 >= 0 && R2 >= 0 && R1 < B - tw && 2 * R1 < H - 2 * tf && R2 <= Math.min(tw, tf))
  )
    throw new Error('U-profilens radier måste rymmas inom liv, flänsar och öppning.');
  if (def.template === 'u' && def.flangeSlope !== undefined) {
    const s = def.flangeSlope / 100,
      n = Math.sqrt(1 + s * s);
    const u = expression(def.flangeThicknessReference, (key) => values[key]);
    const tipThickness = tf - s * u;
    const rootX = -B / 2 + tw + Rk;
    const rootY = -H / 2 + tf + s * (B / 2 - u - rootX) + Rk * n;
    const tipX = B / 2 - Rf;
    if (
      !(
        Number.isFinite(s) &&
        s >= 0 &&
        s <= 0.2 &&
        u > 0 &&
        u < B &&
        Rk >= 0 &&
        Rf >= 0 &&
        tipThickness > Rf * (n - s) &&
        rootY < 0 &&
        rootX + (Rk * s) / n < tipX + (Rf * s) / n
      )
    )
      throw new Error('U-profilens lutning, tjocklek och radier måste rymmas inom tvärsnittet.');
  }
  if (def.template === 't' && !(tw > 0 && tw < B && tf > 0 && tf < H))
    throw new Error('Liv och fläns måste rymmas inom bredd och höjd.');
  if (def.template === 't' && def.radiusParameters?.includes('Rk')) {
    const s = def.teeSlope / 100,
      n = Math.sqrt(1 + s * s),
      a = tw / 2,
      b = H / 2 - tf - (s * B) / 4;
    const rootX = (a + s * b + Rk * n * (1 - s)) / (1 - s * s),
      rootY = b + s * rootX - Rk * n;
    const toeX = B / 2 - Rf,
      toeY = b + s * toeX + Rf * n;
    const webY = -H / 2 + R1,
      webX = a + s * webY - R1 * n;
    if (
      !(
        Number.isFinite(s) &&
        s >= 0 &&
        s <= 0.2 &&
        Rk >= 0 &&
        Rf >= 0 &&
        R1 >= 0 &&
        webX >= 0 &&
        toeY <= H / 2 &&
        rootX - (Rk * s) / n <= toeX + (Rf * s) / n &&
        rootY + (Rk * s) / n >= webY - (R1 * s) / n
      )
    )
      throw new Error('T-profilens lutning och radier måste rymmas inom liv, fläns och öppning.');
  }
  if (def.template === 'rhs' && !(t > 0 && 2 * t < Math.min(B, H)))
    throw new Error('Godstjockleken måste vara mindre än halva bredden och höjden.');
  if (
    def.template === 'rhs' &&
    def.radiusParameters?.includes('Ro') &&
    !(
      Ro >= 0 &&
      Ri >= 0 &&
      Ro <= Math.min(B, H) / 2 &&
      Ri <= Math.min(B, H) / 2 - t &&
      Ro >= Ri &&
      Ro - Ri < (2 + Math.sqrt(2)) * t
    )
  )
    throw new Error(
      'Rörets radier måste rymmas inom tvärsnittet och hålla hålet innanför ytterkonturen.',
    );
  if (def.template === 'l' && !(t > 0 && t < Math.min(B, H)))
    throw new Error('Godstjockleken måste vara mindre än skänklarnas mått.');
  if (
    def.template === 'l' &&
    def.radiusParameters?.includes('Rk') &&
    !(Rk >= 0 && Rf >= 0 && Rf <= t && t + Rk + Rf < Math.min(B, H))
  )
    throw new Error('L-profilens radier måste rymmas inom skänklar och godstjocklek.');
  if (def.template === 'c' && !(t > 0 && 2 * t < B && lip > t && 2 * lip < H))
    throw new Error('C-profilen kräver 2t < bredd, t < läpplängd och 2 × läpplängd < höjd.');
}
