import { gridSegments } from '../grid-geometry.js';

/** Initialize grid objects for a new project; saved projects already contain them. */
export function createGridObjects(grid) {
  return gridSegments(grid).map((line, index) => ({
    id: `grid-${line.id}`,
    type: 'gridline',
    name: line.label,
    prefix: 'GL',
    number: index + 1,
    gridAxis: line.axis,
    gridIdentity: line.id,
    bubbleEnds: line.bubbleEnds,
    start: [...line.start, 0],
    end: [...line.end, 0],
  }));
}
/** Rebuild the derived grid cache from the owning model objects. */
export function syncGridObjects(project) {
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
    // Pick IDs are derived UI addresses; stable references use the object identity.
    next[axis].push(object.start[axis === 'x' ? 0 : 1]);
    next.labels[axis].push(object.name);
    next.lines[axis].push({
      id: object.gridIdentity || object.id,
      objectId: object.id,
      start: object.start.slice(0, 2),
      end: object.end.slice(0, 2),
      z: object.start[2],
      bubbleEnds: object.bubbleEnds,
    });
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

/** UI addresses belong to the derived cache, never to the saved objects. */
export function gridPickIds(grid, objectIds) {
  return ['x', 'y'].flatMap((axis) =>
    (grid.lines?.[axis] || []).flatMap((line, index) =>
      objectIds.has(line.objectId) ? [`${axis}:${index}`] : [],
    ),
  );
}
export function gridObjectId(grid, pickId) {
  const [axis, index] = pickId.split(':');
  return grid.lines?.[axis]?.[Number(index)]?.objectId;
}
