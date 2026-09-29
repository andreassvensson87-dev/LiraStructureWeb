import { transformFrameEntity } from './frame-model.js';
export const LAYOUT_KEY = 'lirastructure.drawing-layouts.v1';
export function blankLayout() {
  return {
    id: crypto.randomUUID(),
    kind: 'layout',
    name: 'Ny layout',
    width: 420,
    height: 297,
    entities: [],
  };
}
export function anchorPoint(layout, anchor = 'bottom-left') {
  return [
    anchor.endsWith('right') ? layout.width : 0,
    anchor.startsWith('top') ? layout.height : 0,
  ];
}
export function instancePoint(instance, layout) {
  const a = anchorPoint(layout, instance.anchor);
  return instance.point.map((v, i) => v + a[i]);
}
export function offsetForPoint(point, layout, anchor) {
  const a = anchorPoint(layout, anchor);
  return point.map((v, i) => v - a[i]);
}
export function expandLayout(layout, blocks) {
  return layout.entities.flatMap((instance) => {
    const block = blocks.find((b) => b.id === instance.blockId);
    if (!block) return [];
    return block.entities.map((e) => ({
      ...transformFrameEntity(
        e,
        block.origin || [0, 0],
        instancePoint(instance, layout),
        instance.angle || 0,
      ),
      id: instance.id,
    }));
  });
}
export function transformInstance(instance, layout, base, target, angle) {
  const world = { ...instance, point: instancePoint(instance, layout) },
    moved = transformFrameEntity(world, base, target, angle);
  return { ...moved, point: offsetForPoint(moved.point, layout, instance.anchor) };
}
