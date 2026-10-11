export function readRichText(root) {
  const paragraphs = [];
  const inline = (node, style = {}, runs = []) => {
    if (node.nodeType === 3) {
      runs.push({ text: node.textContent, ...style });
      return runs;
    }
    if (node.nodeName === 'BR') {
      runs.push({ text: '\n', ...style });
      return runs;
    }
    const next = { ...style };
    if (['B', 'STRONG'].includes(node.nodeName) || Number(node.style?.fontWeight) >= 600)
      next.bold = true;
    if (['I', 'EM'].includes(node.nodeName) || node.style?.fontStyle === 'italic')
      next.italic = true;
    if (node.nodeName === 'U' || node.style?.textDecoration?.includes('underline'))
      next.underline = true;
    for (const child of node.childNodes) inline(child, next, runs);
    return runs;
  };
  const blocks = new Set(['P', 'DIV', 'UL', 'OL', 'LI']);
  const collect = (parent, align = 'left', list = null) => {
    if (parent.childNodes.length === 1 && parent.childNodes[0].nodeName === 'BR') {
      paragraphs.push({ runs: [{ text: '' }], align, list });
      return;
    }
    let loose = [];
    const flush = () => {
      if (loose.length) {
        paragraphs.push({ runs: loose, align, list });
        loose = [];
      }
    };
    for (const child of parent.childNodes) {
      if (['UL', 'OL'].includes(child.nodeName)) {
        flush();
        for (const li of child.children)
          collect(li, li.style.textAlign || align, child.nodeName === 'OL' ? 'number' : 'bullet');
      } else if (blocks.has(child.nodeName)) {
        flush();
        collect(child, child.style.textAlign || align, list);
      } else inline(child, {}, loose);
    }
    flush();
    if (!parent.childNodes.length) paragraphs.push({ runs: [{ text: '' }], align, list });
  };
  collect(root);
  return paragraphs.length ? paragraphs : [{ runs: [{ text: '' }], align: 'left', list: null }];
}
