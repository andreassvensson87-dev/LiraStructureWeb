import { positionDrawingMenu } from './drawing-menu-position.js';
export const defaultCadSettings = {
  snap: true,
  endpoints: true,
  midpoints: true,
  intersections: true,
  perpendicular: true,
  ortho: false,
  polar: 0,
  otrack: false,
  lineweight: true,
};
let settings;
try {
  settings = {
    ...defaultCadSettings,
    ...JSON.parse(localStorage.getItem('lirastructure.cad-settings.v1') || '{}'),
  };
} catch {
  settings = { ...defaultCadSettings };
}
const listeners = new Set();
export function createCadStatusbar(dialog, footer, onChange = () => {}) {
  const bar = document.createElement('div');
  bar.className = 'cad-status-controls';
  const popup = (label, content) => {
    const details = document.createElement('details');
    details.className = 'cad-status-menu';
    details.innerHTML = `<summary aria-label="${label}">${label} ▾</summary><div class="cad-status-panel">${content}</div>`;
    bar.append(details);
    details.querySelector('summary').onclick = () => {
      bar.querySelectorAll('details').forEach((d) => {
        if (d !== details) d.open = false;
      });
    };
    details.addEventListener('toggle', () => {
      if (details.open)
        positionDrawingMenu(details.querySelector('summary'), details.querySelector('div'));
    });
    details.onkeydown = (e) => {
      if (e.key === 'Escape' && details.open) {
        e.preventDefault();
        e.stopPropagation();
        details.open = false;
        details.querySelector('summary').focus();
      }
    };
    return details;
  };
  const snap = document.createElement('button');
  snap.type = 'button';
  snap.textContent = 'Snap';
  snap.dataset.cad = 'snap';
  bar.append(snap);
  popup(
    'Snappunkter',
    ['endpoints', 'midpoints', 'intersections', 'perpendicular']
      .map(
        (key, i) =>
          `<label><input type="checkbox" data-cad="${key}">${['Ändpunkt', 'Mittpunkt', 'Korsning', 'Vinkelrät'][i]}</label>`,
      )
      .join(''),
  );
  for (const key of ['ortho', 'otrack', 'lineweight']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cad = key;
    b.textContent = { ortho: 'Ortho', otrack: 'Otrack', lineweight: 'Linjevikt' }[key];
    b.title = {
      ortho: 'Lås horisontellt/vertikalt · F8',
      otrack: 'Håll över en snappunkt för att spåra dess X/Y-riktning · F11',
      lineweight: 'Visa linjernas verkliga tjocklek',
    }[key];
    bar.append(b);
  }
  const polar = popup(
    'Polar',
    '<label>Vinkelsteg<select data-cad="polar"><option value="0">Av</option><option value="15">15°</option><option value="30">30°</option><option value="45">45°</option><option value="90">90°</option></select></label>',
  );
  bar.insertBefore(polar, bar.querySelector('[data-cad="otrack"]'));
  const coordinates = document.createElement('span');
  coordinates.className = 'cad-coordinates';
  bar.append(coordinates);
  footer.classList.add('cad-statusbar');
  const hint = dialog.querySelector('.cad-hint:not(.cad-warning)');
  if (hint) footer.prepend(hint);
  footer.append(bar);
  const sync = () => {
    for (const element of bar.querySelectorAll('[data-cad]')) {
      const value = settings[element.dataset.cad];
      if (element.tagName === 'BUTTON') element.setAttribute('aria-pressed', String(!!value));
      else if (element.tagName === 'SELECT') element.value = String(value);
      else element.checked = !!value;
    }
    polar.querySelector('summary').classList.toggle('active', !!settings.polar);
    polar.querySelector('summary').textContent = settings.polar
      ? `Polar ${settings.polar}° ▾`
      : 'Polar ▾';
    dialog.classList.toggle('cad-thin-lines', !settings.lineweight);
    onChange(settings);
  };
  const update = (key, value) => {
    settings = { ...settings, [key]: value };
    try {
      localStorage.setItem('lirastructure.cad-settings.v1', JSON.stringify(settings));
    } catch {
      /* Session settings remain usable without storage. */
    }
    listeners.forEach((listener) => listener());
  };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cad]');
    if (b) update(b.dataset.cad, !settings[b.dataset.cad]);
  });
  bar.addEventListener('change', (e) => {
    const b = e.target;
    if (b.dataset.cad) update(b.dataset.cad, b.tagName === 'SELECT' ? +b.value : b.checked);
  });
  dialog.addEventListener('pointerdown', (e) => {
    bar.querySelectorAll('details').forEach((d) => {
      if (!d.contains(e.target)) d.open = false;
    });
  });
  dialog.addEventListener('close', () =>
    bar.querySelectorAll('details').forEach((d) => (d.open = false)),
  );
  listeners.add(sync);
  sync();
  return {
    get: () => settings,
    update,
    coordinates(point) {
      coordinates.textContent = point ? `X ${point[0].toFixed(1)} · Y ${point[1].toFixed(1)}` : '';
    },
    key(e) {
      if (e.target.closest('input,select,textarea')) return false;
      const key = { F3: 'snap', F8: 'ortho', F10: 'polar', F11: 'otrack' }[e.key];
      if (!key) return false;
      e.preventDefault();
      e.stopPropagation();
      update(key, key === 'polar' ? (settings.polar ? 0 : 45) : !settings[key]);
      return true;
    },
  };
}
export function placeCadInput(form, surface, event) {
  const bounds = surface.getBoundingClientRect(),
    size = form.getBoundingClientRect();
  const inspector = surface.querySelector('.drawing-inspector');
  const usableWidth = inspector
    ? Math.min(bounds.width, inspector.getBoundingClientRect().left - bounds.left)
    : bounds.width;
  form.style.left = `${Math.max(8, Math.min(event.clientX - bounds.left + 20, usableWidth - size.width - 8))}px`;
  form.style.top = `${Math.max(8, Math.min(event.clientY - bounds.top + 20, bounds.height - size.height - 44))}px`;
}
