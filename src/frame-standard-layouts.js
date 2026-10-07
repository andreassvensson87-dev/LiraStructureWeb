import { blankLayout } from './frame-layout.js';
import { standardPapers, paperSize } from './paper-formats.js';
export function standardDrawingLayouts(
  title,
  revision,
  { papers = ['A4', 'A3', 'A1'], margin = 10, gap = 5 } = {},
) {
  if (
    !title?.id ||
    !revision?.id ||
    !papers.length ||
    ![margin, gap].every((v) => Number.isFinite(v) && v >= 0)
  )
    throw Error('Välj block, pappersformat och giltiga avstånd.');
  return papers.map((id) => {
    const paper = standardPapers.find((p) => p.id === id);
    if (!paper) throw Error('Okänt pappersformat.');
    const [width, height] = paperSize(paper, id !== 'A4');
    if (
      Math.max(title.width, revision.width) + margin * 2 > width ||
      title.height + gap + revision.height + margin * 2 > height
    )
      throw Error(`Blocken ryms inte på ${id}.`);
    const place = (block, y) => ({
      id: crypto.randomUUID(),
      type: 'block',
      blockId: block.id,
      anchor: 'bottom-right',
      point: [-margin - block.width + (block.origin?.[0] || 0), y + (block.origin?.[1] || 0)],
      angle: 0,
    });
    return {
      ...blankLayout(),
      name: `${id} · ritningshuvud och revision`,
      width,
      height,
      entities: [place(title, margin), place(revision, margin + title.height + gap)],
    };
  });
}
