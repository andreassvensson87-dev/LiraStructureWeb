# Sectional Railing

Bundled geometry converted from the user's `Sectional Railing STEP/Sectional Railing/` directory on 2026-10-09. Includes all 68 STEP files and all 13 original folders, including empty folders. Windows `.lnk` shortcuts are excluded.

`sectional-railing.bin` is a gzip-compressed item-library JSON document. It is loaded on first library open, merged once into IndexedDB and included in the app's offline cache. Stable folder/item IDs derive from their relative source paths; geometry IDs are SHA-256 hashes of the original STEP bytes. Existing imports with the same source hash keep their definitions and are assigned to the corresponding folder.

Conversion: `occt-import-js` 0.0.23 / OpenCascade, millimeters, absolute linear deflection 0.2 mm, angular deflection 0.3 rad. All submeshes are retained as one fixed item. Positions are rounded to 0.00001 mm, normals to 0.000001; initial reference points follow the longest bounding-box axis. Source CAD geometry is unchanged by item placement. References can be adjusted in the editor; these defaults are geometric proposals, not certified installation points.

Counts: Gate 6, Handrail 15, Kick strip 5, Round Bar Filling 14; Top Mounted and Side Mounted each contain Intermediate 7 and Round Bar 7. Each mount also retains its empty Intermediate + Kick strip folder.
