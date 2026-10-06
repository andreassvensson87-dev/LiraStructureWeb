// Restricted arithmetic grammar. Expressions never execute JavaScript.
export function expression(
  text,
  resolve = () => {
    throw new Error('Okänd parameter.');
  },
) {
  const source = String(text).trim().replaceAll(',', '.');
  if (source.length > 200) throw new Error('Uttrycket är för långt.');
  const tokens =
    source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|[()+*/-]/g) || [];
  if (tokens.join('') !== source.replace(/\s/g, ''))
    throw new Error('Använd tal, parametrar och + − * / ( ).');
  let i = 0;
  const factor = () => {
    const t = tokens[i++];
    if (t === '+') return factor();
    if (t === '-') return -factor();
    if (t === '(') {
      const v = sum();
      if (tokens[i++] !== ')') throw new Error('Saknad parentes.');
      return v;
    }
    if (t && /^[A-Za-z_]/.test(t)) return resolve(t);
    if (t && /^(\d|\.)/.test(t)) return Number(t);
    throw new Error('Ofullständigt uttryck.');
  };
  const product = () => {
    let v = factor();
    while (['*', '/'].includes(tokens[i])) {
      const op = tokens[i++],
        n = factor();
      v = op === '*' ? v * n : v / n;
    }
    return v;
  };
  const sum = () => {
    let v = product();
    while (['+', '-'].includes(tokens[i])) {
      const op = tokens[i++],
        n = product();
      v = op === '+' ? v + n : v - n;
    }
    return v;
  };
  const value = sum();
  if (i !== tokens.length || !Number.isFinite(value))
    throw new Error('Uttrycket ger inget giltigt tal.');
  return value;
}
