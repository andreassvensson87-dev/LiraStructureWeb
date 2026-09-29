export const initialLevels = () => ({
  active: 'ground',
  items: [{ id: 'ground', name: 'Plan 1', elevation: 0 }],
});
export function validateLevels(state) {
  if (!state.items.length || state.items.length > 100) throw Error('Ange 1–100 nivåer.');
  const names = new Set(),
    ids = new Set();
  for (const l of state.items) {
    if (!l.name.trim() || l.name.length > 60 || names.has(l.name.trim().toLowerCase()))
      throw Error('Nivåerna behöver unika namn (högst 60 tecken).');
    if (!Number.isFinite(l.elevation) || Math.abs(l.elevation) > 1000000)
      throw Error('Höjden ska vara inom ±1 000 000 mm.');
    if (!l.id || ids.has(l.id)) throw Error('Ogiltig nivåidentitet.');
    names.add(l.name.trim().toLowerCase());
    ids.add(l.id);
  }
  if (!ids.has(state.active)) throw Error('Välj en aktiv nivå.');
  return state;
}
export const levelElevation = (state) =>
  state.items.find((l) => l.id === state.active)?.elevation ?? 0;
export class LevelsUI {
  constructor({ getState, change }) {
    this.getState = getState;
    this.change = change;
    const root = document.createElement('div');
    root.className = 'level-controls';
    root.innerHTML =
      '<select aria-label="Aktiv nivå"></select><button type="button" title="Hantera nivåer" aria-label="Hantera nivåer">⋯</button>';
    document.querySelector('.workspace').append(root);
    this.select = root.querySelector('select');
    this.select.onchange = () =>
      change({ ...structuredClone(getState()), active: this.select.value });
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'levels-dialog';
    this.dialog.innerHTML =
      '<div class="panel-title"><h2>Nivåer</h2><button type="button" aria-label="Stäng nivåer">×</button></div><form><div class="level-rows"></div><button type="button" id="level-add">Lägg till nivå</button><p role="alert"></p><button class="primary">Tillämpa</button></form><p class="inspector-note">Höjd i mm. Aktiv nivå styr arbetsplanet och stomlinjerna. Befintliga objekt flyttas inte.</p>';
    document.body.append(this.dialog);
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    this.dialog.querySelector('button').onclick = () => this.dialog.close();
    root.querySelector('button').onclick = () => {
      this.draft = structuredClone(getState());
      this.rows();
      this.dialog.querySelector('[role=alert]').textContent = '';
      this.dialog.showModal();
    };
    this.dialog.querySelector('#level-add').onclick = () => {
      const items = this.draft.items;
      let n = items.length + 1;
      while (items.some((l) => l.name === `Plan ${n}`)) n++;
      items.push({
        id: crypto.randomUUID(),
        name: `Plan ${n}`,
        elevation: Math.max(...items.map((l) => l.elevation)) + 3000,
      });
      this.rows();
    };
    this.dialog.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      try {
        validateLevels(this.draft);
        change(structuredClone(this.draft));
        this.dialog.close();
      } catch (e) {
        this.dialog.querySelector('[role=alert]').textContent = e.message;
      }
    };
    this.sync();
  }
  sync() {
    const s = this.getState();
    this.select.replaceChildren(
      ...s.items.map(
        (l) => new Option(`${l.name} · ${l.elevation.toLocaleString('sv-SE')} mm`, l.id),
      ),
    );
    this.select.value = s.active;
  }
  rows() {
    const root = this.dialog.querySelector('.level-rows');
    root.replaceChildren();
    for (const l of this.draft.items) {
      const row = document.createElement('div');
      row.className = 'level-row';
      const name = document.createElement('input'),
        height = document.createElement('input'),
        remove = document.createElement('button');
      name.value = l.name;
      name.maxLength = 60;
      name.required = true;
      name.setAttribute('aria-label', 'Nivånamn');
      height.type = 'number';
      height.step = 'any';
      height.required = true;
      height.value = l.elevation;
      height.setAttribute('aria-label', `Höjd för ${l.name}`);
      name.oninput = () => (l.name = name.value);
      height.oninput = () => (l.elevation = height.value.trim() ? Number(height.value) : NaN);
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Ta bort ${l.name}`);
      remove.disabled = this.draft.items.length === 1;
      remove.onclick = () => {
        this.draft.items = this.draft.items.filter((x) => x.id !== l.id);
        if (this.draft.active === l.id) this.draft.active = this.draft.items[0].id;
        this.rows();
      };
      row.append(name, height, remove);
      root.append(row);
    }
  }
}
