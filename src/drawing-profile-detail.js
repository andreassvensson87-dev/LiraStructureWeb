import { drawingProfileDetail } from './profile-detail.js';

/** Shared per-view control for GA, Single Part and assembly drawing editors. */
export function installDrawingProfileDetail(parent, { view, drawingType, changed }) {
  const label = document.createElement('label');
  label.textContent = 'Profilvisning i vyn';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Profilvisning i markerad vy');
  select.append(
    new Option('Schematisk · utan radier', 'schematic'),
    new Option('Exakt · med radier', 'exact'),
  );
  label.append(select);
  parent.append(label);
  select.onchange = () => {
    const current = view();
    if (!current) return;
    current.settings ??= {};
    current.settings.profileDetail = select.value;
    changed(current);
  };
  return {
    sync(current = view()) {
      select.disabled = !current;
      select.value = drawingProfileDetail(current, drawingType());
    },
  };
}
