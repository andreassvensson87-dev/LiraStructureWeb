import { paintDrawingObject } from '../drawing-object-renderer.js';
import { createDrawingPreview, tintDrawingPreview } from '../drawing-overlay.js';
const group = () => document.createElementNS('http://www.w3.org/2000/svg', 'g');
function paperEditor(root, { record, mode }) {
  const matrix = root.getScreenCTM(),
    zoom = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
  return { record, mode, adapter: { project: (p) => p, unit: () => 1, pixelScale: () => zoom } };
}
export function paintBlockPaper({ root, backRoot, items, selectedIds, record, mode }) {
  root.querySelectorAll(':scope > .block-paper-layer').forEach((node) => node.remove());
  if (backRoot !== root)
    backRoot.querySelectorAll(':scope > .block-paper-layer').forEach((node) => node.remove());
  const front = group(),
    back = group();
  for (const layer of [front, back]) {
    layer.classList.add('block-paper-layer');
    layer.dataset.blockPaper = '';
  }
  root.append(front);
  const boundary = backRoot.querySelector(':scope > [data-paper-boundary]');
  backRoot.insertBefore(back, boundary ? boundary.nextSibling : backRoot.firstChild);
  const editor = paperEditor(root, { record, mode });
  for (const item of items.filter(
    (candidate) => candidate.parametricBlock && candidate.view === 'paper',
  ))
    paintDrawingObject(
      editor,
      item.drawOrder === 'back' ? back : front,
      item,
      selectedIds.has(item.id),
    );
}
export function paintBlockPaperFeedback(root, items, record) {
  if (!root?.isConnected) return;
  root.querySelector(':scope > .block-paper-feedback')?.remove();
  const layer = createDrawingPreview(root);
  layer.classList.add('block-paper-feedback');
  for (const item of items.filter((candidate) => candidate.view === 'paper'))
    paintDrawingObject(paperEditor(root, { record, mode: 'preview' }), layer, item, false);
  tintDrawingPreview(layer);
}
