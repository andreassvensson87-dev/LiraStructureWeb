/** Explicit aliases only. Production families such as VKR/KKR remain different. */
export const normalizeProfileName = (text) =>
  String(text || '')
    .toUpperCase()
    .replace(/×|\*/g, 'X')
    .replace(/(\d),(?=\d)/g, '$1.')
    .replace(/\s+/g, '')
    .replace(/VKR[KR](?=\d)/g, 'VKR')
    .replace(/KKR[KR](?=\d)/g, 'KKR');
export function profileNameEvidence(names = []) {
  const tokens = new Set(),
    rectangles = new Set();
  let timber = false,
    glulam = false;
  for (const name of names) {
    const text = normalizeProfileName(name);
    timber ||= /LIMTR|LUMBER|TRÄ|TIMBER|\bLT\d/.test(String(name).toUpperCase());
    glulam ||= /LIMTR|GLULAM|(?:^|[^A-Z])LT\d/.test(String(name).toUpperCase());
    const re =
      /(?:^|[^A-Z])(HEA|HEB|HEM|IPE|UPE|UPN|VKR|KKR|KCKR|CHS|CKR|RO)(\d+(?:\.\d+)?(?:X\d+(?:\.\d+)?){0,2})(?![\d.])/g;
    for (const m of text.matchAll(re)) tokens.add(m[1] + m[2]);
    for (const m of text.matchAll(/(?:^|[^\d.X])(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)(?![\d.X])/g))
      rectangles.add(`${Number(m[1])}X${Number(m[2])}`);
  }
  return { tokens, rectangles, timber, glulam };
}
export function profileNameScore(source, section) {
  const target = profileNameEvidence([section.name, ...(section.aliases || [])]);
  if ([...source.tokens].some((t) => target.tokens.has(t))) return 40;
  if (source.timber && section.libraryGroup !== 'timber' && !/trä/i.test(section.family)) return -1;
  if (source.glulam && /träregel/i.test(section.name)) return -1;
  const p = section.properties.bounds;
  if (
    source.rectangles.has(`${p.width}X${p.height}`) ||
    source.rectangles.has(`${p.height}X${p.width}`)
  )
    return 15;
  return 0;
}
