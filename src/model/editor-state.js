/** UI state shared by model adapters. It is deliberately excluded from project snapshots. */
export function createModelEditorState() {
  return {
    showHelpers: true,
    selectedIds: new Set(),
    selected: null,
    boxMode: false,
    marquee: null,
    transparentView: false,
    preview: null,
    previewSweep: null,
    inspectorPreview: null,
    sequence: 0,
    draftMaterial: { material: null, colorOverride: null },
    formSection: null,
    libraryMode: false,
    placement: { horizontalAlignment: 'center', verticalAlignment: 'center' },
  };
}
