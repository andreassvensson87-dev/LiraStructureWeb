import { defaultCoordinates } from '../coordinates/coordinates.js';
import { defaultWorkArea } from '../model/work-area.js';
import { createGridObjects, syncGridObjects } from '../model/grid-objects.js';
/** Serializable project data only. Cameras, selections and active tools belong to the UI. */
export const PROJECT_SCHEMA_VERSION = 1;
export function createProject({ grid, levels }) {
  const project = structuredClone({
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    objects: createGridObjects(grid),
    grid,
    levels,
    workArea: defaultWorkArea(),
    coordinates: defaultCoordinates(),
    info: { name: '', number: '', client: '' },
    parts: { registry: [], assignments: {} },
    drawings: [],
    reports: [],
    references: { folders: ['Standard'], models: [] },
    assemblies: [],
    assemblyNumbering: { registry: [] },
    snap: {
      endpoints: true,
      corners: true,
      quadrants: true,
      midpoints: true,
      perpendicular: true,
      nearest: true,
      gridLines: true,
      gridIntersections: true,
      gridStepEnabled: false,
      gridStep: 100,
      axes: true,
      polar: '45',
      rotation: '15',
    },
  });
  syncGridObjects(project);
  return project;
}
export function projectData(project) {
  const {
    schemaVersion,
    id,
    objects,
    grid,
    levels,
    info,
    parts,
    drawings,
    reports,
    references,
    snap,
    assemblies,
    assemblyNumbering,
    workArea,
    coordinates,
  } = project;
  return {
    schemaVersion,
    id,
    objects,
    grid,
    levels,
    info,
    parts,
    drawings,
    reports,
    references,
    snap,
    assemblies,
    assemblyNumbering,
    workArea,
    coordinates,
  };
}
export function captureProject(project) {
  return structuredClone(projectData(project));
}
