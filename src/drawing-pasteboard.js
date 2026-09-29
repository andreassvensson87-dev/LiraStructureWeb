// Keep the paper's coordinate system unchanged while making off-sheet content reachable.
export function pasteboardBounds(paper, box) {
  return [
    Math.min(0, box.x),
    Math.min(0, box.y),
    Math.max(paper[0], box.x + box.width),
    Math.max(paper[1], box.y + box.height),
  ];
}
export function pasteboardSize(paper, bounds, scale, viewport) {
  const [left, top, right, bottom] = bounds,
    [padX, padY] = viewport;
  return {
    width: (right - left) * scale + 2 * padX,
    height: (bottom - top) * scale + 2 * padY,
    x: padX - left * scale,
    y: padY - top * scale,
    paperWidth: paper[0] * scale,
    paperHeight: paper[1] * scale,
  };
}
