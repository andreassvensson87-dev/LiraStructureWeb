import { gridSegments } from '../grid-geometry.js';

/** Convert legacy grid geometry once; model objects then own geometry and labels. */
export function syncGridObjects(project) {
  if (!project.grid.objectBased) {
    const ids = new Set(project.objects.map((s) => s.id));
    const lines = gridSegments(project.grid).map((line, index) => {
      let id = `grid-${line.id}`;
      while (ids.has(id)) id += '-grid';
      ids.add(id);
      return {
        id,
        type: 'gridline',
        name: line.label,
        prefix: 'GL',
        number: index + 1,
        gridAxis: line.axis,
        gridIdentity: line.id,
        bubbleEnds: line.bubbleEnds,
        start: [...line.start, 0],
        end: [...line.end, 0],
      };
    });
    project.objects = [...project.objects, ...lines];
  }
  const next = {
    ...project.grid,
    objectBased: true,
    x: [],
    y: [],
    labels: { x: [], y: [] },
    lines: { x: [], y: [] },
  };
  for (const object of project.objects.filter((s) => s.type === 'gridline')) {
    const axis = object.gridAxis;
    const index = next[axis].length;
    const pickId = `${axis}:${index}`;
    // Pick IDs are derived UI addresses; stable references use the object identity.
    next[axis].push(object.start[axis === 'x' ? 0 : 1]);
    next.labels[axis].push(object.name);
    next.lines[axis].push({
      id: object.gridIdentity || object.id,
      start: object.start.slice(0, 2),
      end: object.end.slice(0, 2),
      z: object.start[2],
      bubbleEnds: object.bubbleEnds,
    });
    if (object.gridPickId !== pickId) {
      project.objects = project.objects.map((s) =>
        s === object ? { ...s, gridPickId: pickId } : s,
      );
    }
  }
  if (JSON.stringify(next) !== JSON.stringify(project.grid)) project.grid = next;
  return project.grid;
}
/** Text-list edits in Settings update the owning objects rather than separate geometry. */
export function applyGridSettingsToObjects(project, previousGrid = project.grid) {
  const globalBubblesChanged = previousGrid.bubbleEnds !== project.grid.bubbleEnds;
  const segments = gridSegments(project.grid);
  project.objects = project.objects.map((s) => {
    if (s.type !== 'gridline') return s;
    const line = segments.find((line) => line.id === (s.gridIdentity || s.id));
    return line
      ? {
          ...s,
          name: line.label,
          bubbleEnds: globalBubblesChanged ? project.grid.bubbleEnds : line.bubbleEnds,
        }
      : s;
  });
}
