export function appendViewTitle(root, view, x, y, unit = 1) {
  const ns = 'http://www.w3.org/2000/svg',
    g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'drawing-view-title');
  g.setAttribute('pointer-events', 'none');
  for (const [text, size, dy, weight] of [
    [view.name, 3.5, 4, '600'],
    ['1:' + Number(view.scale.toFixed(4)).toLocaleString('sv-SE'), 2.5, 8, '400'],
  ]) {
    const t = document.createElementNS(ns, 'text');
    for (const [key, value] of Object.entries({
      x,
      y: y + dy * unit,
      'font-size': size * unit,
      'font-weight': weight,
      'font-family': 'Arial, sans-serif',
      fill: '#354e59',
    }))
      t.setAttribute(key, value);
    t.textContent = text;
    g.append(t);
  }
  root.append(g);
  return g;
}
