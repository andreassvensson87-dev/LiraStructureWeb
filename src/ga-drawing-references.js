import { collectDrawingDefinitions, referencesInView } from './model-drawing-references.js';

export class GADrawingReferences {
  constructor(editor, inspector) {
    this.e = editor;
    this.panel = document.createElement('details');
    this.panel.className = 'ga-reference-properties';
    inspector.append(this.panel);
  }
  definitions() {
    const state = this.e.getState();
    return collectDrawingDefinitions(state.drawings || [], this.e.record, state.levels.items);
  }
  entries(view, includeHidden = false) {
    return referencesInView(
      this.definitions(),
      this.e.record,
      view,
      this.e.getState().levels.items,
      includeHidden,
    );
  }
  namingViews() {
    return this.definitions().map((d) => ({ [d.kind]: { label: d.label } }));
  }
  markers(kind, parentId) {
    const view = this.e.record.sheet.views.find((v) => v.id === parentId);
    return this.entries(view)
      .filter((d) => d.kind === kind)
      .map((d) => ({
        id: d.local ? d.viewId : undefined,
        [kind]: {
          points: d.points,
          side: d.side,
          label: d.local ? d.label : `${d.label} / ${d.drawingNumber}`,
        },
      }));
  }
  sync() {
    const view = this.e.views?.active;
    if (!view) return;
    const entries = this.entries(view, true),
      hidden = view.settings.hiddenReferences || [];
    const key = JSON.stringify([
      view.id,
      entries.map((d) => [d.id, d.label, d.drawingNumber]),
      hidden,
    ]);
    if (key === this.key) return;
    this.key = key;
    this.panel.replaceChildren();
    const summary = document.createElement('summary');
    summary.textContent = `Hänvisningar (${entries.length})`;
    this.panel.append(summary);
    for (const entry of entries) {
      const label = document.createElement('label'),
        input = document.createElement('input');
      label.className = 'drawing-check';
      input.type = 'checkbox';
      input.checked = !hidden.includes(entry.id);
      input.onchange = () => {
        const ids = new Set(view.settings.hiddenReferences || []);
        if (input.checked) ids.delete(entry.id);
        else ids.add(entry.id);
        view.settings.hiddenReferences = [...ids];
        this.e.record.settings.hiddenReferences = [...ids];
        this.e.draw();
      };
      label.append(
        input,
        `${entry.kind === 'section' ? 'Snitt' : 'Detalj'} ${entry.label} · ${entry.drawingNumber}`,
      );
      this.panel.append(label);
    }
  }
}
