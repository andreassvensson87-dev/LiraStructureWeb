# Code structure and extension rules

## Ownership

- `src/project/`: serializable project data, history and drawing edit merging. No DOM, rendering, localStorage or editor imports. `schemaVersion` identifies the in-memory project schema; file import/migration is not implemented yet.
- `src/app/`: application-level wiring and settings UI. `drawing-controller.js` connects both drawing editors and the manager to the project through explicit callbacks.
- `src/model/ui/`: controllers for selection, rotation, Plate/cuts, workplanes and sweep forms. Controllers receive state and callbacks explicitly. `editor-state.js` owns selection, previews and form state; these never enter project history.
- `src/model/`: model interaction and presentation helpers. Keyboard routing and tool transitions are pure. `tool-session.js` owns transient interaction state, `pointer-controller.js` owns click routing and listener cleanup, and `tools/` contains plate and transform rules. Mesh construction receives model, selection and display options explicitly.
- `src/main.js`: application startup and UI adapters for the model canvas. It coordinates rendering and existing DOM controls; new domain rules belong in `project/` or `model/tools/`, not in the DOM handlers.
- Existing geometry modules (`sweep`, `plate`, `line-cut`, `snap`, etc.) retain their paths to keep this migration reviewable.
- Shared `drawing-*` modules own workspace interactions, annotations, sections, details and titles. GA and Single Part retain different projection/rendering adapters.
- `frame-*` and `section-*` modules implement frame/layout and profile editors. Libraries are browser-local resources, not yet embedded in project snapshots.

## State and changes

`project` owns objects, grids, levels, project information, numbering, drawings and snap settings. Selections, camera, temporary workplanes, active tools and previews are session/UI state. Before a committed project mutation, call the application checkpoint. History owns deep copies and restores the whole project together. Keep the project object identity stable (`Object.assign` on restore) so controllers retain a valid reference.

Drawing editors edit detached records. `mergeDrawingEdit` copies only editor-owned fields back; numbering and source identity remain owned by the manager. Settings are injected through getters, never read from another editor's HTML controls.

`geometryForModel(object, model)` is the explicit geometry entry point for model meshes and previews. Snap, selection and drawing callers also receive their model explicitly. There is no global active geometry model. `createGeometryContext` provides an isolated context for clients evaluating multiple objects.

## How to extend safely

1. Put calculations and validation in functions independent of DOM input.
2. Pass required state and callbacks to UI modules; do not query another editor's DOM.
3. Add a shared drawing behavior once, through adapters for GA and Single Part.
4. Add regression tests for state transitions and geometry behavior, including invalid input and cancellation where relevant.
5. Run `npm run check` (format, lint, tests, production build). CI runs the same command.
6. Verify affected interactions in the browser; unit tests do not replace UI checks.

Use `npm run format` for readable source. Refactor behavior separately from feature changes. GA and SP use common view records for scale and display settings. `ensurePartViews` migrates old SP maps on open; projection-specific layout coordinates remain in the SP adapter to preserve aligned views. Future persistence must package or resolve library references and validate versions before replacing the active project.

## Scope and future features

This refactoring establishes state ownership, tool boundaries, explicit geometry context and shared view settings without changing the product's file format or adding persistence. Project file loading, browser-local library packaging, PWA updates and performance work are separate features. A passing build/test suite does not guarantee that every browser interaction is regression-free; exercise affected UI flows for each change.

## Adding an object type

`src/model/object-types/index.js` registers the built-in Sweep, Plate, Polygoncut and Linecut definitions. Each definition owns its geometry, validation, anchors, corners, snap segment policy, translation and rotation. Type name and default prefix also come from this registry. A missing `type` retains legacy Sweep compatibility; an explicit unknown type is rejected rather than treated as a Sweep.

Definitions are immutable and contain no UI state or DOM code. Geometry constructors return caller-owned disposable geometry; transforms return a new record without modifying the source. `snapSegments` returns reference segments and whether geometric edges should be included (circular sweeps deliberately exclude tessellation edges). Boolean evaluation, cut caching and cut-result corners remain shared in `model-object.js`.

To add a type:

1. Add its definition beside the existing definitions and register it in `index.js`. Duplicate IDs and missing required methods fail at startup.
2. Implement `partFrame` and `partShape` for physical parts. The former supplies local drawing coordinates; the latter supplies placement-independent manufacturing identity for numbering. Cut definitions supply `cutGeometry` instead.
3. Choose an existing inspector adapter using `inspector`, or implement a new UI adapter and creation tool when its parameters differ. `family: 'plate'` means compatibility with the existing planar editor, not merely that an object is flat.
4. Supply any type-specific display adornments or point-editing behavior. The registry does not automatically create tool buttons or forms. New cut representations must also supply their machining identity to `partKey`; existing cuts use frame/polygon/depth fields.
5. Test geometry, validation, anchors, translation/rotation without mutation, numbering and drawing projection. Run `npm run check`, then exercise creation/editing in the browser.

New transformation callers use `transformObject` and `rotateObject`. The older `transformSweep` / `rotateSweep` exports remain compatibility aliases. Selection and GA projection already consume the shared evaluated geometry, so they do not need a branch for every registered shape.

Helper point/line definitions set `physical: false`; `isPhysical` is the shared eligibility check for numbering, drawing candidates, GA and material assignment. They use exact reference points for snap/selection and a separate line/point mesh adapter, not solid tessellation. Physical definitions still require part drawing/numbering methods; helpers do not.

GA section/detail definitions and cross-sheet references live in
`model-drawing-references.js`. The owning view stores its model-space snapshot;
the project drawing collection is the registry. This keeps drawing deletion,
renumbering, editing and undo in the existing project transaction rather than
maintaining a second mutable registry. Frames and nested detail dependencies are
resolved from the source graph; paper scale/position are never model coordinates.
`ga-drawing-references.js` only provides marker adapters and visibility UI.
Single Part uses the same section geometry and tools, with a one-time legacy A–A
conversion in `part-section-migration.js`; its references stay within the part sheet.
# Vektorlinjer i ritningsvyer

`drawing-vector.js` beräknar synliga och skymda kantsegment i ortografiska
vykoordinater. Trianglar och kanter klipps mot samma snittplan; skymning delas
analytiskt vid projekterade triangelgränser och djupövergångar. Ett spatialt
rutnät begränsar kandidaterna vid skymningskontrollen.

GA, Single Part, sektioner och detaljer ritar resultatet som SVG-paths.
GA återanvänder beräknade segment under zoom/panorering och invaliderar dem
vid rebuild. Inaktiva GA-vyer klonar SVG i stället för canvasbilder.
Single Part beräknar segment vid rendering/ändring och zoomar sedan SVG-bladet.
Modellens triangulering begränsar fortfarande rundade konturers geometriska
noggrannhet; vektorlinjer eliminerar rasteroskärpa, inte tessellering.
