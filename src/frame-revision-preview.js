import { appendDrawingLayout } from './drawing-layout.js';
import { drawingRevisionHistory } from './drawing-revision-history.js';
export function showRevisionBlockPreview(editor) {
  const selected = editor.getContext().drawings.find((d) => d.id === editor.$('preview').value);
  const examples = ['A', 'B', 'C'].map((revision, index) => ({
    revision,
    revisionDate: `2026-10-0${index + 1}`,
    revisionCreatedBy: 'AS',
    revisionComment: ['Första utgåvan', 'Ändrad balk', 'Ändrad koppling'][index],
  }));
  const drawing = selected || { ...examples.at(-1), revisions: examples };
  const height =
    (Math.max(1, drawingRevisionHistory(drawing).length) + 1) *
    editor.frame.revisionTable.rowHeight;
  const dialog = document.createElement('dialog');
  dialog.className = 'fe-revision-preview';
  dialog.innerHTML =
    '<header><strong></strong><button aria-label="Stäng revisionsförhandsvisning">×</button></header>';
  dialog.querySelector('strong').textContent = selected
    ? 'Revisionslista · ' + (selected.number || selected.name)
    : 'Förhandsvisning · exempelrevisioner';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `-1 -1 ${editor.frame.width + 2} ${height + 2}`);
  svg.setAttribute('aria-label', 'Revisionslista · nyaste överst');
  appendDrawingLayout(
    svg,
    {
      id: 'preview',
      width: editor.frame.width,
      height,
      entities: [{ id: 'i', blockId: editor.frame.id, point: editor.frame.origin || [0, 0] }],
    },
    { drawing },
    [editor.frame],
  );
  dialog.append(svg);
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('cancel', (event) => event.stopPropagation());
  dialog.addEventListener('close', () => dialog.remove());
  editor.dialog.append(dialog);
  dialog.showModal();
}
