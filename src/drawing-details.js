export function detailBounds(points) {
  if (points.length !== 2 || !points.every((p) => p.length === 2 && p.every(Number.isFinite)))
    throw Error('Ange två giltiga hörnpunkter.');
  const [a, b] = points,
    left = Math.min(a[0], b[0]),
    bottom = Math.min(a[1], b[1]),
    right = Math.max(a[0], b[0]),
    top = Math.max(a[1], b[1]);
  if (right - left < 0.01 || top - bottom < 0.01)
    throw Error('Välj ett område med både bredd och höjd.');
  return { center: [(left + right) / 2, (bottom + top) / 2], size: [right - left, top - bottom] };
}
export function nextDetailLabel(views) {
  let n = 1;
  while (views.some((v) => v.detail?.label === String(n))) n++;
  return String(n);
}
export function updateDetailArea(view, points = view.detail.points) {
  const bounds = detailBounds(points);
  view.detail.points = structuredClone(points);
  view.camera = { center: bounds.center };
  view.size = bounds.size.map((v) => v / view.scale);
}
export function createDetailView(parent, points, position, views) {
  const label = nextDetailLabel(views),
    view = {
      id: crypto.randomUUID(),
      name: 'Detalj ' + label,
      kind: 'detail',
      projection: parent.projection,
      source: { ...parent.source, parentViewId: parent.id },
      position: [...position],
      scale: Math.max(0.1, parent.scale / 2),
      settings: { ...parent.settings },
      detail: { label, points: structuredClone(points) },
    };
  updateDetailArea(view);
  return view;
}
export function detailSource(view, views) {
  const seen = new Set();
  while (view?.detail) {
    if (seen.has(view.id)) throw Error('Cirkulär vyreferens.');
    seen.add(view.id);
    view = views.find((v) => v.id === view.source.parentViewId);
  }
  if (!view) throw Error('Ursprungsvyn saknas.');
  return view;
}

export function syncDetailCrop(view) {
  if (!view.detail) return;
  const [x, y] = view.camera.center,
    [w, h] = view.size.map((n) => (n * view.scale) / 2);
  view.detail.points = [
    [x - w, y - h],
    [x + w, y + h],
  ];
}
