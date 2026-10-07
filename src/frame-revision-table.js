import { drawingRevisionHistory } from './drawing-revision-history.js';
import { transformFrameEntity } from './frame-model.js';

export function revisionBlockBottom(block) {
  if (!block.revisionTable || block.revisionTable.headerPosition === 'bottom') return block;
  const height = block.revisionTable.rowHeight;
  return {
    ...block,
    revisionTable: { ...block.revisionTable, headerPosition: 'bottom' },
    entities: block.entities.map((e) =>
      transformFrameEntity(e, [0, 0], [0, e.revisionRole === 'row' ? height : -height]),
    ),
  };
}

export function expandRevisionBlock(block, drawing) {
  block = revisionBlockBottom(block);
  if (!block.revisionTable || !drawing) return block.entities;
  const rows = drawingRevisionHistory(drawing);
  const height = block.revisionTable.rowHeight;
  return block.entities.flatMap((entity) => {
    if (entity.revisionRole !== 'row') return [entity];
    return rows.map((row, index) => {
      const result = transformFrameEntity(entity, [0, 0], [0, index * height]);
      if (entity.type === 'attribute')
        return { ...result, type: 'text', text: String(row[entity.key.slice(8)] || '') };
      return result;
    });
  });
}
