/** Minimal typed STEP serialization. All user text is encoded; no raw text becomes syntax. */
export const stepString = (value) => {
  let text = '';
  for (const ch of String(value ?? '')) {
    const n = ch.codePointAt(0);
    if (n >= 32 && n <= 126 && ch !== "'" && ch !== '\\') text += ch;
    else if (ch === "'") text += "''";
    else {
      const hex = [...Array(ch.length)]
        .map((_, i) => ch.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase())
        .join('');
      text += `\\X2\\${hex}\\X0\\`;
    }
  }
  return `'${text}'`;
};
export const stepNumber = (value) => {
  if (!Number.isFinite(value)) throw Error('IFC-geometrin innehåller ett ogiltigt tal.');
  const n = Object.is(value, -0) ? 0 : value;
  const text = String(n).toUpperCase();
  if (text.includes('E')) {
    const [a, b] = text.split('E');
    return `${a.includes('.') ? a : a + '.'}E${b}`;
  }
  return text.includes('.') ? text : text + '.';
};
export const stepList = (values) => `(${values.join(',')})`;
export class StepWriter {
  constructor() {
    this.lines = [];
  }
  add(type, ...args) {
    if (!/^[A-Z0-9_]+$/.test(type)) throw Error('Ogiltig IFC-entitet.');
    const id = this.lines.length + 1;
    this.lines.push(`#${id}=${type}(${args.join(',')});`);
    return '#' + id;
  }
  point(p) {
    return this.add('IFCCARTESIANPOINT', stepList(p.map(stepNumber)));
  }
  direction(p) {
    return this.add('IFCDIRECTION', stepList(p.map(stepNumber)));
  }
  axis(origin = [0, 0, 0], z = [0, 0, 1], x = [1, 0, 0]) {
    return this.add(
      'IFCAXIS2PLACEMENT3D',
      this.point(origin),
      this.direction(z),
      this.direction(x),
    );
  }
  finish(filename, date) {
    return new TextEncoder().encode(
      `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('LiraStructure IFC4 coordination export'),'2;1');\nFILE_NAME(${stepString(filename)},${stepString(date)},(''),(''),'LiraStructure','LiraStructure','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${this.lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`,
    );
  }
}
