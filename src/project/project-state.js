/** Serializable project data only. Cameras, selections and active tools belong to the UI. */
export const PROJECT_SCHEMA_VERSION = 1;
export function createProject({ grid, levels }) {
  return structuredClone({
    schemaVersion: PROJECT_SCHEMA_VERSION,
    objects: [],
    grid,
    levels,
    info: { name: '', number: '', client: '' },
    parts: { registry: [], assignments: {} },
    drawings: [],
    reports: [],
    assemblies: [],
    assemblyNumbering: { registry: [] },
    snap: {
      endpoints: true,
      corners: true,
      quadrants: true,
      midpoints: true,
      perpendicular: true,
      gridLines: true,
      gridIntersections: true,
      gridStepEnabled: false,
      gridStep: 100,
      axes: true,
      polar: '45',
      rotation: '15',
    },
  });
}
export function projectData(project) {
  const {
    schemaVersion,
    objects,
    grid,
    levels,
    info,
    parts,
    drawings,
    reports = [],
    snap,
    assemblies = [],
    assemblyNumbering = { registry: [] },
  } = project;
  return {
    schemaVersion,
    objects,
    grid,
    levels,
    info,
    parts,
    drawings,
    reports,
    snap,
    assemblies,
    assemblyNumbering,
  };
}
export function captureProject(project) {
  return structuredClone(projectData(project));
}
