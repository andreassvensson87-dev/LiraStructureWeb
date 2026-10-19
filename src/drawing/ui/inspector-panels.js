import { installDrawingSelectionDock } from './selection-dock.js';
import { installInspectorRail } from '../../ui/inspector-rail.js';

export function installDrawingInspectorPanels(dialog, annotations, referencePanel) {
  const host = dialog.querySelector('.drawing-inspector');
  const properties = document.createElement('section');
  properties.className = 'drawing-property-panel';
  properties.append(annotations.panel);
  const settings = document.createElement('section');
  const settingsHeading = document.createElement('h3');
  settingsHeading.textContent = 'Ritningsinställningar';
  settings.append(settingsHeading, host.querySelector('.drawing-settings-fields'));
  const sheet = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = 'Blad och vyer';
  sheet.append(heading, ...[...host.children].filter((node) => node !== referencePanel));
  let selection;
  const rail = installInspectorRail(
    host,
    [
      { id: 'properties', label: 'Egenskaper', icon: 'properties', panel: properties },
      { id: 'sheet', label: 'Blad och vyer', icon: 'page', panel: sheet },
      { id: 'settings', label: 'Ritningsinställningar', icon: 'settings', panel: settings },
      ...(referencePanel
        ? [{ id: 'references', label: 'Referenser', icon: 'references', panel: referencePanel }]
        : []),
    ],
    dialog.id,
    { onChange: () => selection?.sync() },
  );
  selection = installDrawingSelectionDock(annotations, {
    host: dialog.querySelector('.drawing-body'),
    anchor: host,
    visible: () => dialog.open && (!properties.hidden || !sheet.hidden),
    showProperties: () => rail.show('properties'),
    showViews: () => rail.show('sheet'),
  });
  annotations.showProperties = () => {
    if (settings.hidden) rail.show('properties');
  };
  rail.show('sheet');
  return rail;
}
