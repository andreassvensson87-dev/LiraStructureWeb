import { latestImportProfiles } from './model-import.js';
import { latestMaterials } from '../materials.js';
import { latestFasteners } from '../fasteners/library.js';
import { profileSnapshot } from '../section-profile.js';

/** Detached upload package; never includes the user's existing model. */
export function modelImportPacket({
  instructions,
  schema,
  example,
  profiles,
  materials,
  fasteners,
}) {
  return structuredClone({
    packetVersion: 3,
    supportedImportVersions: [1, 2, 3],
    instructions,
    schema,
    example,
    profiles: latestImportProfiles(profiles).map((definition) => {
      const snapshot = Array.isArray(definition.parameters)
        ? profileSnapshot(definition)
        : definition;
      return {
        id: definition.id,
        revision: definition.revision,
        name: definition.name,
        boundsMm: snapshot.properties.bounds,
        anchorMm: snapshot.anchor,
      };
    }),
    materials: latestMaterials(materials).map(({ id, revision, name }) => ({ id, revision, name })),
    fasteners: latestFasteners(fasteners),
  });
}
