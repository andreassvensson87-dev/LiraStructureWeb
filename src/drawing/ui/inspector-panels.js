import { installInspectorRail } from '../../ui/inspector-rail.js';

export function installDrawingInspectorPanels(dialog, annotations, referencePanel) {
  const host = dialog.querySelector('.drawing-inspector');
  const properties = document.createElement('section');
  properties.className = 'drawing-property-panel';
  properties.append(annotations.panel);
  const sheet = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = 'Blad och vyer';
  sheet.append(heading, ...[...host.children].filter((node) => node !== referencePanel));
  const rail = installInspectorRail(
    host,
    [
      { id: 'properties', label: 'Egenskaper', icon: 'properties', panel: properties },
      { id: 'sheet', label: 'Blad och vyer', icon: 'page', panel: sheet },
      ...(referencePanel
        ? [{ id: 'references', label: 'Referenser', icon: 'references', panel: referencePanel }]
        : []),
    ],
    dialog.id,
  );
  annotations.showProperties = () => rail.show('properties');
  rail.show('sheet');
  return rail;
}
